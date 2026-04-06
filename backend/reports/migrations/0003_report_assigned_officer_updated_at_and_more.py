from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0002_alter_report_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="assigned_officer",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="report",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="report",
            name="status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Validated", "Validated"),
                    ("Assigned", "Assigned"),
                    ("In Progress", "In Progress"),
                    ("Rejected", "Rejected"),
                    ("Resolved", "Resolved"),
                ],
                default="Pending",
                max_length=20,
            ),
        ),
    ]
