from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from .models import SupportMessage


class SupportMessageTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.payload = {"name": " Citizen ", "email": "citizen@example.com", "subject": "Tracking help", "message": "Cannot find my report."}

    def test_public_submission_is_saved_and_staff_can_read_it(self):
        response = self.client.post("/api/support/messages/", self.payload)
        self.assertEqual(response.status_code, 201, response.data)
        item = SupportMessage.objects.get()
        self.assertEqual(item.name, "Citizen")
        self.assertIsNone(item.read_at)
        self.assertNotIn("email", response.data)
        staff = User.objects.create_user("support", is_staff=True)
        self.client.force_authenticate(staff)
        inbox = self.client.get("/api/admin/messages/")
        self.assertEqual(inbox.data["results"][0]["message"], self.payload["message"])
        self.assertEqual(inbox["Cache-Control"], "private, no-store")
        url = f"/api/admin/messages/{item.pk}/read/"
        self.assertEqual(self.client.patch(url).status_code, 200)
        item.refresh_from_db()
        stamp = item.read_at
        self.assertIsNotNone(stamp)
        self.client.patch(url)
        item.refresh_from_db()
        self.assertEqual(item.read_at, stamp)

    def test_private_inbox_and_read_updates_require_staff(self):
        item = SupportMessage.objects.create(**self.payload)
        for user in [None, User.objects.create_user("citizen")]:
            self.client.force_authenticate(user)
            self.assertIn(self.client.get("/api/admin/messages/").status_code, [401, 403])
            self.assertIn(self.client.patch(f"/api/admin/messages/{item.pk}/read/").status_code, [401, 403])
        item.refresh_from_db()
        self.assertIsNone(item.read_at)
        self.assertEqual(self.client.get("/api/support/messages/").status_code, 405)

    def test_required_fields_and_lengths(self):
        for changes in [{"name": " "}, {"email": "invalid"}, {"subject": " "}, {"message": " "}, {"message": "x" * 5001}]:
            cache.clear()
            response = self.client.post("/api/support/messages/", {**self.payload, **changes})
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(SupportMessage.objects.exists())

    def test_submission_rate_limit(self):
        for _ in range(5):
            self.assertEqual(self.client.post("/api/support/messages/", self.payload).status_code, 201)
        self.assertEqual(self.client.post("/api/support/messages/", self.payload).status_code, 429)
        self.assertEqual(SupportMessage.objects.count(), 5)

    def test_unread_count_is_private_counts_all_pages_and_updates_after_reading(self):
        path = "/api/admin/messages/unread-count/"
        self.assertIn(self.client.get(path).status_code, [401, 403])
        self.client.force_authenticate(User.objects.create_user("reader", is_staff=True))
        SupportMessage.objects.bulk_create([SupportMessage(**self.payload) for _ in range(21)])
        response = self.client.get(path)
        self.assertEqual(response.data, {"unread_count": 21})
        self.assertEqual(response["Cache-Control"], "private, no-store")
        item = SupportMessage.objects.first()
        self.client.patch(f"/api/admin/messages/{item.pk}/read/")
        self.assertEqual(self.client.get(path).data["unread_count"], 20)
