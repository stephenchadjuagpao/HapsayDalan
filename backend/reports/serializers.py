from rest_framework import serializers
from .models import Report

class ReportSerializer(serializers.ModelSerializer):
    reference_id = serializers.SerializerMethodField()

    def get_reference_id(self, obj):
        return f"SUP-{obj.id:03d}"

    class Meta:
        model = Report
        fields = [
            "id",
            "reference_id",
            "violation_type",
            "description",
            "image",
            "location",
            "assigned_officer",
            "date_reported",
            "updated_at",
            "status",
        ]
