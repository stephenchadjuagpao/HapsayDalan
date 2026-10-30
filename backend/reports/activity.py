from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser

from .models import AdminActivity, Report


AUDITED_FIELDS = ("status", "assigned_officer", "rejection_reason", "rejection_details", "public_verified_at",
                  "violation_type", "description", "location", "latitude", "longitude", "occurred_at", "image",
                  "reporter_email", "reporter_phone", "reporter_latitude", "reporter_longitude",
                  "location_source", "location_accuracy", "location_captured_at")
PRIVATE_FIELDS = {"reporter_email", "reporter_phone"}


def report_snapshot(report):
    def value(field):
        item = getattr(report, field)
        if isinstance(item, (date, datetime)):
            return item.isoformat()
        if isinstance(item, Decimal):
            return str(item)
        if field == "image":
            return item.name if item else ""
        return item
    return {field: value(field) for field in AUDITED_FIELDS}


def record_admin_activity(actor, report, action, before=None, after=None, notes=""):
    if not actor or not actor.is_authenticated or not actor.is_staff:
        return None
    before, after = before or {}, after or {}
    changes = {}
    for field in sorted(before.keys() | after.keys()):
        old, new = before.get(field), after.get(field)
        if old != new:
            # Record that contact information changed without retaining old contact details.
            changes[field] = {"before": "[private]" if field in PRIVATE_FIELDS and old else old,
                              "after": "[private]" if field in PRIVATE_FIELDS and new else new}
    notes = notes.strip()
    if action == "case_updated" and not changes:
        if not notes:
            return None
        action = "note_added"
    return AdminActivity.objects.create(actor=actor, actor_name=(actor.get_full_name().strip() or actor.get_username())[:255],
                                        actor_username=actor.get_username(), report=report,
                                        report_reference=report.reference_id or f"SUP-{report.pk}", action=action,
                                        changes=changes, notes=notes)


def delete_with_activity(report, actor):
    with transaction.atomic():
        report = Report.objects.select_for_update().get(pk=report.pk)
        record_admin_activity(actor, report, "case_deleted", before=report_snapshot(report))
        report.delete()


class ActivityQuery(serializers.Serializer):
    q = serializers.CharField(max_length=200, required=False, allow_blank=True)
    action = serializers.ChoiceField(choices=[("", "All actions"), *AdminActivity.ACTIONS], required=False)
    report_id = serializers.IntegerField(min_value=1, required=False)


class ActivitySerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AdminActivity
        fields = ["id", "actor_name", "actor_username", "report_id", "report_reference", "action", "action_label", "changes", "notes", "created_at"]
        read_only_fields = fields


class ActivityPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_activity_history(request):
    query = ActivityQuery(data=request.query_params)
    query.is_valid(raise_exception=True)
    values = query.validated_data
    history = AdminActivity.objects.all()
    if values.get("q"):
        term = values["q"]
        history = history.filter(Q(report_reference__icontains=term) | Q(actor_name__icontains=term) |
                                 Q(actor_username__icontains=term) | Q(notes__icontains=term))
    if values.get("action"):
        history = history.filter(action=values["action"])
    if values.get("report_id"):
        history = history.filter(report_id=values["report_id"])
    paginator = ActivityPagination()
    rows = paginator.paginate_queryset(history, request)
    response = paginator.get_paginated_response(ActivitySerializer(rows, many=True).data)
    response["Cache-Control"] = "private, no-store"
    return response
