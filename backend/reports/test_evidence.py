import io
import tempfile
from smtplib import SMTPException
from unittest.mock import patch

from PIL import Image
from django.contrib.auth.models import User
from django.core import mail, signing
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report, ReportEvidenceRequest


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AdditionalEvidenceTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        config = override_settings(PRIVATE_EVIDENCE_ROOT=folder.name)
        config.enable()
        self.addCleanup(config.disable)
        self.report = Report.objects.create(violation_type="Obstruction", description="Original details", location="Surigao",
                                            reporter_email="owner@example.com", image="reports/original.jpg")
        self.staff = User.objects.create_user("reviewer", is_staff=True)
        self.client = APIClient()
        self.base = f"/api/reports/{self.report.pk}/evidence/"
        self.token = signing.dumps({"email": "OWNER@example.com"}, salt="reports.verified-email")

    def request_evidence(self):
        self.client.force_authenticate(self.staff)
        response = self.client.post(self.base + "request/", {"message": "  Please add a clear photo of the obstruction.  "})
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["request"]["id"]

    def test_staff_request_notifies_once_preserves_original_and_is_not_public(self):
        request_id = self.request_evidence()
        self.assertTrue(ReportEvidenceRequest.objects.filter(pk=request_id).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["owner@example.com"])
        self.assertIn(self.report.reference_id, mail.outbox[0].body)
        self.assertEqual(self.client.post(self.base + "request/", {"message": "Again"}).status_code, 400)
        self.assertEqual(len(mail.outbox), 1)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "Pending")
        self.assertEqual(self.report.image.name, "reports/original.jpg")
        self.assertIsNone(self.report.public_verified_at)
        self.client.force_authenticate(None)
        tracked = self.client.get(f"/api/reports/by-reference/{self.report.reference_id}/")
        self.assertEqual(tracked.data["evidence_status"], "requested")
        self.assertNotIn("message", tracked.data)
        self.assertNotIn("evidence_requests", tracked.data)
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])

    def test_only_staff_can_request_and_prompt_is_required(self):
        self.assertIn(self.client.post(self.base + "request/", {"message": "Forged request"}).status_code, (401, 403))
        self.client.force_authenticate(self.staff)
        for message in ("", "   ", "x" * 1001):
            self.assertEqual(self.client.post(self.base + "request/", {"message": message}).status_code, 400)
        self.assertEqual(ReportEvidenceRequest.objects.count(), 0)

    def test_email_failure_does_not_discard_the_saved_request(self):
        self.client.force_authenticate(self.staff)
        with patch("reports.evidence.send_mail", side_effect=SMTPException("Offline")):
            response = self.client.post(self.base + "request/", {"message": "Clarify the plate number."})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["notification_sent"])
        self.assertEqual(ReportEvidenceRequest.objects.count(), 1)

    def test_history_requires_the_correct_unexpired_recovery_proof(self):
        self.request_evidence()
        self.client.force_authenticate(None)
        with patch("django.core.signing.time.time", return_value=0):
            expired = signing.dumps({"email": "owner@example.com"}, salt="reports.verified-email")
        bad_tokens = ["", self.token + "tampered", expired,
                      signing.dumps({"email": "other@example.com"}, salt="reports.verified-email"),
                      signing.dumps({"email": "owner@example.com"}, salt="reports.submission-email")]
        for token in bad_tokens:
            self.assertEqual(self.client.get(self.base, HTTP_X_REPORT_ACCESS=token).status_code, 403)
        response = self.client.get(self.base, HTTP_X_REPORT_ACCESS=self.token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["requests"][0]["message"], "Please add a clear photo of the obstruction.")
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_verified_reply_retains_original_and_file_is_private(self):
        request_id = self.request_evidence()
        self.client.force_authenticate(None)
        image = io.BytesIO()
        Image.new("RGB", (20, 20), "red").save(image, format="PNG")
        response = self.client.post(self.base + request_id + "/respond/", {
            "response_text": "  A clearer photo.  ", "attachment": SimpleUploadedFile("clear.png", image.getvalue(), "image/png"),
            "status": "Validated", "reporter_email": "other@example.com",
        }, format="multipart", HTTP_X_REPORT_ACCESS=self.token)
        self.assertEqual(response.status_code, 200, response.data)
        item = ReportEvidenceRequest.objects.get()
        self.assertEqual(item.response_text, "A clearer photo.")
        self.assertEqual(item.attachment_content_type, "image/png")
        self.assertNotIn("/media/", response.data["request"]["attachment_url"])
        with self.assertRaises(ValueError):
            _ = item.attachment.url
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "Pending")
        self.assertEqual(self.report.image.name, "reports/original.jpg")
        file_url = response.data["request"]["attachment_url"]
        self.assertEqual(self.client.get(file_url).status_code, 403)
        file_response = self.client.get(file_url, HTTP_X_REPORT_ACCESS=self.token)
        self.assertEqual(file_response.status_code, 200)
        self.assertEqual(b"".join(file_response.streaming_content), image.getvalue())
        file_response.close()
        self.assertEqual(self.client.post(self.base + request_id + "/respond/", {"response_text": "Overwrite"}, HTTP_X_REPORT_ACCESS=self.token).status_code, 400)
        self.client.force_authenticate(self.staff)
        staff_file = self.client.get(file_url)
        self.assertEqual(staff_file.status_code, 200)
        staff_file.close()
        self.request_evidence()  # A later follow-up is possible; previous evidence is retained.
        self.assertEqual(ReportEvidenceRequest.objects.count(), 2)

    def test_empty_invalid_and_oversized_files_do_not_answer_the_request(self):
        request_id = self.request_evidence()
        self.client.force_authenticate(None)
        path = self.base + request_id + "/respond/"
        self.assertEqual(self.client.post(path, {}, HTTP_X_REPORT_ACCESS=self.token).status_code, 400)
        for name, content in (("script.svg", b"<svg/>"), ("fake.jpg", b"not an image"), ("fake.mp4", b"not a video")):
            result = self.client.post(path, {"attachment": SimpleUploadedFile(name, content)}, format="multipart", HTTP_X_REPORT_ACCESS=self.token)
            self.assertEqual(result.status_code, 400, result.data)
        with patch("reports.evidence.MAX_EVIDENCE_BYTES", 1):
            self.assertEqual(self.client.post(path, {"attachment": SimpleUploadedFile("large.png", b"large")}, format="multipart", HTTP_X_REPORT_ACCESS=self.token).status_code, 400)
        self.assertIsNone(ReportEvidenceRequest.objects.get().responded_at)

    def test_wrong_owner_and_report_id_cannot_reply_and_closed_reports_cannot_accept_evidence(self):
        request_id = self.request_evidence()
        path = self.base + request_id + "/respond/"
        self.assertEqual(self.client.post(path, {"response_text": "Staff forged reply"}).status_code, 403)
        self.client.force_authenticate(None)
        other_token = signing.dumps({"email": "other@example.com"}, salt="reports.verified-email")
        self.assertEqual(self.client.post(path, {"response_text": "Wrong owner"}, HTTP_X_REPORT_ACCESS=other_token).status_code, 403)
        other = Report.objects.create(violation_type="Obstruction", location="Surigao", reporter_email="owner@example.com", image="original.jpg")
        self.assertEqual(self.client.post(f"/api/reports/{other.pk}/evidence/{request_id}/respond/", {"response_text": "Mismatch"}, HTTP_X_REPORT_ACCESS=self.token).status_code, 404)
        Report.objects.filter(pk=self.report.pk).update(status="Resolved", public_verified_at=timezone.now())
        self.assertEqual(self.client.post(path, {"response_text": "Late reply"}, HTTP_X_REPORT_ACCESS=self.token).status_code, 400)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post(self.base + "request/", {"message": "Closed case"}).status_code, 400)

    def test_text_only_reply_does_not_automatically_publish_or_resolve(self):
        request_id = self.request_evidence()
        self.client.force_authenticate(None)
        result = self.client.post(self.base + request_id + "/respond/", {"response_text": "The vehicle blocked the east entrance."}, HTTP_X_REPORT_ACCESS=self.token)
        self.assertEqual(result.status_code, 200)
        tracked = self.client.get(f"/api/reports/by-reference/{self.report.reference_id}/")
        self.assertEqual(tracked.data["evidence_status"], "submitted")
        self.assertEqual(tracked.data["status"], "Pending")
        self.assertEqual(self.client.get("/api/reports/hotspots/").data, [])
