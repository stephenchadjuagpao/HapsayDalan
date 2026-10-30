from datetime import timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Report
from .serializers import ReportSerializer


class RequiredLocationTests(TestCase):
    def payload(self):
        return {
            "violation_type": "Obstruction", "description": "Test", "location": "Surigao City",
            "reporter_email": "reporter@example.com",
            "reporter_phone": "09123456789",
            "image": SimpleUploadedFile("evidence.txt", b"evidence"),
            "latitude": "9.784300", "longitude": "125.488800",
            "location_accuracy": 15, "location_captured_at": timezone.now().isoformat(),
        }

    def test_api_rejects_missing_coordinates(self):
        payload = self.payload()
        del payload["latitude"]
        response = APIClient().post("/api/reports/", payload, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude", response.data)
        self.assertEqual(Report.objects.count(), 0)

    def test_missing_null_inaccurate_stale_and_invalid_location_are_rejected(self):
        invalid = [
            ("latitude", None), ("longitude", None), ("latitude", 91), ("longitude", 181),
            ("location_accuracy", None), ("location_accuracy", -1), ("location_accuracy", 101),
            ("location_accuracy", float("nan")), ("location_accuracy", float("inf")),
            ("location_captured_at", None),
            ("location_captured_at", timezone.now() - timedelta(minutes=3)),
            ("location_captured_at", timezone.now() + timedelta(minutes=2)),
        ]
        for key, value in invalid:
            with self.subTest(key=key, value=value):
                serializer = ReportSerializer(data={**self.payload(), key: value})
                self.assertFalse(serializer.is_valid())
                self.assertIn(key, serializer.errors)

    def test_valid_fix_is_saved_with_accuracy_and_capture_time(self):
        serializer = ReportSerializer(data=self.payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        # Avoid writing a test file; the validated metadata is saved as in a real submission.
        serializer.validated_data["image"] = "reports/evidence.txt"
        report = serializer.save()
        self.assertEqual(report.location_accuracy, 15)
        self.assertIsNotNone(report.location_captured_at)

    def test_legacy_report_can_still_be_updated_without_new_location(self):
        report = Report.objects.create(violation_type="Obstruction", description="Legacy", location="Surigao",
                                       reporter_email="reporter@example.com", image="reports/old.jpg")
        serializer = ReportSerializer(report, data={"status": "Validated"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.save().status, "Validated")

    def test_manual_pin_requires_separate_device_coordinates(self):
        payload = {**self.payload(), "location_source": "manual"}
        serializer = ReportSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("reporter_latitude", serializer.errors)
        self.assertIn("reporter_longitude", serializer.errors)
        serializer = ReportSerializer(data={**payload, "reporter_latitude": "9.780000", "reporter_longitude": "125.480000"})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotEqual(serializer.validated_data["latitude"], serializer.validated_data["reporter_latitude"])

    def test_automatic_pin_records_same_device_coordinates(self):
        serializer = ReportSerializer(data=self.payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["latitude"], serializer.validated_data["reporter_latitude"])

    def test_approximate_fix_allowed_with_manual_pin_and_device_coordinates(self):
        for accuracy in (149, 1500):
            serializer = ReportSerializer(data={**self.payload(), "location_accuracy": accuracy,
                "location_source": "manual", "reporter_latitude": "9.780000", "reporter_longitude": "125.480000"})
            self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.validated_data["location_accuracy"], accuracy)
