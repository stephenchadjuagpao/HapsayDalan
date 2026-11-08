from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import TrafficAdvisory, TrafficAdvisoryComment, TrafficAdvisoryReaction


class TrafficAdvisoryCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficAdvisoryComment
        fields = ["id", "advisory", "author_name", "comment", "created_at"]
        read_only_fields = ["id", "advisory", "created_at"]


class TrafficAdvisorySerializer(serializers.ModelSerializer):
    message = serializers.CharField(max_length=1000, trim_whitespace=True, required=False, allow_blank=True)
    media_url = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    recent_comments = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TrafficAdvisory
        fields = [
            "id", "title", "category", "message", "affected_location",
            "alternative_route", "media", "media_url", "start_datetime",
            "end_datetime", "is_pinned", "status", "likes_count",
            "comments_count", "recent_comments", "audience",
            "created_by", "created_by_name", "created_at", "updated_at", "archived_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "media_url", "comments_count", "recent_comments", "created_by_name"]

    def get_media_url(self, obj):
        if not obj.media:
            return None
        request = self.context.get("request")
        if request:
            try:
                return request.build_absolute_uri(obj.media.url)
            except Exception:
                return obj.media.url
        return obj.media.url

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_recent_comments(self, obj):
        comments = obj.comments.all().order_by("-created_at")[:5]
        return TrafficAdvisoryCommentSerializer(comments, many=True).data

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return "CTMO Administrator"
        full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return full or obj.created_by.username or "CTMO Administrator"

    def validate(self, attrs):
        title = (attrs.get("title") or "").strip()
        message = (attrs.get("message") or "").strip()
        if not title and not message:
            raise serializers.ValidationError({"message": ["Please provide an announcement title or description."]})
        if not message:
            attrs["message"] = title
        if not title:
            attrs["title"] = message[:60]
        if "audience" not in attrs:
            attrs["audience"] = "all"
        return attrs


def get_client_id(request):
    client_id = request.headers.get("X-Client-ID") or request.data.get("client_id")
    if client_id:
        return str(client_id)[:64]
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()[:64]
    return request.META.get("REMOTE_ADDR", "unknown")[:64]


@api_view(["GET"])
@permission_classes([AllowAny])
def public_advisories(request):
    qs = TrafficAdvisory.objects.filter(
        archived_at__isnull=True,
        status="published"
    ).exclude(
        audience="officers"
    )

    # Category filter
    category = request.query_params.get("category")
    if category and category.lower() != "all":
        qs = qs.filter(category__iexact=category)

    # Search filter
    q = request.query_params.get("q")
    if q and q.strip():
        term = q.strip()
        qs = qs.filter(
            Q(title__icontains=term) |
            Q(message__icontains=term) |
            Q(affected_location__icontains=term) |
            Q(alternative_route__icontains=term)
        )

    qs = qs.order_by("-is_pinned", "-created_at", "-pk")

    if "page" in request.query_params or "page_size" in request.query_params:
        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get("page_size", 10))
        paginator.page_size_query_param = "page_size"
        paginator.max_page_size = 50
        rows = paginator.paginate_queryset(qs, request)
        serializer = TrafficAdvisorySerializer(rows, many=True, context={"request": request})
        response = paginator.get_paginated_response(serializer.data)
    else:
        rows = qs[:50]
        serializer = TrafficAdvisorySerializer(rows, many=True, context={"request": request})
        response = Response(serializer.data)
    response["Cache-Control"] = "no-store"
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def like_advisory(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    client_id = get_client_id(request)
    reaction, created = TrafficAdvisoryReaction.objects.get_or_create(
        advisory=advisory,
        client_id=client_id,
        defaults={"reaction": "like"}
    )
    if not created:
        reaction.delete()
        if advisory.likes_count > 0:
            advisory.likes_count -= 1
            advisory.save(update_fields=["likes_count"])
        liked = False
    else:
        advisory.likes_count += 1
        advisory.save(update_fields=["likes_count"])
        liked = True

    response = Response({
        "liked": liked,
        "likes_count": advisory.likes_count,
        "advisory_id": advisory.id,
    })
    response["Cache-Control"] = "no-store"
    return response


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def advisory_comments(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    if request.method == "POST":
        author_name = (request.data.get("author_name") or "Citizen").strip()[:100]
        comment_text = (request.data.get("comment") or "").strip()
        if not comment_text:
            return Response({"comment": ["Comment cannot be empty."]}, status=400)
        comment_obj = TrafficAdvisoryComment.objects.create(
            advisory=advisory,
            author_name=author_name or "Citizen",
            comment=comment_text[:1000],
        )
        serializer = TrafficAdvisoryCommentSerializer(comment_obj)
        return Response(serializer.data, status=201)

    comments = advisory.comments.all().order_by("created_at")
    serializer = TrafficAdvisoryCommentSerializer(comments, many=True)
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def admin_advisories(request):
    if request.method == "POST":
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        serializer = TrafficAdvisorySerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        advisory = serializer.save(created_by=request.user)
        response = Response(TrafficAdvisorySerializer(advisory, context={"request": request}).data, status=201)
    else:
        qs = TrafficAdvisory.objects.all()
        status_param = request.query_params.get("status")
        if status_param == "all":
            pass
        elif status_param in ["published", "draft", "scheduled"]:
            qs = qs.filter(status=status_param, archived_at__isnull=True)
        elif status_param == "archived":
            qs = qs.filter(archived_at__isnull=False)
        else:
            qs = qs.filter(archived_at__isnull=True)

        category = request.query_params.get("category")
        if category and category.lower() != "all":
            qs = qs.filter(category__iexact=category)

        q = request.query_params.get("q")
        if q and q.strip():
            term = q.strip()
            qs = qs.filter(
                Q(title__icontains=term) |
                Q(message__icontains=term) |
                Q(affected_location__icontains=term) |
                Q(alternative_route__icontains=term)
            )

        qs = qs.order_by("-is_pinned", "-created_at", "-pk")

        if status_param == "all" or "page" in request.query_params:
            paginator = PageNumberPagination()
            paginator.page_size = int(request.query_params.get("page_size", 20))
            rows = paginator.paginate_queryset(qs, request)
            serializer = TrafficAdvisorySerializer(rows, many=True, context={"request": request})
            response = paginator.get_paginated_response(serializer.data)
        else:
            rows = qs[:50]
            serializer = TrafficAdvisorySerializer(rows, many=True, context={"request": request})
            response = Response(serializer.data)
    response["Cache-Control"] = "private, no-store"
    return response


@api_view(["GET", "PATCH", "PUT", "DELETE"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def admin_advisory_detail(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    if request.method == "DELETE":
        advisory.delete()
        return Response({"detail": "Advisory deleted successfully."}, status=204)
    if request.method in ["PATCH", "PUT"]:
        serializer = TrafficAdvisorySerializer(
            advisory,
            data=request.data,
            partial=(request.method == "PATCH"),
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(TrafficAdvisorySerializer(updated, context={"request": request}).data)
    serializer = TrafficAdvisorySerializer(advisory, context={"request": request})
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def admin_advisory_pin(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    if "is_pinned" in request.data:
        raw_val = request.data["is_pinned"]
        if isinstance(raw_val, bool):
            pinned = raw_val
        else:
            pinned = str(raw_val).lower() in ["true", "1"]
    else:
        pinned = not advisory.is_pinned
    advisory.is_pinned = pinned
    advisory.save(update_fields=["is_pinned"])
    return Response({
        "id": advisory.id,
        "is_pinned": advisory.is_pinned,
        "message": "Pinned status updated.",
    })


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def archive_advisory(request, advisory_id):
    advisory = get_object_or_404(TrafficAdvisory, pk=advisory_id)
    if advisory.archived_at is None:
        advisory.archived_at = timezone.now()
    else:
        advisory.archived_at = None
    advisory.save(update_fields=["archived_at"])
    response = Response(TrafficAdvisorySerializer(advisory, context={"request": request}).data)
    response["Cache-Control"] = "private, no-store"
    return response
