import json
import tempfile
from io import StringIO
from pathlib import Path
from smtplib import SMTPException
from unittest.mock import MagicMock, patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.apps import apps
from django.core import mail
from django.core.files.base import ContentFile
from django.core.management import call_command, CommandError
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase, override_settings

from .email_delivery import email_delivery_configured
from .evidence_storage import EvidenceStorage
from .models import Officer, Report


@override_settings(EMAIL_BACKEND="reports.email_backend.BrevoEmailBackend",
                   BREVO_API_KEY="test-key", DEFAULT_FROM_EMAIL="HapsayDalan <sender@example.com>")
class CloudEmailTests(SimpleTestCase):
    def provider(self, result=None):
        response = MagicMock()
        response.status = 201
        response.read.return_value = json.dumps(result or {"messageId": "test-id"}).encode()
        response.__enter__.return_value = response
        return patch("reports.email_backend.urlopen", return_value=response)

    def test_email_uses_https_and_preserves_recipient_subject_and_body(self):
        self.assertTrue(email_delivery_configured())
        with self.provider() as deliver:
            self.assertEqual(mail.send_mail("Verification", "Code: 123456", None, ["owner@example.com"]), 1)
        request = deliver.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(request.get_header("Api-key"), "test-key")
        payload = json.loads(request.data)
        self.assertEqual(payload["sender"], {"email": "sender@example.com", "name": "HapsayDalan"})
        self.assertEqual(payload["to"], [{"email": "owner@example.com"}])
        self.assertEqual(payload["textContent"], "Code: 123456")

    def test_failure_returns_no_success_and_does_not_expose_provider_details(self):
        with patch("reports.email_backend.urlopen", side_effect=URLError("secret provider details")):
            with self.assertRaisesMessage(SMTPException, "HTTPS email delivery failed."):
                mail.send_mail("Test", "Body", None, ["owner@example.com"])
            self.assertEqual(mail.send_mail("Test", "Body", None, ["owner@example.com"], fail_silently=True), 0)

    @override_settings(BREVO_API_KEY="")
    def test_missing_api_key_is_not_delivery_ready(self):
        self.assertFalse(email_delivery_configured())


class CloudStorageTests(SimpleTestCase):
    @override_settings(EVIDENCE_STORAGE_ALIAS="private_evidence", STORAGES={
        "private_evidence": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    })
    def test_private_evidence_uses_configured_storage_and_never_exposes_a_url(self):
        storage = EvidenceStorage()
        name = storage.save("case/photo.jpg", ContentFile(b"evidence"))
        with storage.open(name) as file:
            self.assertEqual(file.read(), b"evidence")
        self.assertEqual(storage.size(name), 8)
        with self.assertRaises(ValueError):
            storage.url(name)
        storage.delete(name)
        self.assertFalse(storage.exists(name))


@override_settings(ROOT_URLCONF="config.cloud_urls", ALLOWED_HOSTS=["testserver"])
class CloudRoutingTests(SimpleTestCase):
    def test_spa_routes_work_and_never_replace_missing_api_or_media(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "index.html").write_text("<html>React app</html>")
            with override_settings(FRONTEND_BUILD_ROOT=folder):
                for path in ("/", "/admin-ctmo", "/admin-dashboard"):
                    response = self.client.get(path, secure=True)
                    self.assertEqual(response.status_code, 200)
                    self.assertIn(b"React app", b"".join(response.streaming_content))
                    self.assertEqual(response["Cache-Control"], "no-store")
                for path in ("/api/missing/", "/media/missing.jpg", "/static/missing.js"):
                    self.assertEqual(self.client.get(path, secure=True).status_code, 404)

    def test_health_reports_database_failure_without_details(self):
        with patch("config.cloud_views.connection") as database:
            database.cursor.side_effect = DatabaseError("private connection")
            response = self.client.get("/healthz", secure=True)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})


class CloudSnapshotTests(TestCase):
    def test_modified_officer_directory_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "empty.json"
            snapshot.write_text("[]")
            Officer.objects.create(name="New officer", badge="NEW-123", unit="Patrol")
            with self.assertRaisesMessage(CommandError, "modified officer directory"):
                call_command("cloud_snapshot", "import", snapshot, stdout=StringIO())
            self.assertTrue(Officer.objects.filter(badge="NEW-123").exists())

    def test_snapshot_roundtrip_preserves_password_and_case_reference_and_refuses_overwrite(self):
        user = get_user_model().objects.create_user(username="admin@example.com", password="strong test password", is_staff=True)
        report = Report.objects.create(violation_type="Test", description="Example", location="Test street",
                                       reporter_email="owner@example.com", image="reports/existing.jpg")
        reference = report.reference_id
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "snapshot.json"
            call_command("cloud_snapshot", "export", snapshot, stdout=StringIO())
            with self.assertRaises(CommandError):
                call_command("cloud_snapshot", "import", snapshot, stdout=StringIO())
            # Clear only this isolated test database to exercise first deployment.
            for model in reversed(list(apps.get_app_config('reports').get_models())):
                model.objects.all().delete()
            user.delete()
            call_command("cloud_snapshot", "import", snapshot, stdout=StringIO())
        restored = get_user_model().objects.get(username="admin@example.com")
        self.assertTrue(restored.check_password("strong test password"))
        self.assertTrue(restored.is_staff)
        self.assertEqual(Report.objects.get().reference_id, reference)
        self.assertEqual(Report.objects.get().image.name, "reports/existing.jpg")


@override_settings(EVIDENCE_STORAGE_ALIAS="private_evidence", STORAGES={
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "private_evidence": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
})
class CloudEvidenceTransferTests(TestCase):
    def test_copy_verifies_files_and_refuses_conflicting_objects(self):
        from django.core.files.storage import storages
        Report.objects.create(violation_type="Test", description="Example", location="Street",
                              reporter_email="owner@example.com", image="reports/photo.jpg")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "reports").mkdir()
            (root / "reports/photo.jpg").write_bytes(b"original photo")
            for _ in range(2):
                call_command("upload_cloud_evidence", media_root=root, private_root=root, stdout=StringIO())
            self.assertTrue((root / "reports/photo.jpg").is_file())
            storage = storages["default"]
            storage.delete("reports/photo.jpg")
            storage.save("reports/photo.jpg", ContentFile(b"different file"))
            with self.assertRaisesMessage(CommandError, "differs from the local file"):
                call_command("upload_cloud_evidence", media_root=root, private_root=root, stdout=StringIO())
            with storage.open("reports/photo.jpg") as file:
                self.assertEqual(file.read(), b"different file")
