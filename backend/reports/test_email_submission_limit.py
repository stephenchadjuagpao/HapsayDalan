import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core import signing, mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Report, ReportSubmissionChallenge
from .submission_verification import SUBMISSION_SALT


class SubmissionLimitFixtures:
    def setUp(self):
        cache.clear()
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.client = APIClient()

    def proof(self, email="me@example.com", consumed_at=None):
        now = timezone.now()
        challenge = ReportSubmissionChallenge.objects.create(
            email=email, phone="+639123456789", code_hash="unused-test-code", verified_at=now,
            expires_at=now + timedelta(minutes=10), consumed_at=consumed_at,
        )
        return signing.dumps({"challenge_id": str(challenge.pk), "email": email,
                              "phone": "+639123456789", "channel": "email"}, salt=SUBMISSION_SALT), challenge

    def payload(self, proof, email="me@example.com"):
        return {"violation_type": "Obstruction", "description": "Observed obstruction", "location": "Surigao",
                "reporter_email": email, "reporter_phone": "+639123456789", "latitude": "9.784300", "longitude": "125.488800",
                "location_accuracy": 12, "location_captured_at": timezone.now().isoformat(),
                "image": SimpleUploadedFile("evidence.txt", b"Evidence"), "email_verification_token": proof}

    def consumed(self, count, seconds_ago=0):
        for _ in range(count):
            self.proof(consumed_at=timezone.now() - timedelta(seconds=seconds_ago))


@override_settings(REPORT_EMAIL_SUBMISSION_LIMIT=3, REPORT_EMAIL_SUBMISSION_WINDOW_SECONDS=600,
                   EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmailSubmissionLimitTests(SubmissionLimitFixtures, TestCase):
    def test_first_three_accepted_fourth_blocked_even_from_another_ip_and_after_cache_clear(self):
        for index in range(3):
            proof, _ = self.proof()
            response = self.client.post("/api/reports/", self.payload(proof), format="multipart")
            self.assertEqual(response.status_code, 201, response.data)
        cache.clear()
        proof, challenge = self.proof()
        response = self.client.post("/api/reports/", self.payload(proof, "ME@example.com"),
                                    format="multipart", REMOTE_ADDR="192.168.20.9")
        self.assertEqual(response.status_code, 429)
        self.assertIn("3 reports per 10 minutes", str(response.data["detail"]))
        self.assertGreater(int(response["Retry-After"]), 0)
        self.assertLessEqual(int(response["Retry-After"]), 600)
        self.assertEqual(Report.objects.count(), 3)
        challenge.refresh_from_db()
        self.assertIsNone(challenge.consumed_at)

    def test_rolling_window_allows_submission_once_oldest_report_expires(self):
        self.consumed(1, seconds_ago=601)
        self.consumed(2, seconds_ago=10)
        proof, _ = self.proof()
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 201)
        proof, _ = self.proof()
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 429)

    def test_other_email_has_its_own_quota(self):
        self.consumed(3)
        proof, _ = self.proof("other@example.com")
        response = self.client.post("/api/reports/", self.payload(proof, "other@example.com"), format="multipart")
        self.assertEqual(response.status_code, 201, response.data)

    def test_invalid_report_and_unconsumed_proofs_do_not_use_quota(self):
        self.consumed(2)
        proof, challenge = self.proof()
        payload = self.payload(proof)
        del payload["latitude"]
        self.assertEqual(self.client.post("/api/reports/", payload, format="multipart").status_code, 400)
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 201)
        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.consumed_at)

    def test_blocked_proof_can_be_retried_after_window_and_deleting_reports_does_not_reset_limit(self):
        self.consumed(3)
        Report.objects.all().delete()
        proof, challenge = self.proof()
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 429)
        ReportSubmissionChallenge.objects.filter(consumed_at__isnull=False).update(consumed_at=timezone.now() - timedelta(seconds=601))
        self.assertEqual(self.client.post("/api/reports/", self.payload(proof), format="multipart").status_code, 201)

    @patch("reports.submission_verification.verify_report_captcha")
    def test_limited_email_does_not_receive_another_code(self, captcha):
        self.consumed(3)
        response = self.client.post("/api/submission-email/request/", {"email": "ME@example.com", "phone": "09123456789", "captcha_token": "token"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(ReportSubmissionChallenge.objects.count(), 3)

    @override_settings(REPORT_EMAIL_SUBMISSION_LIMIT=1, REPORT_EMAIL_SUBMISSION_WINDOW_SECONDS=60)
    def test_configured_limit_and_window_are_used(self):
        self.consumed(1, seconds_ago=20)
        proof, _ = self.proof()
        response = self.client.post("/api/reports/", self.payload(proof), format="multipart")
        self.assertEqual(response.status_code, 429)
        self.assertIn("1 report per 1 minute", str(response.data["detail"]))
        self.assertLessEqual(int(response["Retry-After"]), 40)


@override_settings(REPORT_EMAIL_SUBMISSION_LIMIT=3, REPORT_EMAIL_SUBMISSION_WINDOW_SECONDS=600)
class ConcurrentEmailSubmissionLimitTests(SubmissionLimitFixtures, TransactionTestCase):
    @skipUnlessDBFeature("has_select_for_update")
    def test_two_simultaneous_submissions_cannot_both_take_last_slot(self):
        self.consumed(2)
        proofs = [self.proof()[0], self.proof()[0]]
        barrier = Barrier(2)

        def submit(proof):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                response = APIClient().post("/api/reports/", self.payload(proof), format="multipart")
                return response.status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(submit, proofs))
        self.assertEqual(sorted(results), [201, 429])
        self.assertEqual(Report.objects.count(), 1)
        self.assertEqual(ReportSubmissionChallenge.objects.filter(consumed_at__isnull=False).count(), 3)
