from datetime import timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core import signing
from django.core.management import call_command
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report
from .suspicious import flags_for_report, refresh_suspicious_flags
from .views import RECOVERY_SALT


class SuspiciousReportTests(TestCase):
    def report(self, **changes):
        with self.captureOnCommitCallbacks(execute=True):
            report = Report.objects.create(violation_type="Obstruction", description="Observed obstruction",
                location="Surigao", image="reports/example.jpg", reporter_email=changes.pop("reporter_email", "me@example.com"),
                latitude="9.790000", longitude="125.490000", **changes)
        report.refresh_from_db()
        return report

    def codes(self, report):
        report.refresh_from_db()
        return {flag["code"] for flag in report.suspicious_flags}

    def test_third_rapid_report_flags_all_three_without_changing_status(self):
        first = self.report()
        second = self.report(reporter_email="ME@example.com")
        self.assertEqual(self.codes(first), set())
        third = self.report()
        for report in (first, second, third):
            self.assertEqual(self.codes(report), {"rapid_submissions"})
            self.assertEqual(report.status, "Pending")
            self.assertIsNone(report.public_verified_at)
            related = report.suspicious_flags[0]["related_reports"]
            self.assertEqual(len(related), 2)
            self.assertNotIn(report.pk, [item["id"] for item in related])

    def test_twenty_minute_span_is_not_mistaken_for_ten_and_other_email_does_not_count(self):
        first, middle, last = self.report(), self.report(), self.report()
        now = timezone.now()
        for report, minutes in ((first, 0), (middle, 9), (last, 18)):
            Report.objects.filter(pk=report.pk).update(date_reported=now + timedelta(minutes=minutes))
        refresh_suspicious_flags(middle.pk)
        self.assertEqual(self.codes(middle), set())
        self.report(reporter_email="other@example.com")
        self.assertEqual(self.codes(first), set())

    def test_future_incident_time_has_tolerance_and_updates_clear_the_flag(self):
        report = self.report(occurred_at=timezone.now() + timedelta(hours=1))
        self.assertEqual(self.codes(report), {"future_incident_time"})
        with self.captureOnCommitCallbacks(execute=True):
            report.occurred_at = timezone.now() - timedelta(minutes=1)
            report.save(update_fields=["occurred_at"])
        self.assertEqual(self.codes(report), set())
        tolerated = self.report(occurred_at=timezone.now() + timedelta(minutes=5))
        self.assertEqual(self.codes(tolerated), set())

    def test_manual_pin_distance_respects_device_accuracy_and_does_not_treat_gps_pin_as_remote(self):
        values = {"location_source": "manual", "reporter_latitude": "9.890000", "reporter_longitude": "125.490000"}
        report = self.report(location_accuracy=20, **values)
        self.assertEqual(self.codes(report), {"distant_selected_pin"})
        for changes in ({**values, "location_accuracy": 10000},
                        {**values, "location_accuracy": 20, "reporter_latitude": "9.790500"},
                        {**values, "location_source": "gps", "location_accuracy": 20}):
            report = self.report(reporter_email=f"case{Report.objects.count()}@example.com", **changes)
            self.assertEqual(self.codes(report), set())

    def test_deletion_and_email_correction_refresh_related_reports(self):
        first, second, third = self.report(), self.report(), self.report()
        with self.captureOnCommitCallbacks(execute=True):
            third.reporter_email = "corrected@example.com"
            third.save(update_fields=["reporter_email"])
        self.assertEqual(self.codes(first), set())
        self.assertEqual(self.codes(second), set())
        fourth = self.report()
        self.assertEqual(self.codes(first), {"rapid_submissions"})
        with self.captureOnCommitCallbacks(execute=True):
            fourth.delete()
        self.assertEqual(self.codes(first), set())

    def test_only_admin_can_see_flags_and_clients_cannot_forge_them(self):
        report = self.report(occurred_at=timezone.now() + timedelta(hours=1))
        client = APIClient()
        for path in (f"/api/reports/by-reference/{report.reference_id}/", "/api/reports/hotspots/"):
            self.assertNotIn("suspicious_flags", str(client.get(path).data))
        token = signing.dumps({"email": report.reporter_email}, salt=RECOVERY_SALT)
        self.assertNotIn("suspicious_flags", str(client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=token).data))
        client.force_authenticate(User.objects.create_user("reviewer", is_staff=True))
        self.assertEqual(client.get(f"/api/reports/{report.pk}/").data["suspicious_flags"][0]["code"], "future_incident_time")
        response = client.patch(f"/api/reports/{report.pk}/", {"suspicious_flags": []}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.codes(report), {"future_incident_time"})
        client.patch(f"/api/reports/{report.pk}/", {"status": "Validated"})
        self.assertEqual(self.codes(report), {"future_incident_time"})

    def test_backfill_is_repeatable_and_preserves_admin_decisions(self):
        report = self.report(status="Rejected", occurred_at=timezone.now() + timedelta(hours=1))
        Report.objects.filter(pk=report.pk).update(suspicious_flags=[])
        for _ in range(2):
            call_command("backfill_report_flags", stdout=StringIO())
        self.assertEqual(self.codes(report), {"future_incident_time"})
        self.assertEqual(report.status, "Rejected")


class SuspiciousAutocommitTests(TransactionTestCase):
    def test_model_creation_waits_for_reference_before_refreshing_related_links(self):
        reports = [Report.objects.create(violation_type="Obstruction", description="Observed obstruction",
            location="Surigao", image="reports/example.jpg", reporter_email="me@example.com") for _ in range(3)]
        for report in reports:
            report.refresh_from_db()
            self.assertEqual(report.suspicious_flags[0]["code"], "rapid_submissions")
            self.assertTrue(all(item["reference_id"] for item in report.suspicious_flags[0]["related_reports"]))
