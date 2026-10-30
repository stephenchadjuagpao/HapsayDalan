from .email_delivery import email_delivery_configured
import logging
import warnings
from pathlib import Path
from smtplib import SMTPException

from PIL import Image
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import Report, ReportEvidenceRequest
from .activity import record_admin_activity

logger = logging.getLogger(__name__)
RECOVERY_SALT = "reports.verified-email"
MAX_EVIDENCE_BYTES = 50 * 1024 * 1024
CLOSED_STATUSES = {"Rejected", "Resolved"}


def evidence_status(report):
    latest = next(iter(report.evidence_requests.all()), None)
    return ("submitted" if latest.responded_at else "requested") if latest else ""


def require_owner_or_staff(request, report, allow_staff=True):
    if allow_staff and request.user.is_staff:
        return
    try:
        verified = signing.loads(request.headers.get("X-Report-Access", ""), salt=RECOVERY_SALT, max_age=900)
        email = verified.get("email", "") if isinstance(verified, dict) else ""
    except signing.BadSignature:
        email = ""
    if not isinstance(email, str) or not email.strip() or email.strip().lower() != report.reporter_email.strip().lower():
        raise PermissionDenied("Verify the email used for this report to view or submit additional evidence.")


class EvidenceRequestInput(serializers.Serializer):
    message = serializers.CharField(max_length=1000, trim_whitespace=True)


class EvidenceReplyInput(serializers.Serializer):
    response_text = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)
    attachment = serializers.FileField(required=False)

    def validate_attachment(self, file):
        if file.size > MAX_EVIDENCE_BYTES:
            raise serializers.ValidationError("The file must be 50 MB or smaller.")
        suffix = Path(file.name).suffix.lower()
        try:
            if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    picture = Image.open(file)
                    media_type = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp", "GIF": "image/gif"}.get(picture.format)
                    picture.verify()
                if not media_type:
                    raise ValueError("Unsupported image")
            else:
                header = file.read(32)
                if suffix in {".mp4", ".mov"} and header[4:8] == b"ftyp":
                    media_type = "video/mp4" if suffix == ".mp4" else "video/quicktime"
                elif suffix == ".webm" and header.startswith(b"\x1a\x45\xdf\xa3"):
                    media_type = "video/webm"
                else:
                    raise ValueError("Unsupported file")
        except (OSError, ValueError, SyntaxError, Image.DecompressionBombWarning, Image.DecompressionBombError):
            raise serializers.ValidationError("Upload a valid JPG, PNG, WebP, GIF, MP4, MOV, or WebM file.")
        finally:
            file.seek(0)
        file.verified_content_type = media_type
        return file

    def validate(self, attrs):
        if not attrs.get("response_text") and not attrs.get("attachment"):
            raise serializers.ValidationError("Add a photo/video or written clarification before sending.")
        return attrs


def serialize_request(item):
    return {"id": str(item.pk), "message": item.message, "created_at": item.created_at,
            "responded_at": item.responded_at, "response_text": item.response_text,
            "status": "submitted" if item.responded_at else "requested",
            "attachment_url": reverse("report-evidence-file", args=[item.report_id, item.pk]) if item.attachment else None,
            "attachment_content_type": item.attachment_content_type}


class EvidenceRequestThrottle(UserRateThrottle):
    scope = "evidence-request"
    rate = "20/hour"


class EvidenceReplyThrottle(UserRateThrottle):
    scope = "evidence-reply"
    rate = "10/hour"


@api_view(["GET"])
@permission_classes([AllowAny])
def evidence_history(request, report_id):
    report = get_object_or_404(Report, pk=report_id)
    require_owner_or_staff(request, report)
    response = Response({"requests": [serialize_request(item) for item in report.evidence_requests.all()],
                         "can_reply": report.status not in CLOSED_STATUSES})
    response["Cache-Control"] = "private, no-store"
    return response


def notify_reporter(report, item):
    if not email_delivery_configured():
        return False
    try:
        sent = send_mail("Additional evidence requested for your HapsayDalan report",
                         f"CTMO needs additional evidence for report {report.reference_id}.\n\n{item.message}\n\n"
                         "Open Track My Report in HapsayDalan, enter your reference ID, and verify the email used for this report to respond.\n"
                         "Your original evidence has been kept. Additional evidence still requires admin review.",
                         settings.DEFAULT_FROM_EMAIL, [report.reporter_email], fail_silently=False)
        return sent == 1
    except (SMTPException, OSError):
        logger.error("Additional evidence notification delivery failed.")
        return False


@api_view(["POST"])
@permission_classes([IsAdminUser])
@throttle_classes([EvidenceRequestThrottle])
def request_evidence(request, report_id):
    serializer = EvidenceRequestInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        report = get_object_or_404(Report.objects.select_for_update(), pk=report_id)
        if report.status in CLOSED_STATUSES:
            raise ValidationError("Reopen this case before requesting additional evidence.")
        if not report.reporter_email:
            raise ValidationError("This report has no email address for a verified response.")
        if report.evidence_requests.filter(responded_at__isnull=True).exists():
            raise ValidationError("There is already an unanswered evidence request for this report.")
        item = ReportEvidenceRequest.objects.create(report=report, message=serializer.validated_data["message"], requested_by=request.user)
        record_admin_activity(request.user, report, "evidence_requested", notes=item.message,
                              after={"evidence_request": str(item.pk)})
        Report.objects.filter(pk=report.pk).update(updated_at=timezone.now())
    notified = notify_reporter(report, item)
    return Response({"request": serialize_request(item), "notification_sent": notified,
                     "detail": "Evidence request saved. The reporter was notified by email." if notified else
                     "Evidence request saved and visible in Track My Report. The notification email could not be sent."}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([EvidenceReplyThrottle])
def reply_evidence(request, report_id, request_id):
    stored_file = None
    try:
        with transaction.atomic():
            report = get_object_or_404(Report.objects.select_for_update(), pk=report_id)
            require_owner_or_staff(request, report, allow_staff=False)
            item = get_object_or_404(ReportEvidenceRequest.objects.select_for_update(), pk=request_id, report=report)
            if report.status in CLOSED_STATUSES or item.responded_at:
                raise ValidationError("This evidence request is closed or already answered.")
            serializer = EvidenceReplyInput(data=request.data)
            serializer.is_valid(raise_exception=True)
            item.response_text = serializer.validated_data.get("response_text", "")
            attachment = serializer.validated_data.get("attachment")
            if attachment:
                item.attachment.save(attachment.name, attachment, save=False)
                stored_file = item.attachment.name
                item.attachment_content_type = attachment.verified_content_type
            item.responded_at = timezone.now()
            item.save()
            Report.objects.filter(pk=report.pk).update(updated_at=item.responded_at)
    except Exception:
        if stored_file:
            ReportEvidenceRequest._meta.get_field("attachment").storage.delete(stored_file)
        raise
    return Response({"request": serialize_request(item), "detail": "Additional evidence received. CTMO will review your response."})


@api_view(["GET"])
@permission_classes([AllowAny])
def evidence_file(request, report_id, request_id):
    report = get_object_or_404(Report, pk=report_id)
    require_owner_or_staff(request, report)
    item = get_object_or_404(ReportEvidenceRequest, pk=request_id, report=report)
    if not item.attachment:
        from rest_framework.exceptions import NotFound
        raise NotFound("No attachment was submitted for this request.")
    response = FileResponse(item.attachment.open("rb"), as_attachment=True,
                            filename=f"{report.reference_id}-additional-evidence{Path(item.attachment.name).suffix}",
                            content_type=item.attachment_content_type or "application/octet-stream")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
