from unittest.mock import patch
from types import SimpleNamespace

from django.contrib import admin
from django.contrib.auth.models import User
from django.core import signing
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .admin import ReportAdmin, AdminActivityAdmin
from .models import AdminActivity, Officer, Report
from .serializers import ReportSerializer


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AdminActivityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user("reviewer", first_name="Anna", last_name="Reyes", is_staff=True)
        self.report = Report.objects.create(violation_type="Obstruction", description="Original details", location="Surigao",
            reporter_email="owner@example.com", image="reports/original.jpg")
        self.client = APIClient()
        self.client.force_authenticate(self.staff)
        self.path = f"/api/reports/{self.report.pk}/"
        self.history = "/api/admin/activity/"

    def test_update_records_real_actor_before_after_and_private_note(self):
        response = self.client.patch(self.path, {"status": "Validated", "assigned_officer": "Officer Santos",
            "admin_note": "  Evidence checked.  ", "actor_name": "Forged admin"})
        self.assertEqual(response.status_code, 200, response.data)
        event = AdminActivity.objects.get()
        self.assertEqual(event.actor, self.staff)
        self.assertEqual(event.actor_name, "Anna Reyes")
        self.assertEqual(event.actor_username, "reviewer")
        self.assertEqual(event.changes["status"], {"before": "Pending", "after": "Validated"})
        self.assertEqual(event.changes["assigned_officer"], {"before": "", "after": "Officer Santos"})
        self.assertEqual(event.notes, "Evidence checked.")
        self.assertNotIn("admin_note", response.data)
        self.assertEqual(self.client.get(self.history).get("Cache-Control"), "private, no-store")

    def test_failed_and_unchanged_saves_do_not_create_events(self):
        self.assertEqual(self.client.patch(self.path, {"status": "Rejected"}).status_code, 400)
        self.assertEqual(self.client.patch(self.path, {"admin_note": "x" * 2001}).status_code, 400)
        self.assertEqual(self.client.patch(self.path, {"status": "Pending"}).status_code, 200)
        self.assertFalse(AdminActivity.objects.exists())
        self.assertEqual(self.client.patch(self.path, {"status": "Validated"}).status_code, 200)
        self.report.refresh_from_db()
        stamp = self.report.public_verified_at
        self.assertEqual(self.client.patch(self.path, {"status": "Validated"}).status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.public_verified_at, stamp)
        self.assertEqual(AdminActivity.objects.count(), 1)

    def test_note_only_save_and_contact_redaction(self):
        self.assertEqual(self.client.patch(self.path, {"admin_note": "Needs follow-up."}).status_code, 200)
        event = AdminActivity.objects.get()
        self.assertEqual(event.action, "note_added")
        self.assertEqual(event.changes, {})
        self.assertEqual(self.client.patch(self.path, {"reporter_email": "new@example.com"}).status_code, 200)
        self.assertEqual(AdminActivity.objects.first().changes["reporter_email"], {"before": "[private]", "after": "[private]"})

    def test_snapshot_uses_current_database_state(self):
        Officer.objects.create(name="New officer", badge="TEST-901", unit="Test unit")
        stale = Report.objects.get(pk=self.report.pk)
        Report.objects.filter(pk=self.report.pk).update(assigned_officer="Earlier officer")
        serializer = ReportSerializer(stale, data={"assigned_officer": "New officer"}, partial=True,
            context={"request": SimpleNamespace(user=self.staff)})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(AdminActivity.objects.get().changes["assigned_officer"], {"before": "Earlier officer", "after": "New officer"})

    def test_audit_failure_rolls_back_case_update(self):
        with patch("reports.activity.AdminActivity.objects.create", side_effect=RuntimeError("Audit unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.patch(self.path, {"status": "Validated"})
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "Pending")
        self.assertIsNone(self.report.public_verified_at)

    def test_evidence_request_logged_once(self):
        path = self.path + "evidence/request/"
        response = self.client.post(path, {"message": "Please add a clear photo."})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.client.post(path, {"message": "Another request"}).status_code, 400)
        event = AdminActivity.objects.get()
        self.assertEqual(event.action, "evidence_requested")
        self.assertEqual(event.notes, "Please add a clear photo.")
        self.assertEqual(event.changes["evidence_request"]["after"], response.data["request"]["id"])

    def test_history_survives_case_and_actor_deletion(self):
        reference = self.report.reference_id
        self.client.patch(self.path, {"admin_note": "Reviewed privately"})
        self.assertEqual(self.client.delete(self.path).status_code, 204)
        self.assertEqual(AdminActivity.objects.count(), 2)
        self.assertTrue(all(event.report_id is None for event in AdminActivity.objects.all()))
        event = AdminActivity.objects.first()
        self.assertEqual(event.action, "case_deleted")
        self.assertEqual(event.report_reference, reference)
        self.staff.delete()
        event.refresh_from_db()
        self.assertIsNone(event.actor_id)
        self.assertEqual(event.actor_name, "Anna Reyes")

    def test_staff_only_read_only_and_private_notes_not_public(self):
        self.client.patch(self.path, {"admin_note": "Private verification note"})
        self.assertEqual(self.client.post(self.history, {}).status_code, 405)
        self.assertEqual(self.client.patch(self.history, {}).status_code, 405)
        self.assertEqual(self.client.delete(self.history).status_code, 405)
        self.client.force_authenticate(None)
        token = signing.dumps({"email": "owner@example.com"}, salt="reports.verified-email")
        self.assertIn(self.client.get(self.history, HTTP_X_REPORT_ACCESS=token).status_code, (401, 403))
        for path in ("/api/reports/", f"/api/reports/by-reference/{self.report.reference_id}/", "/api/reports/my-reports/"):
            response = self.client.get(path, HTTP_X_REPORT_ACCESS=token)
            self.assertNotIn("Private verification note", str(response.data))
            self.assertNotIn("admin_activities", str(response.data))
        self.client.force_authenticate(User.objects.create_user("citizen"))
        self.assertEqual(self.client.get(self.history).status_code, 403)

    def test_filters_pagination_and_validation(self):
        self.client.patch(self.path, {"admin_note": "First private note"})
        self.client.patch(self.path, {"status": "Validated"})
        second = Report.objects.create(violation_type="Other", location="Other street")
        self.client.patch(f"/api/reports/{second.pk}/", {"admin_note": "Other case note"})
        response = self.client.get(self.history, {"report_id": self.report.pk, "page_size": 1})
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNotNone(response.data["next"])
        self.assertEqual(self.client.get(self.history, {"action": "note_added"}).data["count"], 2)
        for query in ("First private", self.report.reference_id):
            self.assertTrue(self.client.get(self.history, {"q": query}).data["count"])
        self.assertEqual(self.client.get(self.history, {"q": "absent"}).data["count"], 0)
        self.assertEqual(self.client.get(self.history, {"report_id": 0}).status_code, 400)
        self.assertEqual(self.client.get(self.history, {"action": "forged"}).status_code, 400)

    def test_django_admin_changes_and_deletes_are_logged_and_history_is_read_only(self):
        request = SimpleNamespace(user=self.staff)
        model_admin = ReportAdmin(Report, admin.site)
        self.report.assigned_officer = "Officer Reyes"
        model_admin.save_model(request, self.report, None, True)
        self.assertEqual(AdminActivity.objects.get().changes["assigned_officer"]["after"], "Officer Reyes")
        model_admin.delete_queryset(request, Report.objects.filter(pk=self.report.pk))
        self.assertEqual(AdminActivity.objects.count(), 2)
        history_admin = AdminActivityAdmin(AdminActivity, admin.site)
        self.assertFalse(history_admin.has_add_permission(request))
        self.assertFalse(history_admin.has_change_permission(request))
        self.assertFalse(history_admin.has_delete_permission(request))
