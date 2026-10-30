from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report
from .views import RECOVERY_SALT


class PublicVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user("reviewer", is_staff=True)
        self.pending = Report.objects.create(
            violation_type="Obstruction", description="Private witness remarks",
            location="Surigao", image="reports/evidence.jpg", reporter_email="witness@example.com",
            latitude="9.790000", longitude="125.490000",
        )

    def approve(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f"/api/reports/{self.pending.pk}/", {"status": "Validated"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data["public_verified_at"])
        return response

    def test_pending_hidden_from_public_but_admin_and_reporter_can_access(self):
        self.assertEqual(self.pending.get_status_display(), "Pending Verification")
        for path in ("/api/reports/", "/api/reports/hotspots/"):
            self.assertEqual(self.client.get(path).data, [])
        self.assertEqual(self.client.get(f"/api/reports/{self.pending.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/reports/by-reference/{self.pending.reference_id}/").status_code, 200)
        token = signing.dumps({"email": self.pending.reporter_email}, salt=RECOVERY_SALT)
        recovered = self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=token)
        self.assertEqual(recovered.data[0]["id"], self.pending.pk)
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get("/api/reports/").data), 1)
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])

    def test_real_session_save_requires_fresh_csrf_after_login(self):
        self.admin.set_password("Test!Password829")
        self.admin.save()
        client = APIClient(enforce_csrf_checks=True)
        before_login = client.get("/api/csrf/").data["csrfToken"]
        response = client.post("/api/admin/login/", {
            "username": self.admin.username, "password": "Test!Password829",
        }, HTTP_X_CSRFTOKEN=before_login)
        self.assertEqual(response.status_code, 200, response.data)
        path = f"/api/reports/{self.pending.pk}/"
        self.assertEqual(client.patch(path, {"status": "Validated"}).status_code, 403)
        self.assertEqual(client.patch(path, {"status": "Validated"}, HTTP_X_CSRFTOKEN=before_login).status_code, 403)
        fresh_token = client.get("/api/csrf/").data["csrfToken"]
        self.assertTrue(client.cookies["csrftoken"]["httponly"])
        saved = client.patch(path, {"status": "Validated", "assigned_officer": "Officer Reyes"}, HTTP_X_CSRFTOKEN=fresh_token)
        self.assertEqual(saved.status_code, 200, saved.data)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.assigned_officer, "Officer Reyes")
        self.assertIsNotNone(self.pending.public_verified_at)

    def test_verified_is_public_and_remains_public_through_case_progress(self):
        self.approve()
        for status in ("Validated", "Assigned", "In Progress", "Resolved"):
            self.client.force_authenticate(self.admin)
            response = self.client.patch(f"/api/reports/{self.pending.pk}/", {"status": status})
            self.assertEqual(response.status_code, 200, response.data)
            self.client.force_authenticate(None)
            for path in ("/api/reports/", "/api/reports/hotspots/"):
                rows = self.client.get(path).data
                self.assertEqual(len(rows), 1)
                self.assertNotIn("reporter_email", rows[0])
                self.assertNotIn("description", rows[0])
                self.assertNotIn("image", rows[0])

    def test_rejected_or_reset_reports_require_new_approval(self):
        for status in ("Rejected", "Pending"):
            self.approve()
            response = self.client.patch(f"/api/reports/{self.pending.pk}/", {"status": status, **(
                {"rejection_reason": "insufficient_evidence", "rejection_details": "The evidence does not show the reported violation."}
                if status == "Rejected" else {})})
            self.assertEqual(response.status_code, 200)
            self.assertIsNone(response.data["public_verified_at"])
            self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])

    def test_cannot_skip_review_or_forge_verification_timestamp(self):
        self.client.force_authenticate(self.admin)
        for status in ("Assigned", "In Progress", "Resolved"):
            response = self.client.patch(f"/api/reports/{self.pending.pk}/", {
                "status": status, "public_verified_at": timezone.now().isoformat(),
            })
            self.assertEqual(response.status_code, 400)
        self.client.patch(f"/api/reports/{self.pending.pk}/", {"public_verified_at": timezone.now().isoformat()})
        self.pending.refresh_from_db()
        self.assertIsNone(self.pending.public_verified_at)
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])

    def test_anonymous_and_nonstaff_cannot_approve_and_legacy_status_is_not_proof(self):
        for user in (None, User.objects.create_user("citizen")):
            self.client.force_authenticate(user)
            response = self.client.patch(f"/api/reports/{self.pending.pk}/", {"status": "Validated"})
            self.assertIn(response.status_code, (401, 403))
        Report.objects.filter(pk=self.pending.pk).update(status="Validated")
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])
