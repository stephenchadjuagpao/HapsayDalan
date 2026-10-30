import re
from smtplib import SMTPException
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail, signing
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report, ReportRecoveryChallenge
from .views import RECOVERY_SALT
from .serializers import ReportSerializer


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ReportRecoveryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.mine = Report.objects.create(
            violation_type="Obstruction", description="Reporter Email: me@example.com",
            location="Surigao City", image="reports/test.jpg",
            reporter_email="me@example.com", reporter_phone="09123456789",
        )
        self.other = Report.objects.create(
            violation_type="No Parking", description="Private details", location="Other street",
            image="reports/other.jpg", reporter_email="other@example.com",
        )

    def request_code(self, email="me@example.com"):
        response = self.client.post("/api/reports/recover/", {"email": email})
        self.assertEqual(response.status_code, 200)
        code = re.search(r"\b[0-9]{6}\b", mail.outbox[-1].body).group()
        return response.data["challenge_id"], code

    def test_verified_email_only_returns_own_reports_and_code_is_single_use(self):
        challenge, code = self.request_code("ME@example.com")
        payload = {"challenge_id": challenge, "code": code}
        verified = self.client.post("/api/reports/verify-recovery/", payload)
        self.assertEqual(verified.status_code, 200)
        result = self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=verified.data["access_token"])
        self.assertEqual([r["id"] for r in result.data], [self.mine.id])
        self.assertEqual(result["Cache-Control"], "no-store")
        self.assertEqual(self.client.post("/api/reports/verify-recovery/", payload).status_code, 400)

    def test_no_access_without_valid_unexpired_token(self):
        for token in ["", "tampered", signing.dumps({"email": "me@example.com"}, salt="wrong-salt")]:
            self.assertEqual(self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=token).status_code, 403)
        with patch("django.core.signing.time.time", return_value=timezone.now().timestamp() - 901):
            expired = signing.dumps({"email": "me@example.com"}, salt=RECOVERY_SALT)
        self.assertEqual(self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=expired).status_code, 403)

    def test_five_failed_attempts_lock_code(self):
        challenge, code = self.request_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            response = self.client.post("/api/reports/verify-recovery/", {"challenge_id": challenge, "code": wrong})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post("/api/reports/verify-recovery/", {"challenge_id": challenge, "code": code}).status_code, 400)

    def test_expired_code_and_resend_cooldown(self):
        challenge, code = self.request_code()
        self.assertEqual(self.client.post("/api/reports/recover/", {"email": "me@example.com"}).status_code, 429)
        ReportRecoveryChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.post("/api/reports/verify-recovery/", {"challenge_id": challenge, "code": code}).status_code, 400)

    def test_unknown_email_receives_code_without_revealing_report_ownership(self):
        response = self.client.post("/api/reports/recover/", {"email": "unknown@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("challenge_id", response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["unknown@example.com"])

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend")
    def test_console_backend_does_not_claim_email_was_sent(self):
        response = self.client.post("/api/reports/recover/", {"email": "me@example.com"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("challenge_id", response.data)
        self.assertFalse(ReportRecoveryChallenge.objects.exists())

    def test_delivery_failures_do_not_open_verification_or_leave_active_code(self):
        for result in [SMTPException("Delivery failed"), OSError("Connection failed"), 0]:
            with self.subTest(result=result):
                options = {"side_effect": result} if isinstance(result, Exception) else {"return_value": result}
                with patch("reports.views.send_mail", **options):
                    response = self.client.post("/api/reports/recover/", {"email": "me@example.com"})
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("challenge_id", response.data)
                self.assertFalse(ReportRecoveryChallenge.objects.exists())

    def test_public_endpoints_do_not_leak_contacts_or_description(self):
        Report.objects.filter(pk=self.mine.pk).update(status="Validated", public_verified_at=timezone.now())
        urls = ["/api/reports/", f"/api/reports/{self.mine.pk}/",
                f"/api/reports/by-reference/{self.mine.reference_id}/"]
        for url in urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            rows = response.data if isinstance(response.data, list) else [response.data]
            for row in rows:
                self.assertNotIn("reporter_email", row)
                self.assertNotIn("reporter_phone", row)
                self.assertNotIn("description", row)
                self.assertNotIn("reporter_latitude", row)
                self.assertNotIn("reporter_longitude", row)

    def test_only_staff_can_change_reports_and_see_admin_fields(self):
        response = self.client.patch(f"/api/reports/{self.mine.pk}/", {"reporter_email": "attacker@example.com"})
        self.assertIn(response.status_code, [401, 403])
        self.client.force_authenticate(User.objects.create_user("staff", is_staff=True))
        response = self.client.get("/api/reports/")
        self.assertIn("reporter_email", response.data[0])

    def test_recovery_requests_are_rate_limited_by_ip(self):
        for i in range(10):
            self.assertEqual(self.client.post("/api/reports/recover/", {"email": f"unknown{i}@example.com"}).status_code, 200)
        self.assertEqual(self.client.post("/api/reports/recover/", {"email": "last@example.com"}).status_code, 429)

    def test_submission_requires_valid_email(self):
        for email in [None, "", "   ", "invalid-email"]:
            with self.subTest(email=email):
                payload = {
                    "violation_type": "Obstruction", "description": "Test report",
                    "location": "Surigao City",
                    "image": SimpleUploadedFile("evidence.txt", b"Evidence", content_type="text/plain"),
                }
                if email is not None:
                    payload["reporter_email"] = email
                response = self.client.post("/api/reports/", payload, format="multipart")
                self.assertEqual(response.status_code, 400)
                self.assertIn("reporter_email", response.data)
        serializer = ReportSerializer(data={
            "violation_type": "Obstruction", "description": "Test report", "location": "Surigao City",
            "image": SimpleUploadedFile("evidence.txt", b"Evidence"),
            "reporter_email": "me@example.com",
            "reporter_phone": "09123456789",
            "latitude": "9.784300", "longitude": "125.488800",
            "location_accuracy": 15, "location_captured_at": timezone.now(),
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
