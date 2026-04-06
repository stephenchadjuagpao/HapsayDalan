from django.contrib import admin

from .models import Report


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
