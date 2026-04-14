from django.db import migrations, models


def populate_reference_ids(apps, schema_editor):
    Report = apps.get_model("reports", "Report")

    for report in Report.objects.filter(reference_id__isnull=True).order_by("id"):
        report.reference_id = f"SUP-{report.id:03d}"
        report.save(update_fields=["reference_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0004_report_latitude_report_longitude"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="reference_id",
            field=models.CharField(blank=True, editable=False, max_length=32, null=True, unique=True),
        ),
        migrations.RunPython(populate_reference_ids, migrations.RunPython.noop),
    ]
