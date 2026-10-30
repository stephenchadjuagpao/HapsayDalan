import re
import tempfile
from datetime import timedelta
from smtplib import SMTPException
from unittest.mock import patch

from django.core import mail, signing
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report, ReportSubmissionChallenge
from .submission_verification import SUBMISSION_SALT


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class SubmissionVerificationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.captcha = patch("reports.submission_verification.verify_report_captcha").start()
        self.addCleanup(patch.stopall)
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)

    def request_code(self, email="me@example.com"):
        response = self.client.post("/api/submission-email/request/", {"email": email, "phone": "09123456789", "captcha_token": "verified-captcha"})
        self.assertEqual(response.status_code, 200, response.data)
        code = re.search(r"\b[0-9]{6}\b", mail.outbox[-1].body).group()
        return response.data["challenge_id"], code

    def proof(self, email="me@example.com"):
        challenge, code = self.request_code(email)
        response = self.client.post("/api/submission-email/verify/", {"challenge_id": challenge, "code": code})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["email_verification_token"], challenge

    def payload(self, proof="", email="me@example.com"):
        return {"violation_type": "Obstruction", "description": "Test report", "location": "Surigao",
                "reporter_email": email, "reporter_phone": "09123456789", "latitude": "9.784300", "longitude": "125.488800",
                "location_accuracy": 12, "location_captured_at": timezone.now().isoformat(),
                "image": SimpleUploadedFile("evidence.txt", b"test evidence"), "email_verification_token": proof}

    def test_verified_submission_is_email_bound_and_single_use(self):
        proof, challenge_id = self.proof("ME@EXAMPLE.COM")
        challenge = ReportSubmissionChallenge.objects.get(pk=challenge_id)
        self.assertNotRegex(challenge.code_hash, r"^[0-9]{6}$")
        self.assertEqual(mail.outbox[-1].to, ["me@example.com"])
        self.assertEqual(Report.objects.count(), 0)
        response = self.client.post("/api/reports/", self.payload(proof, "Me@example.com"), format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        report = Report.objects.get()
        self.assertEqual(report.reporter_email, "me@example.com")
        self.assertEqual(report.email_verified_at, challenge.verified_at)
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 400)
        self.assertEqual(Report.objects.count(), 1)
        self.captcha.assert_called_once_with("verified-captcha")

    def test_plain_email_or_captcha_token_cannot_bypass_verification(self):
        payload = {**self.payload(), "captcha_token": "valid-captcha", "email_verified_at": timezone.now().isoformat()}
        response = self.client.post("/api/reports/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email_verification_token", response.data)
        self.assertEqual(Report.objects.count(), 0)

    def test_wrong_email_tampered_recovery_and_expired_proofs_are_rejected(self):
        proof, challenge = self.proof()
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof, "other@example.com"), format="multipart").status_code, 400)
        for token in (proof + "tampered", signing.dumps({"email": "me@example.com"}, salt="reports.verified-email")):
            self.assertEqual(self.client.post("/api/reports/", self.payload(token), format="multipart").status_code, 400)
        self.assertEqual(self.client.get("/api/reports/my-reports/", HTTP_X_REPORT_ACCESS=proof).status_code, 403)
        ReportSubmissionChallenge.objects.filter(pk=challenge).update(verified_at=timezone.now() - timedelta(minutes=16))
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 400)
        self.assertEqual(Report.objects.count(), 0)

    def test_wrong_attempts_lock_code_and_verified_code_cannot_be_reused(self):
        challenge, code = self.request_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.client.post("/api/submission-email/verify/", {"challenge_id": challenge, "code": wrong}).status_code, 400)
        self.assertEqual(self.client.post("/api/submission-email/verify/", {"challenge_id": challenge, "code": code}).status_code, 400)
        challenge, code = self.request_code("second@example.com")
        payload = {"challenge_id": challenge, "code": code}
        self.assertEqual(self.client.post("/api/submission-email/verify/", payload).status_code, 200)
        self.assertEqual(self.client.post("/api/submission-email/verify/", payload).status_code, 400)

    def test_expired_code_and_persistent_email_cooldown(self):
        challenge, code = self.request_code()
        cache.clear()
        self.assertEqual(self.client.post("/api/submission-email/request/", {"email": "ME@example.com", "phone": "09123456789", "captcha_token": "token"}).status_code, 429)
        ReportSubmissionChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.post("/api/submission-email/verify/", {"challenge_id": challenge, "code": code}).status_code, 400)

    def test_failed_report_validation_does_not_consume_proof(self):
        proof, challenge = self.proof()
        payload = self.payload(proof)
        del payload["latitude"]
        self.assertEqual(self.client.post("/api/reports/", payload, format="multipart").status_code, 400)
        self.assertIsNone(ReportSubmissionChallenge.objects.get(pk=challenge).consumed_at)
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 201)

    def test_delivery_failures_leave_no_active_challenge(self):
        for failure in (SMTPException("failed"), OSError("failed"), 0):
            options = {"side_effect": failure} if isinstance(failure, Exception) else {"return_value": failure}
            with patch("reports.submission_verification.send_mail", **options):
                response = self.client.post("/api/submission-email/request/", {"email": "me@example.com", "phone": "09123456789", "captcha_token": "token"})
            self.assertEqual(response.status_code, 503)
            self.assertFalse(ReportSubmissionChallenge.objects.exists())
            self.assertNotIn("challenge_id", response.data)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend")
    def test_console_mail_does_not_pretend_to_deliver_code(self):
        response = self.client.post("/api/submission-email/request/", {"email": "me@example.com", "phone": "09123456789", "captcha_token": "token"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(ReportSubmissionChallenge.objects.exists())

    def test_sending_codes_is_rate_limited(self):
        for number in range(10):
            self.request_code(f"person{number}@example.com")
        self.assertEqual(self.client.post("/api/submission-email/request/", {"email": "last@example.com", "phone": "09123456789", "captcha_token": "token"}).status_code, 429)
