"""Copy local evidence to configured object storage without changing DB filenames."""
import hashlib
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.files.storage import storages
from django.core.management import BaseCommand, CommandError

from reports.models import Report, ReportEvidenceRequest


def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(chunk)
    return result.digest()


class Command(BaseCommand):
    help = "Upload referenced evidence from local folders to cloud storage; existing objects must match."

    def add_arguments(self, parser):
        parser.add_argument("--media-root", required=True, type=Path)
        parser.add_argument("--private-root", required=True, type=Path)

    def handle(self, media_root, private_root, **options):
        if getattr(settings, "EVIDENCE_STORAGE_ALIAS", None) != "private_evidence":
            raise CommandError("Run with config.cloud_settings and destination cloud credentials.")
        copied = 0
        for model, field, directory, alias in (
            (Report, "image", media_root, "default"),
            (ReportEvidenceRequest, "attachment", private_root, "private_evidence"),
        ):
            storage = storages[alias]
            for name in model.objects.exclude(**{field: ""}).values_list(field, flat=True).distinct().iterator():
                root = directory.resolve()
                source = (root / name).resolve()
                if not source.is_relative_to(root) or not source.is_file():
                    raise CommandError("Referenced evidence is missing or outside the supplied folder. Upload stopped.")
                with source.open("rb") as file:
                    original_hash = digest(file)
                    if not storage.exists(name):
                        file.seek(0)
                        saved = storage.save(name, File(file))
                        if saved != name:
                            storage.delete(saved)
                            raise CommandError("Storage renamed a file. Upload stopped to preserve DB references.")
                    with storage.open(name, "rb") as remote:
                        if digest(remote) != original_hash:
                            raise CommandError("Existing cloud evidence differs from the local file. Nothing was overwritten.")
                copied += 1
        self.stdout.write(f"Verified {copied} evidence files in cloud storage. Local originals were retained.")
