from .email_delivery import email_delivery_configured
import json
import logging
import secrets
from datetime import timedelta
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth.hashers import make_password, check_password
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from .models import Report, ReportRecoveryChallenge, ReportDuplicateMatch
from .submission_verification import save_verified_report
from .frontend_links import frontend_url_for_request
from .activity import delete_with_activity
from .serializers import (ReportSerializer, CitizenReportSerializer, PublicReportSerializer, TrackingReportSerializer,
                          RecoveryRequestSerializer, RecoveryVerifySerializer)

logger = logging.getLogger(__name__)
RECOVERY_SALT = "reports.verified-email"


class RecoveryThrottle(AnonRateThrottle):
    rate = "10/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": "report-recovery", "ident": self.get_ident(request)}


class ReportSubmissionThrottle(RecoveryThrottle):
    rate = "10/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": "report-submission", "ident": self.get_ident(request)}


@api_view(["GET"])
@permission_classes([AllowAny])
def captcha_config_view(request):
    return Response({"site_key": settings.RECAPTCHA_SITE_KEY,
                     "configured": bool(settings.RECAPTCHA_SITE_KEY and settings.RECAPTCHA_SECRET_KEY)})


class AdminAuthThrottle(RecoveryThrottle):
    rate = "10/minute"

    def __init__(self):
        super().__init__()
        # DRF rate strings only accept a single time unit; keep 10 attempts in 5 minutes.
        self.duration = 5 * 60

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": "admin-auth", "ident": self.get_ident(request)}


class AdminPasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class AdminPasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=256)
    password = serializers.CharField(trim_whitespace=False, max_length=128)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AdminAuthThrottle])
def admin_password_reset_request(request):
    serializer = AdminPasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not email_delivery_configured():
        return Response({"detail": "Password reset email delivery is not configured. Contact the administrator."}, status=503)
    users = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True, is_staff=True)
    # An ambiguous email address cannot safely identify a staff account.
    user = users.first() if users.count() == 1 else None
    if user and user.has_usable_password():
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{frontend_url_for_request(request)}/admin-ctmo?{urlencode({'uid': uid, 'token': token})}"
        try:
            sent = send_mail(
                "Reset your HapsayDalan CTMO password",
                f"Use this link to choose a new CTMO portal password:\n{link}\n\n"
                "This link expires in 15 minutes and can be used once.\n"
                "If you did not request this, ignore this email. Your password has not changed.",
                settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
            )
            if sent != 1:
                raise SMTPException("Email not accepted")
        except (SMTPException, OSError):
            logger.error("Admin password reset email delivery failed.")
            return Response({"detail": "Unable to send the reset email. Try again later or contact the administrator."}, status=503)
    return Response({"detail": "If this email belongs to an active CTMO account, a password reset link has been sent. Check your inbox and spam folder."})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AdminAuthThrottle])
def admin_password_reset_confirm(request):
    serializer = AdminPasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        uid = urlsafe_base64_decode(data["uid"]).decode()
        # Serialize concurrent attempts so the reset link can only be used once.
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=uid, is_active=True, is_staff=True).first()
            if not user or not default_token_generator.check_token(user, data["token"]):
                return Response({"detail": "Reset link is invalid or expired. Request a new link."}, status=400)
            try:
                validate_password(data["password"], user=user)
            except ValidationError as error:
                return Response({"detail": " ".join(error.messages)}, status=400)
            user.set_password(data["password"])
            user.save(update_fields=["password"])
    except (ValueError, TypeError, OverflowError, UnicodeDecodeError):
        return Response({"detail": "Reset link is invalid or expired. Request a new link."}, status=400)
    return Response({"detail": "Password updated. Log in with your new password."})


