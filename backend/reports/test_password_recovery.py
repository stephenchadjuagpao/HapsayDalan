import re
from datetime import timedelta
from smtplib import SMTPException
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AdminPasswordResetChallenge


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
                   PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
                   SECURE_SSL_REDIRECT=False, PASSWORD_RESET_TIMEOUT=900)
class PasswordCodeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user("officer", email="officer@example.com",
                                             password="Old!Password829", is_staff=True)

    def request_code(self, email="OFFICER@example.com"):
        return self.client.post("/api/admin/password-reset/code/", {"email": email})

    def verify(self, challenge, code):
        return self.client.post("/api/admin/password-reset/code/verify/", {"challenge_id": challenge, "code": code})

    def begin(self):
        response = self.request_code()
        self.assertEqual(response.status_code, 200)
        code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        return response.data["challenge_id"], code

    def test_code_exchange_and_password_reset_are_single_use(self):
        challenge, code = self.begin()
        stored = AdminPasswordResetChallenge.objects.get(pk=challenge)
        self.assertNotIn(code, stored.code_hash)
        response = self.verify(challenge, code)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(self.verify(challenge, code).status_code, 400)
        payload = {**response.data, "password": "New!RoadSafety4829"}
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 200)
        self.assertEqual(self.client.post("/api/admin/password-reset/confirm/", payload).status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(payload["password"]))

    def test_unknown_inactive_nonstaff_and_duplicate_accounts_do_not_receive_codes(self):
        known = self.request_code()
        for email, flags in [("unknown@example.com", None), ("inactive@example.com", {"is_active": False, "is_staff": True}),
                             ("public@example.com", {"is_staff": False}), ("duplicate@example.com", {"is_staff": True})]:
            if flags:
                User.objects.create_user(email, email=email, password="Old!Password829", **flags)
                if email.startswith("duplicate"):
                    User.objects.create_user("second", email=email, password="Other!Password829", is_staff=True)
            response = self.request_code(email)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.data), set(known.data))
            self.assertEqual(response.data["detail"], known.data["detail"])
            self.assertEqual(self.verify(response.data["challenge_id"], "123456").status_code, 400)
        self.assertEqual(len(mail.outbox), 1)

    def test_wrong_codes_lock_after_five_attempts(self):
        challenge, code = self.begin()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.verify(challenge, wrong).status_code, 400)
        self.assertEqual(self.verify(challenge, code).status_code, 400)

    def test_expiry_and_changed_password_reject_code(self):
        challenge, code = self.begin()
        AdminPasswordResetChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.verify(challenge, code).status_code, 400)
        AdminPasswordResetChallenge.objects.filter(pk=challenge).update(expires_at=timezone.now()+timedelta(minutes=10))
        self.user.set_password("Changed!Password829")
        self.user.save()
        self.assertEqual(self.verify(challenge, code).status_code, 400)

    def test_resend_cooldown_and_replacement(self):
        challenge, code = self.begin()
        self.assertEqual(self.request_code().status_code, 429)
        AdminPasswordResetChallenge.objects.filter(pk=challenge).update(created_at=timezone.now()-timedelta(seconds=61))
        replacement = self.request_code()
        self.assertEqual(replacement.status_code, 200)
        self.assertEqual(self.verify(challenge, code).status_code, 400)
        self.assertEqual(len(mail.outbox), 2)

    def test_delivery_failure_cannot_be_redeemed(self):
        with patch("reports.password_recovery.send_mail", side_effect=SMTPException("Rejected")):
            self.assertEqual(self.request_code().status_code, 503)
        self.assertTrue(AdminPasswordResetChallenge.objects.get().used)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Old!Password829"))

    def test_disabled_staff_and_malformed_codes_are_rejected(self):
        challenge, code = self.begin()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.verify(challenge, code).status_code, 400)
        self.assertEqual(self.verify("not-a-uuid", code).status_code, 400)
        self.assertEqual(self.verify(challenge, "123").status_code, 400)
