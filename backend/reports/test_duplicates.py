import hashlib
import tempfile
from datetime import timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import connection
from django.test import TestCase, override_settings, RequestFactory
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .duplicates import fingerprint_file, flag_duplicate_reports
from .models import Report, ReportDuplicateMatch
from .serializers import ReportSerializer, CitizenReportSerializer


class DuplicateReportFixtures:
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.event_time = timezone.now().replace(second=0, microsecond=0)

    def create_report(self, content=b"same evidence", filename="photo.jpg", **changes):
        data = {"violation_type": "Obstruction", "description": "Observed road obstruction", "location": "Surigao City",
                "image": SimpleUploadedFile(filename, content, content_type="image/jpeg"),
                "reporter_email": "witness@example.com", "reporter_phone": "09123456789", "latitude": "9.790000", "longitude": "125.490000",
                "location_accuracy": 12, "location_captured_at": timezone.now(), "occurred_at": self.event_time,
                **changes}
        serializer = CitizenReportSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.captureOnCommitCallbacks(execute=True):
            return serializer.save()

class DuplicateReportTests(DuplicateReportFixtures, TestCase):
    def test_same_evidence_with_different_filename_and_witness_is_flagged_without_deleting(self):
        first = self.create_report()
        second = self.create_report(filename="renamed-photo.jpg", reporter_email="another@example.com",
                                    latitude="9.790500", occurred_at=self.event_time + timedelta(minutes=15))
        self.assertEqual(Report.objects.count(), 2)
        self.assertEqual(set(Report.objects.values_list("status", flat=True)), {"Pending"})
        self.assertEqual(first.evidence_sha256, second.evidence_sha256)
        match = ReportDuplicateMatch.objects.get()
        self.assertEqual((match.first_report_id, match.second_report_id), (first.pk, second.pk))
        self.assertLess(match.distance_m, 100)
        self.assertEqual(match.time_difference_seconds, 900)
        flag_duplicate_reports(first.pk)
        flag_duplicate_reports(second.pk)
        self.assertEqual(ReportDuplicateMatch.objects.count(), 1)

    def test_each_of_the_four_criteria_must_match(self):
        self.create_report()
        self.create_report(content=b"different photograph")
        self.create_report(violation_type="No U-Turn / Illegal Turn")
        self.create_report(latitude="9.792000")
        self.create_report(occurred_at=self.event_time + timedelta(hours=2))
        self.assertFalse(ReportDuplicateMatch.objects.exists())

    def test_incident_time_is_used_instead_of_submission_time(self):
        self.create_report(occurred_at=self.event_time - timedelta(days=3))
        self.create_report(occurred_at=self.event_time - timedelta(days=3) + timedelta(minutes=20))
        self.create_report(occurred_at=self.event_time)
        self.assertEqual(ReportDuplicateMatch.objects.count(), 1)

    def test_missing_coordinates_do_not_match_a_city_name_alone(self):
        first = self.create_report()
        Report.objects.filter(pk=first.pk).update(latitude=None, longitude=None)
        self.create_report()
        self.assertFalse(ReportDuplicateMatch.objects.exists())

    def test_hashing_restores_upload_position_and_cannot_be_spoofed(self):
        upload = SimpleUploadedFile("photo.jpg", b"evidence content")
        upload.seek(3)
        self.assertEqual(fingerprint_file(upload), hashlib.sha256(b"evidence content").hexdigest())
        self.assertEqual(upload.tell(), 3)
        self.create_report()
        self.create_report(evidence_sha256="fake", possible_duplicate=False, duplicate_matches=[])
        self.assertEqual(ReportDuplicateMatch.objects.count(), 1)

    def test_staff_can_review_both_sides_and_public_endpoints_never_expose_matches(self):
        first, second = self.create_report(), self.create_report()
        client = APIClient()
        for path in ("/api/reports/", f"/api/reports/{second.pk}/", f"/api/reports/by-reference/{second.reference_id}/"):
            response = client.get(path)
            rows = response.data if isinstance(response.data, list) else [response.data]
            for row in rows:
                self.assertNotIn("possible_duplicate", row)
                self.assertNotIn("duplicate_matches", row)
                self.assertNotIn("evidence_sha256", row)
                self.assertNotIn("evidence_visual", row)
        client.force_authenticate(User.objects.create_user("reviewer", is_staff=True))
        for report, other in ((first, second), (second, first)):
            response = client.get(f"/api/reports/{report.pk}/")
            self.assertTrue(response.data["possible_duplicate"])
            self.assertEqual(response.data["duplicate_matches"][0]["reference_id"], other.reference_id)
            self.assertEqual(response.data["duplicate_matches"][0]["time_basis"], "incident time")
        # Email recovery also uses ReportSerializer; it must not reveal another witness's report.
        request = RequestFactory().get("/api/reports/my-reports/")
        request.user = User(is_staff=False)
        self.assertNotIn("duplicate_matches", ReportSerializer(second, context={"request": request}).data)

    def test_status_update_keeps_flag_and_evidence_correction_rechecks_matches(self):
        self.create_report()
        report = self.create_report()
        serializer = ReportSerializer(report, data={"status": "Validated"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.captureOnCommitCallbacks(execute=True):
            report = serializer.save()
        self.assertTrue(ReportDuplicateMatch.objects.exists())
        serializer = ReportSerializer(report, data={"image": SimpleUploadedFile("new.jpg", b"different evidence")}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.captureOnCommitCallbacks(execute=True):
            serializer.save()
        self.assertFalse(ReportDuplicateMatch.objects.exists())

    def test_existing_reports_can_be_backfilled_without_changing_status(self):
        first, second = self.create_report(), self.create_report()
        ReportDuplicateMatch.objects.all().delete()
        Report.objects.filter(pk__in=[first.pk, second.pk]).update(evidence_sha256="", occurred_at=None,
            description="Old report\nDate: 2026-10-23\nTime: 12:00", status="Validated")
        output = StringIO()
        call_command("backfill_report_duplicates", stdout=output)
        first.refresh_from_db()
        self.assertTrue(first.evidence_sha256)
        self.assertEqual(first.occurred_at.isoformat(), "2026-10-23T04:00:00+00:00")
        self.assertEqual(ReportDuplicateMatch.objects.count(), 1)
        self.assertEqual(set(Report.objects.values_list("status", flat=True)), {"Validated"})
        call_command("backfill_report_duplicates", stdout=output)
        self.assertEqual(ReportDuplicateMatch.objects.count(), 1)

    def test_admin_list_prefetches_matches_without_per_report_queries(self):
        for _ in range(6):
            self.create_report()
        client = APIClient()
        client.force_authenticate(User.objects.create_user("prefetch-reviewer", is_staff=True))
        with CaptureQueriesContext(connection) as queries:
            response = client.get("/api/reports/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(row["possible_duplicate"] for row in response.data))
        self.assertLessEqual(len(queries), 4)
