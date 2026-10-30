from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.pagination import PageNumberPagination
from .models import SupportMessage


class SupportMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportMessage
        fields = ["id", "name", "email", "subject", "message", "created_at", "read_at"]
        read_only_fields = ["id", "created_at", "read_at"]


class MessageThrottle(SimpleRateThrottle):
    scope = "support-message"
    rate = "5/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([MessageThrottle])
def send_support_message(request):
    serializer = SupportMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"detail": "Your message has been sent to the CTMO support team."}, status=201)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def support_inbox(request):
    paginator = PageNumberPagination()
    paginator.page_size = 20
    rows = paginator.paginate_queryset(SupportMessage.objects.all(), request)
    response = paginator.get_paginated_response(SupportMessageSerializer(rows, many=True).data)
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def read_support_message(request, message_id):
    message = get_object_or_404(SupportMessage, pk=message_id)
    if message.read_at is None:
        message.read_at = timezone.now()
        message.save(update_fields=["read_at"])
    response = Response(SupportMessageSerializer(message).data)
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["GET"])
@permission_classes([IsAdminUser])
def unread_message_count(request):
    response = Response({"unread_count": SupportMessage.objects.filter(read_at__isnull=True).count()})
    response["Cache-Control"] = "private, no-store"
    return response
