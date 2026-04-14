import random
from django.db import migrations


def generate_reference_id(Report):
    while True:
        candidate = f"SUP-{random.randint(10_000_000, 99_999_999)}"
        if not Report.objects.filter(reference_id=candidate).exists():
            return candidate


def randomize_reference_ids(apps, schema_editor):
    Report = apps.get_model("reports", "Report")

    for report in Report.objects.all().order_by("id"):
        report.reference_id = generate_reference_id(Report)
        report.save(update_fields=["reference_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0005_report_reference_id"),
    ]

    operations = [
        migrations.RunPython(randomize_reference_ids, migrations.RunPython.noop),
    ]
