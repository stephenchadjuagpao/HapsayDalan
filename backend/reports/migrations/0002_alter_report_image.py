from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="report",
            name="image",
            field=models.FileField(upload_to="reports/"),
        ),
    ]
