"""Single-use emailed codes for staff password recovery; legacy links still work."""
import logging
import secrets
from datetime import timedelta
from smtplib import SMTPException

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .email_delivery import email_delivery_configured
from .models import AdminPasswordResetChallenge, ReportEmailSubmissionLock
from .views import AdminAuthThrottle

logger = logging.getLogger(__name__)


class CodeRequest(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class CodeVerification(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^[0-9]{6}$", max_length=6)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AdminAuthThrottle])
def request_password_code(request):
    serializer = CodeRequest(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not email_delivery_configured():
        return Response({"detail": "Password recovery email is unavailable. Contact the administrator."}, status=503)
    email = serializer.validated_data["email"].strip().lower()
    email_key = salted_hmac("admin-password-recovery", email, algorithm="sha256").hexdigest()
    now = timezone.now()
    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        ReportEmailSubmissionLock.objects.get_or_create(email_key=email_key)
        ReportEmailSubmissionLock.objects.select_for_update().get(email_key=email_key)
        challenges = AdminPasswordResetChallenge.objects.filter(email_key=email_key)
        if challenges.filter(created_at__gte=now - timedelta(seconds=60)).exists():
            response = Response({"detail": "Wait 60 seconds before requesting another code."}, status=429)
            response["Retry-After"] = "60"
            return response
        users = list(User.objects.filter(email__iexact=email, is_active=True, is_staff=True)[:2])
        user = users[0] if len(users) == 1 and users[0].has_usable_password() else None
        challenges.filter(used=False).update(used=True)
        challenge = AdminPasswordResetChallenge.objects.create(
            user=user, email_key=email_key, code_hash=make_password(code),
            reset_token=default_token_generator.make_token(user) if user else "",
            expires_at=now + timedelta(minutes=10),
        )
    if user:
        try:
            sent = send_mail(
                "Your HapsayDalan password reset code",
                f"Your CTMO password reset code is {code}.\n\n"
                "Enter this code on the password recovery screen. It expires in 10 minutes and can be used once.\n"
                "Do not share this code. If you did not request it, ignore this email; your password has not changed.",
                settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
            )
            if sent != 1:
                raise SMTPException("Email not accepted")
        except (SMTPException, OSError):
            AdminPasswordResetChallenge.objects.filter(pk=challenge.pk).update(used=True)
            logger.error("Staff password recovery code delivery failed.")
            return Response({"detail": "Unable to send the reset email. Try again later or contact the administrator."}, status=503)
    # Identical payload for unknown, ambiguous, inactive, and non-staff accounts.
    response = Response({"challenge_id": str(challenge.pk), "expires_in": 600, "resend_after": 60,
                         "detail": "If this is an active CTMO account, a verification code has been sent."})
    response["Cache-Control"] = "no-store"
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AdminAuthThrottle])
def verify_password_code(request):
    serializer = CodeVerification(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        challenge = AdminPasswordResetChallenge.objects.select_for_update().filter(
            pk=serializer.validated_data["challenge_id"]).first()
        error = {"detail": "Code is incorrect, expired, or unavailable. Request a new code if needed."}
        if not challenge or challenge.used or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
            return Response(error, status=400)
        challenge.attempts += 1
        matches = check_password(serializer.validated_data["code"], challenge.code_hash)
        user = User.objects.filter(pk=challenge.user_id, is_staff=True, is_active=True).first()
        valid = matches and user and default_token_generator.check_token(user, challenge.reset_token)
        challenge.used = bool(valid) or challenge.attempts >= 5
        challenge.save(update_fields=["attempts", "used"])
        if not valid:
            return Response(error, status=400)
        response = Response({"uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": challenge.reset_token})
        response["Cache-Control"] = "no-store"
        return response
