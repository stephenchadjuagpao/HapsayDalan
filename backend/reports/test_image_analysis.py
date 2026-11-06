import io
import json
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .image_analysis import analyze, provider_response


@override_settings(GEMINI_API_KEY="test-private-key", GEMINI_VISION_MODEL="gemini-3.5-flash",
                   AI_IMAGE_DAILY_LIMIT=50, SECURE_SSL_REDIRECT=False)
class ImageAnalysisTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def photo(self):
        stream = io.BytesIO()
        Image.new("RGB", (200, 100), "blue").save(stream, "JPEG")
        return SimpleUploadedFile("private-name.jpg", stream.getvalue(), content_type="image/jpeg")

    def post(self, **extra):
        return self.client.post("/api/image-analysis/", {"image": self.photo(), "consent": "true", **extra}, format="multipart")

    @override_settings(GEMINI_API_KEY="")
    def test_missing_provider_disables_feature(self):
        self.assertFalse(self.client.get("/api/image-analysis/config/").data["available"])
        self.assertEqual(self.post().status_code, 503)

    @patch("reports.image_analysis.analyze")
    def test_consent_and_real_photo_required(self, provider):
        self.assertEqual(self.post(consent="false").status_code, 400)
        self.assertEqual(self.post(image=SimpleUploadedFile("fake.jpg", b"not a photo")).status_code, 400)
        self.assertEqual(self.post(image=SimpleUploadedFile("clip.mp4", b"video")).status_code, 400)
        provider.assert_not_called()

    @patch("reports.image_analysis.analyze", return_value={"violation_type": "Obstruction", "reason": "Vehicle blocks sidewalk."})
    def test_analyzes_without_storing_or_modifying_a_report(self, provider):
        from .models import Report
        before = Report.objects.count()
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["violation_type"], "Obstruction")
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(Report.objects.count(), before)
        self.assertNotIn("test-private-key", json.dumps(response.data))

    @patch("reports.image_analysis.analyze", side_effect=HTTPError("url", 429, "quota", None, None))
    def test_provider_failure_falls_back_to_manual(self, provider):
        response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertIn("quota", response.data["detail"])

    @override_settings(AI_IMAGE_DAILY_LIMIT=1)
    @patch("reports.image_analysis.analyze", return_value={"violation_type": None, "reason": "Insufficient context."})
    def test_daily_limit(self, provider):
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.post().status_code, 429)
        self.assertEqual(provider.call_count, 1)

    @patch("reports.image_analysis.urlopen")
    def test_provider_request_and_result_validation(self, provider):
        response = MagicMock()
        provider.return_value.__enter__.return_value = response
        def output(value, finish="STOP"):
            return json.dumps({"candidates": [{"finishReason": finish, "content": {"parts": [{"text": json.dumps(value)}]}}]}).encode()
        response.read.return_value = output({"violation_type": "Obstruction", "reason": "Blocked sidewalk"})
        self.assertEqual(analyze("image-base64")["violation_type"], "Obstruction")
        request = provider.call_args.args[0]
        self.assertNotIn("test-private-key", request.full_url)
        body = json.loads(request.data)
        self.assertEqual(body["generationConfig"]["thinkingConfig"], {"thinkingLevel": "LOW"})
        self.assertEqual(body["contents"][0]["parts"][1]["inlineData"]["data"], "image-base64")
        response.read.return_value = output({"violation_type": "Invented law", "reason": "unsupported"})
        with self.assertRaises(ValueError):
            analyze("image-base64")
        response.read.return_value = output({"violation_type": "NONE", "reason": "Unclear"})
        self.assertIsNone(analyze("image-base64")["violation_type"])
        response.read.return_value = output({"violation_type": "Obstruction", "reason": "maybe"}, "MAX_TOKENS")
        with self.assertRaises(ValueError):
            analyze("image-base64")

    @patch("reports.image_analysis.time.sleep")
    @patch("reports.image_analysis.urlopen")
    def test_temporary_503_is_retried_then_succeeds(self, provider, sleep):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b"success"
        provider.side_effect = [HTTPError("url", 503, "busy", None, None), response]
        self.assertEqual(provider_response(MagicMock()), b"success")
        self.assertEqual(provider.call_count, 2)
        sleep.assert_called_once_with(1)

    @patch("reports.image_analysis.time.sleep")
    @patch("reports.image_analysis.urlopen")
    def test_permanent_errors_and_quota_are_not_retried(self, provider, sleep):
        for code in [400, 403, 404, 429]:
            provider.reset_mock()
            provider.side_effect = HTTPError("url", code, "rejected", None, None)
            with self.assertRaises(HTTPError):
                provider_response(MagicMock())
            self.assertEqual(provider.call_count, 1)
        sleep.assert_not_called()

    @patch("reports.image_analysis.time.sleep")
    @patch("reports.image_analysis.urlopen", side_effect=HTTPError("url", 503, "busy", None, None))
    def test_persistent_outage_stops_after_one_retry(self, provider, sleep):
        response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["provider_status"], 503)
        self.assertIn("retried", response.data["detail"])
        self.assertEqual(provider.call_count, 2)
