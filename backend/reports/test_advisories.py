from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import TrafficAdvisory


class TrafficAdvisoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user("dispatcher", is_staff=True)

    def test_audiences_and_archive_control_visibility(self):
        self.client.force_authenticate(self.staff)
        for audience in ("all", "public", "officers"):
            response = self.client.post("/api/admin/advisories/", {"message": f" {audience} update ", "audience": audience})
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["message"], f"{audience} update")
        self.assertEqual(TrafficAdvisory.objects.count(), 3)
        self.assertEqual(len(self.client.get("/api/admin/advisories/").data), 3)
        self.client.force_authenticate(user=None)
        public = self.client.get("/api/advisories/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual({row["audience"] for row in public.data}, {"all", "public"})
        self.assertEqual(public["Cache-Control"], "no-store")
        self.client.force_authenticate(self.staff)
        item = TrafficAdvisory.objects.get(audience="all")
        response = self.client.patch(f"/api/admin/advisories/{item.pk}/archive/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["archived_at"])
        self.assertEqual({row["audience"] for row in self.client.get("/api/advisories/").data}, {"public"})
        history = self.client.get("/api/admin/advisories/?status=all")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data["count"], 3)
        self.assertEqual(len(history.data["results"]), 3)
        self.assertEqual(sum(row["archived_at"] is not None for row in history.data["results"]), 1)
        self.assertEqual(history["Cache-Control"], "private, no-store")

    def test_only_staff_can_publish_or_archive(self):
        item = TrafficAdvisory.objects.create(message="Road closed", audience="public", created_by=self.staff)
        for user in (None, User.objects.create_user("citizen")):
            self.client.force_authenticate(user)
            self.assertIn(self.client.get("/api/admin/advisories/").status_code, (401, 403))
            self.assertIn(self.client.get("/api/admin/advisories/?status=all").status_code, (401, 403))
            self.assertIn(self.client.post("/api/admin/advisories/", {"message": "Fake alert", "audience": "all"}).status_code, (401, 403))
            self.assertIn(self.client.patch(f"/api/admin/advisories/{item.pk}/archive/").status_code, (401, 403))
        self.assertEqual(TrafficAdvisory.objects.count(), 1)
        item.refresh_from_db()
        self.assertIsNone(item.archived_at)

    def test_blank_overlong_or_invalid_advisories_are_rejected(self):
        self.client.force_authenticate(self.staff)
        for payload in ({"message": "   ", "audience": "all"},
                        {"message": "x" * 1001, "audience": "all"},
                        {"message": "Road closed", "audience": "unknown"}):
            response = self.client.post("/api/admin/advisories/", payload)
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(TrafficAdvisory.objects.exists())

    def test_history_paginates_all_advisories(self):
        TrafficAdvisory.objects.bulk_create([
            TrafficAdvisory(message=f"Advisory {number}", audience="public", created_by=self.staff)
            for number in range(23)
        ])
        self.client.force_authenticate(self.staff)
        first = self.client.get("/api/admin/advisories/?status=all")
        second = self.client.get("/api/admin/advisories/?status=all&page=2")
        self.assertEqual(first.data["count"], 23)
        self.assertEqual(len(first.data["results"]), 20)
        self.assertEqual(len(second.data["results"]), 3)
