import re
from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand

from reports.duplicates import fingerprint_file, flag_duplicate_reports
from reports.models import Report
from reports.visual_similarity import visual_fingerprint


class Command(BaseCommand):
    help = "Fingerprint existing evidence and flag possible duplicates without changing report status."

    def handle(self, *args, **options):
        hashed, missing = 0, 0
        for report in Report.objects.order_by("pk").iterator():
            updates = {}
            if not report.occurred_at:
                date = re.search(r"^Date: (\d{4}-\d{2}-\d{2})\s*$", report.description, re.MULTILINE)
                time = re.search(r"^Time: (\d{2}:\d{2})(?::\d{2})?\s*$", report.description, re.MULTILINE)
                if date and time:
                    try:
                        updates["occurred_at"] = datetime.fromisoformat(f"{date[1]}T{time[1]}:00").replace(tzinfo=timezone(timedelta(hours=8)))
                    except ValueError:
                        pass
            if report.image and (not report.evidence_sha256 or not report.evidence_visual):
                try:
                    with report.image.open("rb") as evidence:
                        updates["evidence_sha256"] = fingerprint_file(evidence)
                        updates["evidence_visual"] = visual_fingerprint(evidence)
                    hashed += 1
                except OSError:
                    missing += 1
            if updates:
                Report.objects.filter(pk=report.pk).update(**updates)
        for report_id in Report.objects.values_list("pk", flat=True).iterator():
            flag_duplicate_reports(report_id)
        self.stdout.write(f"Evidence files processed: {hashed}; unavailable files skipped: {missing}. Report statuses preserved.")
