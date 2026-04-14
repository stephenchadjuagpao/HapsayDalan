from rest_framework import serializers
from .models import Report

class ReportSerializer(serializers.ModelSerializer):
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
            "assigned_officer",
            "date_reported",
            "updated_at",
            "status",
        ]
        read_only_fields = ["id", "reference_id", "date_reported", "updated_at"]
