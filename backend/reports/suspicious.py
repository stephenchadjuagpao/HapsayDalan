"""Explainable review signals. These never change case status or publication."""
from datetime import timedelta
from types import SimpleNamespace

from django.db import transaction
from django.db.models import Q

from .duplicates import distance_meters, valid_coordinates
from .models import Report

BURST_WINDOW = timedelta(minutes=10)
BURST_COUNT = 3
SIGNAL_FIELDS = {"reporter_email", "date_reported", "occurred_at", "latitude", "longitude",
                 "reporter_latitude", "reporter_longitude", "location_accuracy", "location_source"}


def flags_for_report(report):
    flags = []
    if report.occurred_at and report.occurred_at > report.date_reported + timedelta(minutes=10):
        minutes = round((report.occurred_at - report.date_reported).total_seconds() / 60)
        flags.append({"code": "future_incident_time", "title": "Incident time is in the future",
                      "detail": f"The incident time is {minutes} minutes after submission. Check the reported date and time."})

    if report.location_source == "manual" and valid_coordinates(report):
        device = SimpleNamespace(latitude=report.reporter_latitude, longitude=report.reporter_longitude)
        if valid_coordinates(device):
            distance = distance_meters(report, device)
            # A coarse device fix is not evidence that the selected pin is wrong.
            threshold = max(2000, 3 * (report.location_accuracy or 0))
            if distance > threshold:
                flags.append({"code": "distant_selected_pin", "title": "Selected pin is far from device location",
                              "detail": f"The selected incident pin is {distance / 1000:.1f} km from the submitted device location. The reporter may be reporting an incident elsewhere; confirm the details."})

    email = report.reporter_email.strip()
    if email:
        nearby = list(Report.objects.filter(
            reporter_email__iexact=email,
            date_reported__range=(report.date_reported - BURST_WINDOW, report.date_reported + BURST_WINDOW),
        ).order_by("date_reported", "pk").values("pk", "reference_id", "date_reported"))
        # Find an actual ten-minute window containing this report; combining
        # ten minutes before and after would incorrectly flag a 20-minute span.
        for start in nearby:
            if start["date_reported"] > report.date_reported:
                break
            end = start["date_reported"] + BURST_WINDOW
            if end < report.date_reported:
                continue
            group = [item for item in nearby if start["date_reported"] <= item["date_reported"] <= end]
            if len(group) >= BURST_COUNT:
                flags.append({"code": "rapid_submissions", "title": "Multiple reports from the same email",
                              "detail": f"{len(group)} reports were submitted with this email within 10 minutes. These may be separate valid incidents; review them together.",
                              "related_reports": [{"id": item["pk"], "reference_id": item["reference_id"]}
                                                  for item in group if item["pk"] != report.pk]})
                break
    return flags


def refresh_suspicious_flags(report_id, previous=None):
    report = Report.objects.filter(pk=report_id).first()
    affected = Q(pk=report_id)
    for values in (previous, report):
        if values and values.reporter_email and values.date_reported:
            affected |= Q(reporter_email__iexact=values.reporter_email.strip(), date_reported__range=(
                values.date_reported - BURST_WINDOW, values.date_reported + BURST_WINDOW))
    for candidate in Report.objects.filter(affected).iterator():
        flags = flags_for_report(candidate)
        if candidate.suspicious_flags != flags:
            Report.objects.filter(pk=candidate.pk).update(suspicious_flags=flags)


def schedule_suspicious_check(instance, previous=None):
    report_id = instance.pk
    transaction.on_commit(lambda: refresh_suspicious_flags(report_id, previous), robust=True)
