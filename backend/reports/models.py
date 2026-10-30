import random
import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from .evidence_storage import EvidenceStorage, evidence_upload_path

class Officer(models.Model):
    name = models.CharField(max_length=120)
    badge = models.CharField(max_length=40)
    unit = models.CharField(max_length=120)

    class Meta:
        ordering = ["pk"]
        constraints = [
            models.UniqueConstraint(models.functions.Lower("name"), name="unique_officer_name"),
            models.UniqueConstraint(models.functions.Lower("badge"), name="unique_officer_badge"),
        ]

    def __str__(self):
        return self.name

class Report(models.Model):
    REJECTION_REASONS = [
        ("insufficient_evidence", "Insufficient evidence"),
        ("unrelated_evidence", "Unrelated photo or video"),
        ("duplicate_incident", "Duplicate incident"),
        ("inconsistent_details", "Inconsistent report details"),
        ("unable_to_verify", "Unable to verify the incident"),
        ("other", "Other reason"),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending Verification'),
        ('Validated', 'Validated'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Rejected', 'Rejected'),
        ('Resolved', 'Resolved'),
    ]

    reference_id = models.CharField(max_length=32, unique=True, null=True, blank=True, editable=False)
    violation_type = models.CharField(max_length=100)
    description = models.TextField()
    image = models.FileField(upload_to='reports/')
    evidence_sha256 = models.CharField(max_length=64, blank=True, default='', db_index=True, editable=False)
    evidence_visual = models.JSONField(default=dict, blank=True, editable=False)
    suspicious_flags = models.JSONField(default=list, blank=True, editable=False)
    occurred_at = models.DateTimeField(null=True, blank=True, db_index=True)
    location = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy = models.FloatField(null=True, blank=True)
    location_captured_at = models.DateTimeField(null=True, blank=True)
    location_source = models.CharField(max_length=10, choices=[('gps', 'Device GPS'), ('manual', 'User-selected pin')], default='gps')
    reporter_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    reporter_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    reporter_email = models.EmailField(max_length=254)
    email_verified_at = models.DateTimeField(null=True, blank=True, editable=False)
    reporter_phone_verified_at = models.DateTimeField(null=True, blank=True, editable=False)
    public_verified_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)
    reporter_phone = models.CharField(max_length=20, blank=True, default='')
    assigned_officer = models.CharField(max_length=120, blank=True, default='')
    date_reported = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    rejection_reason = models.CharField(max_length=32, choices=REJECTION_REASONS, blank=True, default='')
    rejection_details = models.TextField(max_length=1000, blank=True, default='')

    @classmethod
    def rejection_errors(cls, reason, details):
        errors = {}
        if reason not in dict(cls.REJECTION_REASONS):
            errors["rejection_reason"] = "Select a rejection reason."
        if not details or not details.strip():
            errors["rejection_details"] = "Explain why this report is being rejected. This explanation will be shown to the reporter."
        return errors

    def clean(self):
        super().clean()
        if self.status == "Rejected":
            errors = self.rejection_errors(self.rejection_reason, self.rejection_details)
            if errors:
                raise ValidationError(errors)
        else:
            self.rejection_reason = ""
            self.rejection_details = ""

    @classmethod
    def generate_reference_id(cls):
        while True:
            candidate = f"SUP-{random.randint(10_000_000, 99_999_999)}"
            if not cls.objects.filter(reference_id=candidate).exists():
                return candidate

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.reference_id:
            self.reference_id = self.generate_reference_id()
            super().save(update_fields=["reference_id"])

    def __str__(self):
        return self.reference_id or self.violation_type


class SupportMessage(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=254)
    subject = models.CharField(max_length=200)
    message = models.TextField(max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class TrafficAdvisory(models.Model):
    AUDIENCES = [("all", "Public and CTMO staff"), ("public", "Public"), ("officers", "CTMO staff")]
    message = models.TextField(max_length=1000)
    audience = models.CharField(max_length=8, choices=AUDIENCES)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class ReportRecoveryChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)


class AdminActivity(models.Model):
    ACTIONS = [("case_created", "Case created"), ("case_updated", "Case updated"),
               ("case_deleted", "Case deleted"), ("evidence_requested", "Additional evidence requested"),
               ("note_added", "Admin note added")]
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="report_activities")
    actor_name = models.CharField(max_length=255)
    actor_username = models.CharField(max_length=150)
    report = models.ForeignKey(Report, null=True, on_delete=models.SET_NULL, related_name="admin_activities")
    report_reference = models.CharField(max_length=32)
    action = models.CharField(max_length=32, choices=ACTIONS)
    changes = models.JSONField(default=dict)
    notes = models.TextField(max_length=2000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class ReportEvidenceRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="evidence_requests")
    message = models.TextField(max_length=1000)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    response_text = models.TextField(max_length=2000, blank=True, default="")
    attachment = models.FileField(storage=EvidenceStorage(), upload_to=evidence_upload_path, blank=True)
    attachment_content_type = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["report"], condition=models.Q(responded_at__isnull=True),
                                               name="one_open_evidence_request")]


class ReportSubmissionChallenge(models.Model):
    CHANNEL_CHOICES = [("email", "Email"), ("phone", "Phone")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, db_index=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    delivery_channel = models.CharField(max_length=8, choices=CHANNEL_CHOICES, default="email")
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["email", "consumed_at"], name="submission_email_consumed_idx")]


class ReportEmailSubmissionLock(models.Model):
    # A persistent row lets transactions for different proofs of the same email
    # serialize across processes. Store a digest rather than another email copy.
    email_key = models.CharField(max_length=64, primary_key=True)


class ReportDuplicateMatch(models.Model):
    match_type = models.CharField(max_length=10, choices=[("exact", "Exact file"), ("visual", "Visual similarity")], default="exact")
    first_report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="duplicate_matches_as_first")
    second_report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="duplicate_matches_as_second")
    distance_m = models.FloatField()
    time_difference_seconds = models.FloatField()
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["first_report", "second_report"], name="unique_report_duplicate_pair"),
            models.CheckConstraint(condition=models.Q(first_report__lt=models.F("second_report")), name="ordered_report_duplicate_pair"),
        ]
