from django.contrib.auth.models import User
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.forms import modelform_factory
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report
from .serializers import CitizenReportSerializer
from .views import RECOVERY_SALT


class RejectionReasonTests(TestCase):
    def setUp(self):
        self.report = Report.objects.create(violation_type="Obstruction", description="Witness details",
            location="Surigao", reporter_email="me@example.com", image="reports/evidence.jpg",
            status="Validated", public_verified_at=timezone.now())
        self.client = APIClient()
        self.admin = User.objects.create_user("reviewer", is_staff=True)
        self.client.force_authenticate(self.admin)
        self.path = f"/api/reports/{self.report.pk}/"

    def reject(self):
        return self.client.patch(self.path, {"status": "Rejected", "rejection_reason": "insufficient_evidence",
                                            "rejection_details": "  Please provide a clearer image of the obstruction.  "})

    def test_reason_and_explanation_required_and_failed_review_does_not_unpublish(self):
        for payload in ({"status": "Rejected"}, {"status": "Rejected", "rejection_reason": "insufficient_evidence", "rejection_details": "   "},
                        {"status": "Rejected", "rejection_details": "An explanation", "rejection_reason": "unknown"}):
            response = self.client.patch(self.path, payload)
            self.assertEqual(response.status_code, 400, response.data)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "Validated")
        self.assertIsNotNone(self.report.public_verified_at)

    def test_reason_persists_and_is_available_only_through_reporter_access(self):
        response = self.reject()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["rejection_reason_label"], "Insufficient evidence")
        self.report.refresh_from_db()
        self.assertEqual(self.report.rejection_details, "Please provide a clearer image of the obstruction.")
        self.assertIsNone(self.report.public_verified_at)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])
        tracked = self.client.get(f"/api/reports/by-reference/{self.report.reference_id}/")
        self.assertEqual(tracked.data["rejection_reason_label"], "Insufficient evidence")
        self.assertEqual(tracked.data["rejection_details"], self.report.rejection_details)
        self.assertNotIn("reporter_email", tracked.data)
        token = signing.dumps({"email": "me@example.com"}, salt=RECOVERY_SALT)
        recovered = self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=token)
        self.assertEqual(recovered.data[0]["rejection_details"], self.report.rejection_details)
        self.assertIn(self.client.patch(self.path, {"status": "Rejected"}).status_code, (401, 403))

    def test_reopening_clears_old_rejection_and_rejecting_again_needs_a_new_reason(self):
        self.assertEqual(self.reject().status_code, 200)
        response = self.client.patch(self.path, {"status": "Pending"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["rejection_reason"], "")
        self.assertEqual(response.data["rejection_details"], "")
        self.assertEqual(self.client.patch(self.path, {"status": "Rejected"}).status_code, 400)

    def test_legacy_rejected_report_is_preserved_but_requires_reason_when_edited(self):
        Report.objects.filter(pk=self.report.pk).update(status="Rejected", rejection_reason="", rejection_details="", public_verified_at=None)
        self.assertEqual(self.client.get(self.path).data["rejection_reason"], "")
        self.assertEqual(self.client.patch(self.path, {"status": "Rejected"}).status_code, 400)
        self.assertEqual(self.reject().status_code, 200)

    def test_reporter_cannot_set_rejection_fields_and_long_explanations_are_rejected(self):
        serializer = CitizenReportSerializer(data={"violation_type": "Obstruction", "description": "Witness report", "location": "Surigao",
            "reporter_email": "me@example.com", "reporter_phone": "09123456789", "image": SimpleUploadedFile("evidence.txt", b"evidence"),
            "latitude": "9.790000", "longitude": "125.490000", "location_accuracy": 10, "location_captured_at": timezone.now(),
            "status": "Rejected", "rejection_reason": "other", "rejection_details": "Forged decision"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("status", serializer.validated_data)
        self.assertEqual(serializer.validated_data["rejection_reason"], "")
        self.assertEqual(serializer.validated_data["rejection_details"], "")
        response = self.client.patch(self.path, {"status": "Rejected", "rejection_reason": "other", "rejection_details": "x" * 1001})
        self.assertEqual(response.status_code, 400)

    def test_django_admin_model_form_also_requires_reason(self):
        form_class = modelform_factory(Report, fields=["status", "rejection_reason", "rejection_details"])
        form = form_class(data={"status": "Rejected", "rejection_reason": "", "rejection_details": "   "}, instance=self.report)
        self.assertFalse(form.is_valid())
        self.assertIn("rejection_reason", form.errors)
        self.assertIn("rejection_details", form.errors)