def _format_readable_location(geocode_data, fallback_location):
    address = geocode_data.get("address", {}) if isinstance(geocode_data, dict) else {}

    street_line = " ".join(
        part for part in [
            address.get("house_number"),
            address.get("road") or address.get("pedestrian") or address.get("footway") or address.get("path"),
        ]
        if part
    )

    landmark_line = (
        address.get("hotel")
        or address.get("amenity")
        or address.get("building")
        or address.get("shop")
        or address.get("tourism")
        or address.get("leisure")
        or ""
    )

    area_line = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("quarter")
        or address.get("village")
        or address.get("hamlet")
        or ""
    )

    city_line = (
        address.get("city")
        or address.get("municipality")
        or address.get("town")
        or address.get("county")
        or "Surigao City"
    )

    province_line = address.get("state") or address.get("region") or ""
    country_line = address.get("country") or ""
    primary_line = next((line for line in [landmark_line, street_line] if line), "") or street_line or landmark_line

    formatted = [part for part in [primary_line, area_line, city_line, province_line, country_line] if part]

    if formatted:
        return ", ".join(formatted)

    return geocode_data.get("display_name") or fallback_location


def _has_street_like_location(geocode_data):
    address = geocode_data.get("address", {}) if isinstance(geocode_data, dict) else {}

    return any(
        [
            address.get("road"),
            address.get("pedestrian"),
            address.get("footway"),
            address.get("path"),
            address.get("house_number"),
            address.get("hotel"),
            address.get("amenity"),
            address.get("building"),
            address.get("shop"),
        ]
    )


