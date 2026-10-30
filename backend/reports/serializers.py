from rest_framework import serializers
import math
from django.utils import timezone
from django.db import transaction
from .models import Officer, Report
from .duplicates import fingerprint_file, schedule_duplicate_check
from .visual_similarity import visual_fingerprint
from .evidence import evidence_status
from .activity import record_admin_activity, report_snapshot
from .phone_numbers import normalize_philippine_mobile_number

class ReportSerializer(serializers.ModelSerializer):
    admin_note = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2000, trim_whitespace=True)
    evidence_status = serializers.SerializerMethodField()
    rejection_reason_label = serializers.CharField(source="get_rejection_reason_display", read_only=True)
    reporter_email = serializers.EmailField(required=True, allow_blank=False, max_length=254)
    reporter_phone = serializers.CharField(required=True, allow_blank=False, max_length=20)
    possible_duplicate = serializers.SerializerMethodField()
    duplicate_matches = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id",
            "reference_id",
            "violation_type",
            "description",
            "image",
            "location",
            "latitude",
            "longitude",
            "location_accuracy",
            "location_captured_at",
            "location_source",
            "reporter_latitude",
            "reporter_longitude",
            "reporter_email",
            "email_verified_at",
            "reporter_phone_verified_at",
            "public_verified_at",
            "reporter_phone",
            "assigned_officer",
            "date_reported",
            "occurred_at",
            "possible_duplicate",
            "duplicate_matches",
            "suspicious_flags",
            "updated_at",
            "status",
            "rejection_reason",
            "rejection_reason_label",
            "rejection_details",
            "evidence_status",
            "admin_note",
        ]
        read_only_fields = ["id", "reference_id", "date_reported", "updated_at", "email_verified_at", "reporter_phone_verified_at", "public_verified_at", "suspicious_flags"]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if not request or not request.user.is_staff:
            fields.pop("possible_duplicate", None)
            fields.pop("duplicate_matches", None)
            fields.pop("suspicious_flags", None)
            fields.pop("admin_note", None)
        return fields

    def get_evidence_status(self, obj):
        return evidence_status(obj)

    def validate_reporter_phone(self, value):
        try:
            return normalize_philippine_mobile_number(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from None

    def get_possible_duplicate(self, obj):
        return bool(list(obj.duplicate_matches_as_first.all()) or list(obj.duplicate_matches_as_second.all()))

    def get_duplicate_matches(self, obj):
        matches = [(match, match.second_report) for match in obj.duplicate_matches_as_first.all()]
        matches += [(match, match.first_report) for match in obj.duplicate_matches_as_second.all()]
        request = self.context["request"]
        return [{"id": other.pk, "reference_id": other.reference_id, "violation_type": other.violation_type,
                 "location": other.location, "occurred_at": other.occurred_at, "date_reported": other.date_reported,
                 "time_basis": "incident time" if obj.occurred_at and other.occurred_at else "submission time used where incident time is unavailable",
                 "distance_m": round(match.distance_m, 1), "time_difference_minutes": round(match.time_difference_seconds / 60, 1),
                 "match_type": match.match_type,
                 "image": request.build_absolute_uri(other.image.url) if other.image else None}
                for match, other in sorted(matches, key=lambda pair: pair[1].pk, reverse=True)]

    def create(self, validated_data):
        note = validated_data.pop("admin_note", "")
        evidence = validated_data["image"]
        validated_data["evidence_sha256"] = fingerprint_file(evidence) if hasattr(evidence, "chunks") else ""
        validated_data["evidence_visual"] = visual_fingerprint(evidence) if hasattr(evidence, "chunks") else {}
        with transaction.atomic():
            report = super().create(validated_data)
            request = self.context.get("request")
            record_admin_activity(getattr(request, "user", None), report, "case_created", after=report_snapshot(report), notes=note)
            schedule_duplicate_check(report.pk)
        return report

    def update(self, instance, validated_data):
        note = validated_data.pop("admin_note", "")
        with transaction.atomic():
            officer_name = validated_data.get("assigned_officer", "").strip()
            officer = Officer.objects.select_for_update().filter(name__iexact=officer_name).first() if officer_name else None
            # Compare against the actual locked row, including concurrent admin edits.
            instance = Report.objects.select_for_update().get(pk=instance.pk)
            if officer_name:
                if officer is None and (officer_name != instance.assigned_officer or
                                        validated_data.get("status", instance.status) not in {"Resolved", "Rejected"}):
                    raise serializers.ValidationError({"assigned_officer": "Choose an officer from the current officer directory."})
                validated_data["assigned_officer"] = officer.name if officer else officer_name
            self.instance = instance
            validated_data = self.validate(validated_data)
            before = report_snapshot(instance)
            new_status = validated_data.get("status", instance.status)
            if new_status == "Validated" and validated_data.get("status") and (instance.status != "Validated" or not instance.public_verified_at):
                validated_data["public_verified_at"] = timezone.now()
            elif new_status in {"Pending", "Rejected"}:
                validated_data["public_verified_at"] = None
            changed_evidence = any(field in validated_data for field in ("image", "violation_type", "latitude", "longitude", "occurred_at"))
            if "image" in validated_data:
                validated_data["evidence_sha256"] = fingerprint_file(validated_data["image"])
                validated_data["evidence_visual"] = visual_fingerprint(validated_data["image"])
            report = super().update(instance, validated_data)
            request = self.context.get("request")
            record_admin_activity(getattr(request, "user", None), report, "case_updated", before, report_snapshot(report), note)
            if changed_evidence:
                schedule_duplicate_check(report.pk, reset=True)
        return report

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", "Pending"))
        if status == "Rejected":
            reason = attrs.get("rejection_reason", getattr(self.instance, "rejection_reason", ""))
            details = attrs.get("rejection_details", getattr(self.instance, "rejection_details", "")).strip()
            errors = Report.rejection_errors(reason, details)
            if errors:
                raise serializers.ValidationError(errors)
            attrs["rejection_details"] = details
        else:
            attrs["rejection_reason"] = ""
            attrs["rejection_details"] = ""
        if self.instance is not None:
            if attrs.get("status") in {"Assigned", "In Progress", "Resolved"} and not self.instance.public_verified_at:
                raise serializers.ValidationError({"status": "Validate this report first before assigning, starting, or resolving it."})
            return attrs
        errors = {}
        for field in ("latitude", "longitude", "location_accuracy", "location_captured_at"):
            if attrs.get(field) is None:
                errors[field] = "A current device location is required to submit a report."
        latitude, longitude = attrs.get("latitude"), attrs.get("longitude")
        if latitude is not None and not -90 <= latitude <= 90:
            errors["latitude"] = "Latitude must be between -90 and 90."
        if longitude is not None and not -180 <= longitude <= 180:
            errors["longitude"] = "Longitude must be between -180 and 180."
        if attrs.get("location_source", "gps") == "gps":
            attrs["reporter_latitude"] = latitude
            attrs["reporter_longitude"] = longitude
        else:
            for field, limit in (("reporter_latitude", 90), ("reporter_longitude", 180)):
                coordinate = attrs.get(field)
                if coordinate is None:
                    errors[field] = "Your current device location is required alongside the selected pin."
                elif not -limit <= coordinate <= limit:
                    errors[field] = "Invalid device coordinate."
        accuracy = attrs.get("location_accuracy")
        if accuracy is not None:
            if not math.isfinite(accuracy) or accuracy < 0:
                errors["location_accuracy"] = "A valid device location accuracy is required."
            elif accuracy > 100 and attrs.get("location_source", "gps") != "manual":
                errors["location_accuracy"] = "Your device location is approximate. Click or tap the map to confirm the exact violation location."
        captured_at = attrs.get("location_captured_at")
        if captured_at is not None and not -30 <= (timezone.now() - captured_at).total_seconds() <= 120:
            errors["location_captured_at"] = "Your location is outdated. Refresh your location and try again."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class CitizenReportSerializer(ReportSerializer):
    class Meta(ReportSerializer.Meta):
        read_only_fields = ReportSerializer.Meta.read_only_fields + ["status", "assigned_officer", "rejection_reason", "rejection_details"]


class PublicReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "reference_id", "violation_type", "location", "latitude",
                  "longitude", "date_reported", "updated_at", "status", "assigned_officer"]


class TrackingReportSerializer(PublicReportSerializer):
    evidence_status = serializers.SerializerMethodField()
    rejection_reason_label = serializers.CharField(source="get_rejection_reason_display", read_only=True)

    class Meta(PublicReportSerializer.Meta):
        fields = PublicReportSerializer.Meta.fields + ["rejection_reason", "rejection_reason_label", "rejection_details", "evidence_status"]

    def get_evidence_status(self, obj):
        return evidence_status(obj)


class RecoveryRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class RecoveryVerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^[0-9]{6}$")
