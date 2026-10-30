from .email_delivery import email_delivery_configured
import hashlib
import logging
import math
import secrets
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError
from uuid import UUID
from datetime import timedelta
from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.core import signing
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .captcha import verify_report_captcha
from .models import ReportSubmissionChallenge, ReportEmailSubmissionLock
from .serializers import RecoveryVerifySerializer
from .phone_numbers import normalize_philippine_mobile_number

SUBMISSION_SALT = "reports.submission-email"
logger = logging.getLogger(__name__)


def check_email_submission_limit(email, now=None):
    now = now or timezone.now()
    limit = settings.REPORT_EMAIL_SUBMISSION_LIMIT
    seconds = settings.REPORT_EMAIL_SUBMISSION_WINDOW_SECONDS
    # Count accepted submissions, regardless of report status or later deletion.
    recent = list(ReportSubmissionChallenge.objects.filter(
        email=email, consumed_at__gt=now - timedelta(seconds=seconds),
    ).order_by("-consumed_at").values_list("consumed_at", flat=True)[:limit])
    if len(recent) >= limit:
        wait = max(1, math.ceil((recent[-1] + timedelta(seconds=seconds) - now).total_seconds()))
        duration = seconds // 60 if seconds % 60 == 0 else seconds
        unit = "minute" if seconds % 60 == 0 else "second"
        window = f"{duration} {unit}{'' if duration == 1 else 's'}"
        raise Throttled(wait=wait, detail=(
            f"This email has reached the limit of {limit} report{'' if limit == 1 else 's'} per {window}. "
            "Your report has not been submitted."
        ))


class SubmissionCodeThrottle(UserRateThrottle):
    scope = "submission-email-send"
    rate = "10/hour"


class SubmissionVerifyThrottle(UserRateThrottle):
    scope = "submission-email-verify"
    rate = "30/hour"


class SubmissionEmailRequest(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=24, required=True, allow_blank=False)
    channel = serializers.ChoiceField(choices=("email", "phone"), default="email")
    captcha_token = serializers.CharField(max_length=8192, allow_blank=True, required=False, default="")

    def validate_phone(self, value):
        try:
            return normalize_philippine_mobile_number(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from None


def send_semaphore_otp(phone, code):
    payload = {
        "apikey": settings.SEMAPHORE_API_KEY,
        "number": phone.removeprefix("+"),
        "message": "HapsayDalan report verification code: {otp}. It expires in 10 minutes. Do not share this code.",
        "code": code,
    }
    if settings.SEMAPHORE_SENDERNAME:
        payload["sendername"] = settings.SEMAPHORE_SENDERNAME
    request = Request("https://api.semaphore.co/api/v4/otp", data=urlencode(payload).encode("ascii"), method="POST")
    with urlopen(request, timeout=10) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not isinstance(result, list) or not any(
        str(item.get("code", "")) == code and str(item.get("status", "")).lower() in {"queued", "pending", "sent"}
        for item in result if isinstance(item, dict)
    ):
        raise ValueError("SMS gateway did not accept the verification code")


def mask_phone(phone):
    return f"+63 ••• ••• {phone[-4:]}"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SubmissionCodeThrottle])
