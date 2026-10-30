import hashlib
import math
from datetime import timedelta

from django.db import transaction
from django.db.models import Q

from .models import Report, ReportDuplicateMatch
from .visual_similarity import visually_similar

DUPLICATE_DISTANCE_METERS = 100
DUPLICATE_TIME_WINDOW = timedelta(minutes=30)


def fingerprint_file(file):
    """Hash bytes, independent of filename, without consuming the upload stream."""
    original_position = file.tell()
    digest = hashlib.sha256()
    size = 0
    try:
        file.seek(0)
        for chunk in file.chunks():
            digest.update(chunk)
            size += len(chunk)
    finally:
        file.seek(original_position)
    return digest.hexdigest() if size else ""


def valid_coordinates(report):
    return (report.latitude is not None and report.longitude is not None and
            math.isfinite(float(report.latitude)) and math.isfinite(float(report.longitude)) and
            abs(report.latitude) <= 90 and abs(report.longitude) <= 180)


def distance_meters(first, second):
    lat1, lat2 = math.radians(float(first.latitude)), math.radians(float(second.latitude))
    lat_delta = lat2 - lat1
    lng_delta = math.radians(float(second.longitude) - float(first.longitude))
    a = math.sin(lat_delta / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(lng_delta / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(min(1, max(0, a))))


def flag_duplicate_reports(report_id, reset=False):
    report = Report.objects.filter(pk=report_id).first()
    if not report:
        return
    if reset:
        ReportDuplicateMatch.objects.filter(Q(first_report_id=report_id) | Q(second_report_id=report_id)).delete()
    if not report.evidence_sha256 or not valid_coordinates(report):
        return
    event_time = report.occurred_at or report.date_reported
    start, end = event_time - DUPLICATE_TIME_WINDOW, event_time + DUPLICATE_TIME_WINDOW
    candidates = Report.objects.exclude(pk=report.pk).filter(
        latitude__range=(float(report.latitude) - 0.00091, float(report.latitude) + 0.00091),
    ).filter(
        Q(occurred_at__range=(start, end)) | Q(occurred_at__isnull=True, date_reported__range=(start, end))
    )
    if report.evidence_visual:
        candidates = candidates.filter(Q(evidence_sha256=report.evidence_sha256) | ~Q(evidence_visual={}))
    else:
        candidates = candidates.filter(evidence_sha256=report.evidence_sha256)
    violation = " ".join(report.violation_type.split()).casefold()
    for other in candidates.iterator():
        if " ".join(other.violation_type.split()).casefold() != violation or not valid_coordinates(other):
            continue
        distance = distance_meters(report, other)
        if distance > DUPLICATE_DISTANCE_METERS:
            continue
        exact = report.evidence_sha256 == other.evidence_sha256
        if not exact and not visually_similar(report.evidence_visual, other.evidence_visual):
            continue
        first, second = sorted((report.pk, other.pk))
        ReportDuplicateMatch.objects.get_or_create(first_report_id=first, second_report_id=second, defaults={
            "distance_m": distance,
            "match_type": "exact" if exact else "visual",
            "time_difference_seconds": abs((event_time - (other.occurred_at or other.date_reported)).total_seconds()),
        })


def schedule_duplicate_check(report_id, reset=False):
    # Run after commit: a concurrent submission that commits later can then see
    # the earlier report. Canonical pairs prevent two callbacks creating repeats.
    transaction.on_commit(lambda: flag_duplicate_reports(report_id, reset=reset), robust=True)
