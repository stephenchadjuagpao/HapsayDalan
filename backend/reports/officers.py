from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .activity import record_admin_activity, report_snapshot
from .models import Officer, Report


class OfficerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Officer
        fields = ["id", "name", "badge", "unit"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        for field in ("name", "badge"):
            if field not in attrs:
                continue
            matches = Officer.objects.filter(**{f"{field}__iexact": attrs[field]})
            if self.instance:
                matches = matches.exclude(pk=self.instance.pk)
            if matches.exists():
                raise serializers.ValidationError({field: f"An officer already uses this {field}."})
        return attrs


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def officers(request):
    if request.method == "GET":
        return Response(OfficerSerializer(Officer.objects.all(), many=True).data)
    serializer = OfficerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            serializer.save()
    except IntegrityError:
        return Response({"detail": "This officer name or badge is already in use."}, status=400)
    return Response(serializer.data, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminUser])
def officer_detail(request, officer_id):
    try:
        with transaction.atomic():
            officer = get_object_or_404(Officer.objects.select_for_update(), pk=officer_id)
            reports = Report.objects.filter(assigned_officer__iexact=officer.name)
            if request.method == "DELETE":
                if reports.exclude(status__in=["Resolved", "Rejected"]).exists():
                    return Response({"detail": "This officer has active cases. Reassign or resolve them before deleting the officer."}, status=409)
                # Closed cases retain their assigned officer name and audit history.
                officer.delete()
                return Response(status=204)
            serializer = OfficerSerializer(officer, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            old_name = officer.name
            officer = serializer.save()
            if officer.name != old_name:
                for report in reports.select_for_update():
                    before = report_snapshot(report)
                    report.assigned_officer = officer.name
                    report.save(update_fields=["assigned_officer", "updated_at"])
                    record_admin_activity(request.user, report, "case_updated", before, report_snapshot(report),
                                          "Assigned officer name updated in officer directory.")
    except IntegrityError:
        return Response({"detail": "This officer name or badge is already in use."}, status=400)
    return Response(serializer.data)
