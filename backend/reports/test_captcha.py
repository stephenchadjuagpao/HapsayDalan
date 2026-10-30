import json
import tempfile
import re
from unittest.mock import patch, MagicMock
from urllib.error import URLError

from django.core.cache import cache
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .captcha import CaptchaUnavailable, verify_report_captcha
from .models import Report


@override_settings(RECAPTCHA_SITE_KEY="public-test-key", RECAPTCHA_SECRET_KEY="private-test-secret",
                   RECAPTCHA_ALLOWED_HOSTNAMES=["localhost"], EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class CaptchaTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def provider(self, result):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(result).encode()
        return patch("reports.captcha.urlopen", return_value=response)

    def payload(self, token="token"):
        return {
            "violation_type": "Obstruction", "description": "Test report", "location": "Surigao",
            "reporter_email": "reporter@example.com", "reporter_phone": "09123456789", "latitude": "9.784300", "longitude": "125.488800",
            "location_accuracy": "12", "location_captured_at": timezone.now().isoformat(),
            "image": SimpleUploadedFile("evidence.txt", b"test evidence"), "captcha_token": token,
        }

    def test_token_is_required_and_direct_api_cannot_save_without_it(self):
        response = self.client.post("/api/reports/", self.payload(""), format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email_verification_token", response.data)
        response = self.client.post("/api/submission-email/request/", {"email": "reporter@example.com", "phone": "09123456789"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("captcha_token", response.data)
        self.assertEqual(Report.objects.count(), 0)

    def test_successful_verification_is_required_before_report_is_saved(self):
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            with self.provider({"success": True, "hostname": "localhost"}) as provider:
                sent = self.client.post("/api/submission-email/request/", {"email": "reporter@example.com", "phone": "09123456789", "captcha_token": "token"})
                self.assertEqual(sent.status_code, 200)
                code = re.search(r"\b[0-9]{6}\b", mail.outbox[-1].body).group()
                proof = self.client.post("/api/submission-email/verify/", {"challenge_id": sent.data["challenge_id"], "code": code})
                response = self.client.post("/api/reports/", {**self.payload(), "email_verification_token": proof.data["email_verification_token"]}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Report.objects.count(), 1)
        self.assertNotIn("captcha_token", response.data)
        request = provider.call_args.args[0]
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.full_url, "https://www.google.com/recaptcha/api/siteverify")
        self.assertIn(b"secret=private-test-secret", request.data)

    def test_invalid_expired_and_replayed_tokens_do_not_save_reports(self):
        for result in [{"success": False, "error-codes": ["timeout-or-duplicate"]}, {"success": False}]:
            with self.subTest(result=result), self.provider(result):
                response = self.client.post("/api/submission-email/request/", {"email": "reporter@example.com", "phone": "09123456789", "captcha_token": "token"})
            self.assertEqual(response.status_code, 400)
        self.assertEqual(Report.objects.count(), 0)

    def test_provider_hostname_must_match_configured_site(self):
        with self.provider({"success": True, "hostname": "other.example.com"}):
            with self.assertRaises(ValidationError):
                verify_report_captcha("token")

    def test_unavailable_provider_or_malformed_response_fails_closed(self):
        with patch("reports.captcha.urlopen", side_effect=URLError("Offline")):
            with self.assertRaises(CaptchaUnavailable):
                verify_report_captcha("token")
        with self.provider(["invalid"]):
            with self.assertRaises(CaptchaUnavailable):
                verify_report_captcha("token")

    @override_settings(RECAPTCHA_SECRET_KEY="")
    def test_missing_configuration_blocks_submission_without_exposing_secret(self):
        response = self.client.post("/api/submission-email/request/", {"email": "reporter@example.com", "phone": "09123456789", "captcha_token": "token"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(Report.objects.count(), 0)
        config = self.client.get("/api/captcha-config/")
        self.assertFalse(config.data["configured"])
        self.assertNotIn("secret", str(config.data).lower())

    def test_config_only_returns_public_site_key(self):
        response = self.client.get("/api/captcha-config/")
        self.assertEqual(response.data, {"site_key": "public-test-key", "configured": True})

    def test_submission_requests_are_rate_limited(self):
        for _ in range(10):
            self.assertEqual(self.client.post("/api/reports/", self.payload(""), format="multipart").status_code, 400)
        self.assertEqual(self.client.post("/api/reports/", self.payload(""), format="multipart").status_code, 429)
