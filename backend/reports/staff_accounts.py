from .email_delivery import email_delivery_configured
import logging
import secrets
from smtplib import SMTPException
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth import logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from .frontend_links import frontend_url_for_request

logger = logging.getLogger(__name__)


class InviteStaffSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account already uses this email address.")
        return value


def _staff_data(user):
    return {
        "id": user.pk,
        "name": user.get_full_name() or user.username,
        "email": user.email,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "last_login": user.last_login,
    }


def _owner_only(request):
    if not request.user.is_superuser:
        return Response({"detail": "Only the main administrator can manage CTMO accounts."}, status=403)
    return None


def _send_invitation(request, user, name):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{frontend_url_for_request(request)}/admin-ctmo?{urlencode({'uid': uid, 'token': token})}"
    sent = send_mail(
        "Your HapsayDalan CTMO account",
        f"Hello {name},\n\nYou have been invited to the HapsayDalan CTMO portal. "
        f"Choose your password here:\n{link}\n\nThis link expires in 15 minutes. "
        "If it expires, use Forgot password on the CTMO login page to get a new link. "
        "If you were not expecting this invitation, contact your administrator.",
        settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
    )
    if sent != 1:
        raise SMTPException("Email not accepted")


def _email_ready():
    return email_delivery_configured()


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_me(request):
    return Response({"username": request.user.username, "is_superuser": request.user.is_superuser})


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_logout(request):
    logout(request)
    return Response({"detail": "Logged out."})


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def staff_accounts(request):
    denied = _owner_only(request)
    if denied is not None:
        return denied

    if request.method == "GET":
        users = User.objects.filter(is_staff=True).order_by("-is_superuser", "date_joined", "pk")
        return Response([_staff_data(user) for user in users])

    serializer = InviteStaffSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not _email_ready():
        return Response({"detail": "Email delivery is not configured. Set up CTMO email before inviting staff."}, status=503)

    name = serializer.validated_data["name"].strip()
    email = serializer.validated_data["email"]
    parts = name.split(" ", 1)
    # The account has an unknown, random password until the recipient chooses one.
    user = User.objects.create_user(
        username=f"ctmo_{secrets.token_hex(12)}", email=email,
        password=secrets.token_urlsafe(48), is_staff=True,
        first_name=parts[0][:150], last_name=parts[1][:150] if len(parts) > 1 else "",
    )
    try:
        _send_invitation(request, user, name)
    except (SMTPException, OSError):
        user.delete()
        logger.error("CTMO staff invitation email delivery failed.")
        return Response({"detail": "Could not send the invitation. Check email settings and try again."}, status=503)
    return Response(_staff_data(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def resend_staff_invitation(request, user_id):
    denied = _owner_only(request)
    if denied is not None:
        return denied
    user = User.objects.filter(pk=user_id, is_staff=True, is_active=True, is_superuser=False).first()
    if user is None:
        return Response({"detail": "Active CTMO staff account not found."}, status=404)
    if not _email_ready():
        return Response({"detail": "Email delivery is not configured."}, status=503)
    try:
        _send_invitation(request, user, user.get_full_name() or user.username)
    except (SMTPException, OSError):
        logger.error("CTMO staff invitation email delivery failed.")
        return Response({"detail": "Could not send the new link. Check email settings and try again."}, status=503)
    return Response({"detail": "A new invitation link has been sent."})


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def update_staff_account(request, user_id):
    denied = _owner_only(request)
    if denied is not None:
        return denied
    if set(request.data.keys()) != {"is_active"} or not isinstance(request.data["is_active"], bool):
        return Response({"detail": "Provide is_active as true or false."}, status=400)
    user = User.objects.filter(pk=user_id, is_staff=True).first()
    if user is None:
        return Response({"detail": "CTMO account not found."}, status=404)
    if user.is_superuser or user.pk == request.user.pk:
        return Response({"detail": "Main administrator accounts cannot be changed here."}, status=403)
    user.is_active = request.data["is_active"]
    user.save(update_fields=["is_active"])
    return Response(_staff_data(user))