def _reverse_geocode_location(lat, lng):
    fallback_location = f"{lat:.6f}, {lng:.6f}"
    best_match = None

    for zoom_level in [18, 17, 16]:
        params = urlencode(
            {
                "format": "jsonv2",
                "addressdetails": 1,
                "namedetails": 1,
                "accept-language": "en",
                "zoom": zoom_level,
                "lat": lat,
                "lon": lng,
            }
        )
        request = Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={
                "User-Agent": "HapsayDalan/1.0 (Surigao City Traffic Reports)",
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            continue

        if not isinstance(data, dict):
            continue

        best_match = data

        if _has_street_like_location(data):
            break

    return _format_readable_location(best_match or {}, fallback_location)


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().order_by('-date_reported')
    serializer_class = ReportSerializer

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related("evidence_requests")
        if self.action == "hotspots" or (not self.request.user.is_staff and self.action in {"list", "retrieve"}):
            return queryset.filter(public_verified_at__isnull=False, status__in=["Validated", "Assigned", "In Progress", "Resolved"])
        if self.request.user.is_staff:
            return queryset.prefetch_related(
                Prefetch("duplicate_matches_as_first", queryset=ReportDuplicateMatch.objects.select_related("second_report")),
                Prefetch("duplicate_matches_as_second", queryset=ReportDuplicateMatch.objects.select_related("first_report")),
            )
        return queryset

    @action(detail=False, methods=["get"], url_path="hotspots")
    def hotspots(self, request):
        # Always public data, including when viewed with an admin session.
        serializer = PublicReportSerializer(self.get_queryset(), many=True, context=self.get_serializer_context())
        response = Response(serializer.data)
        response["Cache-Control"] = "no-store"
        return response

    def get_throttles(self):
        return [ReportSubmissionThrottle()] if self.action == "create" else super().get_throttles()

    def perform_create(self, serializer):
        save_verified_report(serializer, self.request.data.get("email_verification_token", ""))

    def perform_destroy(self, instance):
        delete_with_activity(instance, self.request.user)

    def get_permissions(self):
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsAdminUser()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.request.user.is_staff or self.action == "my_reports":
            return ReportSerializer
        if self.action == "by_reference":
            return TrackingReportSerializer
        if self.action == "create":
            return CitizenReportSerializer
        return PublicReportSerializer

    @action(detail=False, methods=["post"], url_path="recover", throttle_classes=[RecoveryThrottle])
    def recover(self, request):
        serializer = RecoveryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        if not email_delivery_configured():
            return Response({
                "detail": "Email delivery is not configured yet. Please contact the administrator.",
            }, status=503)
        now = timezone.now()
        # Apply the same cooldown whether or not a report exists for this address.
        if ReportRecoveryChallenge.objects.filter(email=email, created_at__gte=now - timedelta(seconds=60)).exists():
            return Response({"detail": "Please wait 60 seconds before requesting another code."}, status=429)
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = ReportRecoveryChallenge.objects.create(
            email=email, code_hash=make_password(code), expires_at=now + timedelta(minutes=10),
        )
        # Send for every valid address, without disclosing whether it has reports.
        try:
            sent = send_mail(
                "Your HapsayDalan verification code",
                f"Your code is {code}. It expires in 10 minutes and can be used once.\n"
                "Enter it on Track My Report to view reports submitted with this email.\n"
                "If you did not request this, ignore this email. Do not share the code.",
                settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False,
            )
            if sent != 1:
                raise SMTPException("Email backend did not accept the message.")
        except (SMTPException, OSError):
            challenge.delete()
            logger.error("Report recovery email delivery failed.")
            return Response({
                "detail": "We could not send the verification email. Please try again later or contact the administrator.",
            }, status=503)
        return Response({
            "challenge_id": str(challenge.pk),
            "detail": "Verification email sent. Check your inbox and spam folder. Delivery may take a few minutes.",
        })

    @action(detail=False, methods=["post"], url_path="verify-recovery", throttle_classes=[RecoveryThrottle])
    def verify_recovery(self, request):
        serializer = RecoveryVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            challenge = ReportRecoveryChallenge.objects.select_for_update().filter(
                pk=serializer.validated_data["challenge_id"],
            ).first()
            if not challenge or challenge.used or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                return Response({"detail": "Code expired or unavailable. Request a new code."}, status=400)
            challenge.attempts += 1
            valid = check_password(serializer.validated_data["code"], challenge.code_hash)
            challenge.used = valid
            challenge.save(update_fields=["attempts", "used"])
        if not valid:
            return Response({"detail": "Incorrect code. Please try again."}, status=400)
        token = signing.dumps({"email": challenge.email}, salt=RECOVERY_SALT)
        response = Response({"access_token": token, "expires_in": 900})
        response["Cache-Control"] = "no-store"
        return response

    @action(detail=False, methods=["get"], url_path="my-reports")
    def my_reports(self, request):
        try:
            verified = signing.loads(request.headers.get("X-Report-Access", ""), salt=RECOVERY_SALT, max_age=900)
        except signing.BadSignature:
            return Response({"detail": "Please verify your email again to view your reports."}, status=403)
        reports = self.get_queryset().filter(reporter_email__iexact=verified["email"])
        response = Response(self.get_serializer(reports, many=True).data)
        response["Cache-Control"] = "no-store"
        return response

    @action(detail=False, methods=["get"], url_path=r"by-reference/(?P<reference_id>[^/.]+)")
    def by_reference(self, request, reference_id=None):
        report = get_object_or_404(self.get_queryset(), reference_id__iexact=reference_id)
        serializer = self.get_serializer(report)
        return Response(serializer.data)


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_cookie_view(request):
    return Response(
        {
            "detail": "CSRF cookie set.",
            "csrfToken": get_token(request),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def reverse_geocode_view(request):
    try:
      lat = float(request.query_params.get("lat", ""))
      lng = float(request.query_params.get("lng", ""))
    except (TypeError, ValueError):
      return Response(
          {"detail": "Valid latitude and longitude are required."},
          status=status.HTTP_400_BAD_REQUEST,
      )

    location = _reverse_geocode_location(lat, lng)
    return Response({"location": location})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AdminAuthThrottle])
def admin_login_view(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))

    if not username or not password:
        return Response(
            {"detail": "Please enter both username and password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        user_by_email = User.objects.filter(email__iexact=username).first()
        if user_by_email:
            user = authenticate(request, username=user_by_email.username, password=password)

    if user is None:
        return Response(
            {"detail": "Invalid email address or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"detail": "This account does not have CTMO admin access."},
            status=status.HTTP_403_FORBIDDEN,
        )

    login(request, user)

    return Response(
        {
            "detail": "Login successful.",
            "admin_url": "/admin/",
            "username": user.get_username(),
        }
    )
