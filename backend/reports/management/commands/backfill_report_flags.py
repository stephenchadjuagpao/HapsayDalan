from django.core.management.base import BaseCommand

from reports.models import Report
from reports.suspicious import flags_for_report


class Command(BaseCommand):
    help = "Refresh review flags for existing reports without changing their status."

    def handle(self, *args, **options):
        count = 0
        for report in Report.objects.all().iterator():
            flags = flags_for_report(report)
            Report.objects.filter(pk=report.pk).update(suspicious_flags=flags)
            count += bool(flags)
        self.stdout.write(f"Updated review flags: {count} reports flagged. Case statuses unchanged.")