def request_submission_code(request):
    serializer = SubmissionEmailRequest(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].strip().lower()
    phone = serializer.validated_data["phone"]
    channel = serializer.validated_data["channel"]
    if channel == "email" and not email_delivery_configured():
        return Response({"detail": "Email delivery is not configured. Please contact the administrator."}, status=503)
    if channel == "phone" and not settings.SEMAPHORE_API_KEY:
        return Response({"detail": "SMS verification is not configured yet. Please choose email or contact the administrator."}, status=503)
    # This CAPTCHA is verified once before sending the code. The single-use
    # proof issued after OTP verification attests to both checks at report creation.
    verify_report_captcha(serializer.validated_data["captcha_token"])
    check_email_submission_limit(email)
    destination = email if channel == "email" else phone
    cooldown_key = f"submission-code:{channel}:" + hashlib.sha256(destination.encode()).hexdigest()
    now = timezone.now()
    recent_query = ReportSubmissionChallenge.objects.filter(delivery_channel=channel, created_at__gte=now - timedelta(seconds=60))
    recent = recent_query.filter(email=email).exists() if channel == "email" else recent_query.filter(phone=phone).exists()
    if recent or not cache.add(cooldown_key, True, 60):
        return Response({"detail": "Wait 60 seconds before requesting another code for this destination."}, status=429)
    code = str(secrets.randbelow(900_000) + 100_000)
    challenge = None
    try:
        challenge = ReportSubmissionChallenge.objects.create(
            email=email, phone=phone, delivery_channel=channel,
            code_hash=make_password(code), expires_at=now + timedelta(minutes=10),
        )
        if channel == "email":
            sent = send_mail(
                "Verify your report on HapsayDalan",
                f"Your report submission code is {code}. It expires in 10 minutes and can be used once.\n\n"
                "Enter this code in the report form to verify your contact details before submitting your report.\n"
                "This code does not grant access to existing reports.\n"
                "If you did not request this, ignore this email. Do not share the code.",
                settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False,
            )
            if sent != 1:
                raise SMTPException("Email was not accepted")
        else:
            send_semaphore_otp(phone, code)
    except (SMTPException, OSError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
        if challenge:
            challenge.delete()
        cache.delete(cooldown_key)
        logger.error("Report submission verification code delivery failed (channel=%s).", channel)
        return Response({"detail": "We could not send the code. Please try again later. Your report has not been submitted."}, status=503)
    display_destination = email if channel == "email" else mask_phone(phone)
    response = Response({"challenge_id": str(challenge.pk), "expires_in": 600, "resend_after": 60,
                         "channel": channel, "destination": display_destination,
                         "detail": "Verification code sent."})
    response["Cache-Control"] = "no-store"
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SubmissionVerifyThrottle])
def verify_submission_code(request):
    serializer = RecoveryVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        challenge = ReportSubmissionChallenge.objects.select_for_update().filter(pk=serializer.validated_data["challenge_id"]).first()
        if not challenge or challenge.verified_at or challenge.consumed_at or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
            return Response({"detail": "Code expired or unavailable. Request a new code."}, status=400)
        challenge.attempts += 1
        valid = check_password(serializer.validated_data["code"], challenge.code_hash)
        if valid:
            challenge.verified_at = timezone.now()
        challenge.save(update_fields=["attempts", "verified_at"])
    if not valid:
        return Response({"detail": "Incorrect code. Please try again. You have up to 5 attempts."}, status=400)
    token = signing.dumps({"challenge_id": str(challenge.pk), "email": challenge.email,
                           "phone": challenge.phone, "channel": challenge.delivery_channel}, salt=SUBMISSION_SALT)
    response = Response({"email_verification_token": token, "expires_in": 900})
    response["Cache-Control"] = "no-store"
    return response


def save_verified_report(serializer, token):
    message = {"email_verification_token": "Verify your selected contact method before submitting. The code expired, was already used, or does not match the contact details."}
    if not isinstance(token, str) or len(token) > 4096:
        raise ValidationError(message)
    try:
        proof = signing.loads(token, salt=SUBMISSION_SALT, max_age=900)
        challenge_id = UUID(proof["challenge_id"])
        email = serializer.validated_data["reporter_email"].strip().lower()
        phone = serializer.validated_data.get("reporter_phone", "")
        if phone:
            phone = normalize_philippine_mobile_number(phone)
        if proof["email"] != email or proof["phone"] != phone:
            raise ValueError("Contact detail mismatch")
        with transaction.atomic():
            challenge = ReportSubmissionChallenge.objects.select_for_update().filter(pk=challenge_id, email=email).first()
            now = timezone.now()
            if (not challenge or not challenge.verified_at or challenge.consumed_at or
                    challenge.verified_at < now - timedelta(minutes=15)):
                raise ValidationError(message)
            if challenge.phone != phone or challenge.delivery_channel != proof.get("channel"):
                raise ValidationError(message)
            # Separate proofs for the same email must share one database lock;
            # checking the count without this can admit simultaneous requests.
            key = hashlib.sha256(email.encode()).hexdigest()
            ReportEmailSubmissionLock.objects.get_or_create(email_key=key)
            ReportEmailSubmissionLock.objects.select_for_update().get(email_key=key)
            now = timezone.now()
            check_email_submission_limit(email, now)
            serializer.save(reporter_email=email, reporter_phone=phone,
                            email_verified_at=challenge.verified_at if challenge.delivery_channel == "email" else None,
                            reporter_phone_verified_at=challenge.verified_at if challenge.delivery_channel == "phone" else None)
            challenge.consumed_at = now
            challenge.save(update_fields=["consumed_at"])
    except (signing.BadSignature, ValueError, KeyError, TypeError, AttributeError):
        raise ValidationError(message) from None
