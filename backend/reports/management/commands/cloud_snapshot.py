"""Transfer app data separately from source code, only into an empty app database."""
import json
from io import StringIO
from pathlib import Path

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError, call_command
from django.db import transaction

from reports.models import Officer

SEED_OFFICERS = {
    ("Officer Santos", "CTMO-104", "Traffic Enforcer Unit 1"),
    ("Officer Reyes", "CTMO-118", "Mobile Patrol Unit"),
    ("Officer Dela Cruz", "CTMO-205", "Central District Unit"),
    ("Officer Martinez", "CTMO-312", "Highway Patrol Unit"),
}


class Command(BaseCommand):
    help = "Export a private JSON snapshot or import it into a new cloud app database."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["export", "import"])
        parser.add_argument("filename", type=Path)

    def handle(self, action, filename, **options):
        if filename.suffix != ".json":
            raise CommandError("Use a .json filename for the app snapshot.")
        if action == "export":
            # Exclusive create prevents replacing an earlier backup.
            buffer = StringIO()
            call_command("dumpdata", "auth.group", "auth.user", "reports", natural_foreign=True,
                         stdout=buffer, verbosity=0)
            with filename.open("x", encoding="utf-8") as output:
                output.write(buffer.getvalue())
            self.stdout.write("Private snapshot exported. Do not commit or publish this file.")
            return
        with filename.open(encoding="utf-8") as source:
            records = json.load(source)
        allowed = {"auth.group", "auth.user"} | {m._meta.label_lower for m in apps.get_app_config("reports").get_models()}
        if not isinstance(records, list) or any(not isinstance(row, dict) or row.get("model") not in allowed for row in records):
            raise CommandError("Not an app snapshot. No data was imported.")
        # migrate seeds four officers. Replace those only inside this transaction.
        # Never merge over a running deployment or overwrite users/cases.
        models = [get_user_model(), apps.get_model("auth", "Group")]
        models += [m for m in apps.get_app_config("reports").get_models() if m is not Officer]
        with transaction.atomic():
            if any(model.objects.exists() for model in models):
                raise CommandError("Destination contains app data. Import requires a new empty app database.")
            existing_officers = set(Officer.objects.values_list("name", "badge", "unit"))
            if existing_officers and existing_officers != SEED_OFFICERS:
                raise CommandError("Destination has a modified officer directory. Nothing was imported.")
            Officer.objects.all().delete()
            call_command("loaddata", str(filename), verbosity=0)
        self.stdout.write("App snapshot imported. Copy both evidence folders to cloud storage before switching links.")
