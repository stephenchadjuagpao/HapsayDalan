from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import TrafficAdvisory


class TrafficAdvisorySerializer(serializers.ModelSerializer):
    message = serializers.CharField(max_length=1000, trim_whitespace=True)

    class Meta:
        model = TrafficAdvisory
        fields = ["id", "message", "audience", "created_at", "archived_at"]
        read_only_fields = ["id", "created_at", "archived_at"]


@api_view(["GET"])
@permission_classes([AllowAny])
def public_advisories(request):
    rows = TrafficAdvisory.objects.filter(archived_at__isnull=True, audience__in=["all", "public"])[:5]
    response = Response(TrafficAdvisorySerializer(rows, many=True).data)
    response["Cache-Control"] = "no-store"
    return response


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def admin_advisories(request):
    if request.method == "POST":
        serializer = TrafficAdvisorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        advisory = serializer.save(created_by=request.user)
        response = Response(TrafficAdvisorySerializer(advisory).data, status=201)
    else:
        if request.query_params.get("status") == "all":
            paginator = PageNumberPagination()
            paginator.page_size = 20
            rows = paginator.paginate_queryset(TrafficAdvisory.objects.all(), request)
            response = paginator.get_paginated_response(TrafficAdvisorySerializer(rows, many=True).data)
        else:
            rows = TrafficAdvisory.objects.filter(archived_at__isnull=True)[:20]
            response = Response(TrafficAdvisorySerializer(rows, many=True).data)
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def archive_advisory(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    if advisory.archived_at is None:
        advisory.archived_at = timezone.now()
        advisory.save(update_fields=["archived_at"])
    response = Response(TrafficAdvisorySerializer(advisory).data)
    response["Cache-Control"] = "private, no-store"
    return response
