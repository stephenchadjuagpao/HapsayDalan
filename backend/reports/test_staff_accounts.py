from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from smtplib import SMTPException
from unittest.mock import patch


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="ctmo@example.com",
    FRONTEND_URL="http://localhost:3000",
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class StaffAccountTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_superuser("owner", "owner@example.com", "Owner!Password829")
        self.officer = User.objects.create_user("officer", "officer@example.com", "Officer!Password829", is_staff=True)

    def test_only_superuser_can_manage_accounts(self):
        self.assertEqual(self.client.get("/api/admin/staff/").status_code, 403)
        self.client.force_login(self.officer)
        self.assertEqual(self.client.get("/api/admin/me/").data["is_superuser"], False)
        self.assertEqual(self.client.get("/api/admin/staff/").status_code, 403)
        self.assertEqual(self.client.post("/api/admin/staff/", {"name": "New Officer", "email": "new@example.com"}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/admin/staff/{self.officer.pk}/invite/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/admin/staff/{self.owner.pk}/", {"is_active": False}, format="json").status_code, 403)

    def test_invite_creates_staff_login_and_can_disable_it(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get("/api/admin/me/").data["is_superuser"], True)
        response = self.client.post("/api/admin/staff/", {"name": "Maria Dela Cruz", "email": "Maria@example.com"})
        self.assertEqual(response.status_code, 201)
        account = User.objects.get(email="maria@example.com")
        self.assertTrue(account.is_staff)
        self.assertFalse(account.is_superuser)
        self.assertEqual(len(mail.outbox), 1)
        link = next(part for part in mail.outbox[0].body.split() if part.startswith("http://"))
        params = parse_qs(urlparse(link).query)
        reset = self.client.post("/api/admin/password-reset/confirm/", {
            "uid": params["uid"][0], "token": params["token"][0], "password": "New!RoadSafety4829",
        })
        self.assertEqual(reset.status_code, 200)
        self.client.logout()
        login = self.client.post("/api/admin/login/", {"username": "maria@example.com", "password": "New!RoadSafety4829"})
        self.assertEqual(login.status_code, 200)
        self.client.logout()
        self.client.force_login(self.owner)
        self.assertEqual(self.client.patch(f"/api/admin/staff/{account.pk}/", {"is_active": False}, format="json").status_code, 200)
        self.client.logout()
        self.assertEqual(self.client.post("/api/admin/login/", {"username": "maria@example.com", "password": "New!RoadSafety4829"}).status_code, 401)

    def test_duplicate_email_and_owner_protection(self):
        self.client.force_login(self.owner)
        response = self.client.post("/api/admin/staff/", {"name": "Duplicate", "email": "OFFICER@example.com"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.patch(f"/api/admin/staff/{self.owner.pk}/", {"is_active": False}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/admin/staff/{self.officer.pk}/", {"is_superuser": True}, format="json").status_code, 400)

    def test_failed_invitation_leaves_no_account(self):
        self.client.force_login(self.owner)
        with patch("reports.staff_accounts.send_mail", side_effect=SMTPException("Rejected")):
            response = self.client.post("/api/admin/staff/", {"name": "New Officer", "email": "new@example.com"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_logout_ends_server_session(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get("/api/admin/me/").status_code, 200)
        self.assertEqual(self.client.post("/api/admin/logout/").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/me/").status_code, 403)

    @override_settings(DEBUG=True, FRONTEND_URL="https://192.168.1.46:3000",
                       CORS_ALLOWED_ORIGINS=["https://192.168.1.46:3000", "https://192.168.5.52:3000"])
    @patch("reports.frontend_links.current_lan_addresses", return_value={"192.168.5.52"})
    def test_invitation_uses_current_frontend_origin(self, _addresses):
        self.client.force_login(self.owner)
        response = self.client.post("/api/admin/staff/", {"name": "New Officer", "email": "new@example.com"},
                                    HTTP_ORIGIN="https://192.168.5.52:3000")
        self.assertEqual(response.status_code, 201)
        self.assertIn("https://192.168.5.52:3000/admin-ctmo?", mail.outbox[0].body)

    @override_settings(DEBUG=True, FRONTEND_URL="https://192.168.5.52:3000",
                       CORS_ALLOWED_ORIGINS=["https://192.168.5.52:3000"])
    @patch("reports.frontend_links.current_lan_addresses", return_value={"192.168.5.52"})
    def test_invitation_rejects_untrusted_origin(self, _addresses):
        self.client.force_login(self.owner)
        response = self.client.post("/api/admin/staff/", {"name": "New Officer", "email": "new@example.com"},
                                    HTTP_ORIGIN="https://evil.example")
        self.assertEqual(response.status_code, 201)
        self.assertIn("https://192.168.5.52:3000/admin-ctmo?", mail.outbox[0].body)

    @override_settings(DEBUG=True, FRONTEND_URL="https://192.168.1.46:3000",
                       CORS_ALLOWED_ORIGINS=["https://192.168.1.46:3000", "https://192.168.5.52:3000"])
    @patch("reports.frontend_links.current_lan_addresses", return_value={"192.168.5.52"})
    def test_resend_link_uses_current_frontend_origin(self, _addresses):
        self.client.force_login(self.owner)
        response = self.client.post(f"/api/admin/staff/{self.officer.pk}/invite/",
                                    HTTP_ORIGIN="https://192.168.5.52:3000")
        self.assertEqual(response.status_code, 200)
        self.assertIn("https://192.168.5.52:3000/admin-ctmo?", mail.outbox[0].body)
