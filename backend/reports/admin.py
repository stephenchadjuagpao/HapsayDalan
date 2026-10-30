from django.contrib import admin

from .models import Report, AdminActivity
from .activity import record_admin_activity, report_snapshot, delete_with_activity
from django.db import transaction


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "violation_type",
        "status",
        "assigned_officer",
        "location",
        "date_reported",
        "updated_at",
    )
    list_filter = ("status", "date_reported", "updated_at")
    search_fields = ("violation_type", "location", "assigned_officer", "description")

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            before = report_snapshot(Report.objects.select_for_update().get(pk=obj.pk)) if change else None
            super().save_model(request, obj, form, change)
            record_admin_activity(request.user, obj, "case_updated" if change else "case_created", before, report_snapshot(obj))

    def delete_model(self, request, obj):
        delete_with_activity(obj, request.user)

    def delete_queryset(self, request, queryset):
        with transaction.atomic():
            for report in queryset.select_for_update():
                delete_with_activity(report, request.user)


@admin.register(AdminActivity)
class AdminActivityAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor_name", "report_reference", "action")
    list_filter = ("action", "created_at")
    search_fields = ("actor_name", "actor_username", "report_reference", "notes")
    readonly_fields = tuple(field.name for field in AdminActivity._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
