import re
from datetime import timedelta
from smtplib import SMTPException
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from config.network import LocalNetworkHosts


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:3000",
    PASSWORD_RESET_TIMEOUT=900,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    SECURE_SSL_REDIRECT=False,
)
class AdminAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            "officer", email="officer@example.com", password="Old!Password829", is_staff=True,
        )

    def reset_payload(self):
        return {
            "uid": urlsafe_base64_encode(force_bytes(self.user.pk)),
            "token": default_token_generator.make_token(self.user),
            "password": "New!RoadSafety4829",
        }

    def test_login_accepts_email_case_insensitively_but_rejects_wrong_password(self):
        response = self.client.post("/api/admin/login/", {"username": "OFFICER@example.com", "password": "Old!Password829"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "officer")
        self.client.logout()
        response = self.client.post("/api/admin/login/", {"username": "officer@example.com", "password": "wrong"})
        self.assertEqual(response.status_code, 401)

    @override_settings(DEBUG=False, ALLOWED_HOSTS=LocalNetworkHosts(["localhost"]),
                       CSRF_TRUSTED_ORIGINS=[], SECURE_SSL_REDIRECT=True,
                       SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"))
    @patch("config.network.current_lan_addresses", return_value={"192.168.1.72"})
    def test_login_works_on_current_lan_host_through_secure_proxy(self, _addresses):
        client = APIClient(enforce_csrf_checks=True)
        headers = {"HTTP_HOST": "192.168.1.72:3000", "HTTP_ORIGIN": "https://192.168.1.72:3000",
                   "HTTP_X_FORWARDED_PROTO": "https"}
        csrf = client.get("/api/csrf/", **headers)
        self.assertEqual(csrf.status_code, 200)
        response = client.post("/api/admin/login/", {"username": self.user.email, "password": "Old!Password829"},
                               HTTP_X_CSRFTOKEN=csrf.data["csrfToken"], **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get("/api/admin/me/", **headers).status_code, 200)

    def test_reset_email_link_changes_password_and_is_single_use(self):
        response = self.client.post("/api/admin/password-reset/", {"email": "OFFICER@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["officer@example.com"])
        link = re.search(r"http://[^\s]+", mail.outbox[0].body).group()
        self.assertTrue(link.startswith("http://localhost:3000/admin-ctmo?"))
        params = parse_qs(urlparse(link).query)
        payload = {"uid": params["uid"][0], "token": params["token"][0], "password": "New!RoadSafety4829"}
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 200)
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("Old!Password829"))
        login = self.client.post("/api/admin/login/", {"username": self.user.email, "password": payload["password"]})
        self.assertEqual(login.status_code, 200)

    def test_unknown_nonstaff_and_inactive_accounts_do_not_receive_reset_email(self):
        User.objects.create_user("citizen", email="citizen@example.com", password="Some!Password829")
        User.objects.create_user("inactive", email="inactive@example.com", password="Some!Password829", is_staff=True, is_active=False)
        for email in ["unknown@example.com", "citizen@example.com", "inactive@example.com"]:
            self.assertEqual(self.client.post("/api/admin/password-reset/", {"email": email}).status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_invalid_expired_and_weak_password_requests_do_not_change_password(self):
        payload = self.reset_payload()
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", {**payload, "token": "tampered"}).status_code, 400)
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", {**payload, "uid": "!bad"}).status_code, 400)
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", {**payload, "password": "123"}).status_code, 400)
        with patch.object(default_token_generator, "_now", return_value=default_token_generator._now() + timedelta(seconds=901)):
            self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Old!Password829"))

    def test_delivery_failure_is_reported_and_password_unchanged(self):
        with patch("reports.views.send_mail", side_effect=SMTPException("Rejected")):
            response = self.client.post("/api/admin/password-reset/", {"email": self.user.email})
        self.assertEqual(response.status_code, 503)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Old!Password829"))

    def test_reset_link_does_not_grant_nonstaff_access(self):
        payload = self.reset_payload()
        self.user.is_staff = False
        self.user.save(update_fields=["is_staff"])
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 400)

    def test_request_throttle(self):
        for _ in range(10):
            self.assertEqual(self.client.post("/api/admin/password-reset/", {"email": "unknown@example.com"}).status_code, 200)
        blocked = self.client.post("/api/admin/password-reset/", {"email": "unknown@example.com"})
        self.assertEqual(blocked.status_code, 429)
        self.assertLessEqual(int(blocked["Retry-After"]), 300)

    @patch("reports.views.AdminAuthThrottle.timer", return_value=1_000_000)
    def test_login_throttle_clears_after_five_minutes(self, timer):
        for _ in range(10):
            response = self.client.post("/api/admin/login/", {"username": self.user.email, "password": "wrong"})
            self.assertEqual(response.status_code, 401)

        blocked = self.client.post("/api/admin/login/", {"username": self.user.email, "password": "Old!Password829"})
        self.assertEqual(blocked.status_code, 429)
        self.assertLessEqual(int(blocked["Retry-After"]), 300)

        timer.return_value += 301
        allowed = self.client.post("/api/admin/login/", {"username": self.user.email, "password": "Old!Password829"})
        self.assertEqual(allowed.status_code, 200)

    @override_settings(DEBUG=True, FRONTEND_URL="https://192.168.1.46:3000",
                       CORS_ALLOWED_ORIGINS=["https://192.168.1.46:3000", "https://192.168.5.52:3000"])
    @patch("reports.frontend_links.current_lan_addresses", return_value={"192.168.5.52"})
    def test_reset_uses_current_frontend_origin(self, _addresses):
        response = self.client.post("/api/admin/password-reset/", {"email": self.user.email},
                                    HTTP_ORIGIN="https://192.168.5.52:3000")
        self.assertEqual(response.status_code, 200)
        self.assertIn("https://192.168.5.52:3000/admin-ctmo?", mail.outbox[0].body)
