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

    def test_full_announcement_workflow_and_interactions(self):
        self.client.force_authenticate(self.staff)
        # Create full announcement
        payload = {
            "title": "Emergency Bridge Repair",
            "category": "Construction",
            "message": "Major construction work along Bilang-Bilang bridge.",
            "affected_location": "Bilang-Bilang St. / Boulevard",
            "alternative_route": "Use Borromeo St.",
            "is_pinned": True,
            "status": "published",
        }
        create_res = self.client.post("/api/admin/advisories/", payload)
        self.assertEqual(create_res.status_code, 201)
        advisory_id = create_res.data["id"]
        self.assertTrue(create_res.data["is_pinned"])
        self.assertEqual(create_res.data["category"], "Construction")

        # Public feed can see published announcement
        self.client.force_authenticate(user=None)
        public_res = self.client.get("/api/advisories/?page=1")
        self.assertEqual(public_res.status_code, 200)
        self.assertGreaterEqual(public_res.data["count"], 1)
        first_item = public_res.data["results"][0]
        self.assertEqual(first_item["title"], "Emergency Bridge Repair")
        self.assertEqual(first_item["affected_location"], "Bilang-Bilang St. / Boulevard")

        # Test Citizen Like / Unlike
        like_res = self.client.post(f"/api/advisories/{advisory_id}/like/", HTTP_X_CLIENT_ID="citizen-browser-123")
        self.assertEqual(like_res.status_code, 200)
        self.assertTrue(like_res.data["liked"])
        self.assertEqual(like_res.data["likes_count"], 1)

        unlike_res = self.client.post(f"/api/advisories/{advisory_id}/like/", HTTP_X_CLIENT_ID="citizen-browser-123")
        self.assertEqual(unlike_res.status_code, 200)
        self.assertFalse(unlike_res.data["liked"])
        self.assertEqual(unlike_res.data["likes_count"], 0)

        # Test Citizen Comments
        comment_payload = {"author_name": "Juan Dela Cruz", "comment": "Salamat sa pahibalo CTMO!"}
        comm_res = self.client.post(f"/api/advisories/{advisory_id}/comments/", comment_payload)
        self.assertEqual(comm_res.status_code, 201)
        self.assertEqual(comm_res.data["author_name"], "Juan Dela Cruz")

        list_comm = self.client.get(f"/api/advisories/{advisory_id}/comments/")
        self.assertEqual(list_comm.status_code, 200)
        self.assertEqual(len(list_comm.data), 1)

        # Test Draft Visibility: public cannot see drafts
        self.client.force_authenticate(self.staff)
        draft_res = self.client.post("/api/admin/advisories/", {
            "title": "Secret Draft Notice",
            "message": "Not yet public",
            "status": "draft",
        })
        self.assertEqual(draft_res.status_code, 201)
        draft_id = draft_res.data["id"]

        self.client.force_authenticate(user=None)
        feed_items = self.client.get("/api/advisories/")
        feed_titles = [row["title"] for row in (feed_items.data if isinstance(feed_items.data, list) else feed_items.data.get("results", []))]
        self.assertNotIn("Secret Draft Notice", feed_titles)

        # Admin can pin/unpin, edit, and delete
        self.client.force_authenticate(self.staff)
        pin_res = self.client.patch(f"/api/admin/advisories/{advisory_id}/pin/", {"is_pinned": False})
        self.assertEqual(pin_res.status_code, 200)
        self.assertFalse(pin_res.data["is_pinned"])

        edit_res = self.client.patch(f"/api/admin/advisories/{advisory_id}/", {"title": "Updated Bridge Repair"})
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.data["title"], "Updated Bridge Repair")

        del_res = self.client.delete(f"/api/admin/advisories/{draft_id}/")
        self.assertEqual(del_res.status_code, 204)
        self.assertFalse(TrafficAdvisory.objects.filter(pk=draft_id).exists())

    def test_published_advisories_remain_visible_until_archived(self):
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        # Active advisory (ends tomorrow)
        TrafficAdvisory.objects.create(
            title="Active Advisory",
            message="Road ongoing repairs",
            status="published",
            audience="public",
            end_datetime=now + timedelta(days=1),
            created_by=self.staff
        )
        # Concluded past advisory (ended yesterday) - should remain visible in feed until archived
        TrafficAdvisory.objects.create(
            title="Concluded Advisory",
            message="Old road closure",
            status="published",
            audience="public",
            end_datetime=now - timedelta(days=1),
            created_by=self.staff
        )
        # Archived advisory - should be hidden from public
        TrafficAdvisory.objects.create(
            title="Archived Advisory",
            message="Hidden by CTMO admin",
            status="published",
            audience="public",
            archived_at=now,
            created_by=self.staff
        )

        public_res = self.client.get("/api/advisories/")
        self.assertEqual(public_res.status_code, 200)
        titles = [item["title"] for item in public_res.data]
        self.assertIn("Active Advisory", titles)
        self.assertIn("Concluded Advisory", titles)
        self.assertNotIn("Archived Advisory", titles)

    def test_scheduled_upcoming_advisory_is_visible_immediately(self):
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        TrafficAdvisory.objects.create(
            title="Upcoming Rerouting Tomorrow",
            message="Road rerouting starts tomorrow at 8am",
            status="published",
            audience="public",
            start_datetime=now + timedelta(days=1),
            created_by=self.staff
        )
        res = self.client.get("/api/advisories/")
        self.assertEqual(res.status_code, 200)
        titles = [item["title"] for item in res.data]
        self.assertIn("Upcoming Rerouting Tomorrow", titles)

