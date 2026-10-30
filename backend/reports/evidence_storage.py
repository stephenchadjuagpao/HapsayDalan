import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage, storages
from django.utils.deconstruct import deconstructible


@deconstructible
class EvidenceStorage(Storage):
    """Follow-up files are served by the owner/staff API, never MEDIA_URL."""
    @property
    def backend(self):
        alias = getattr(settings, "EVIDENCE_STORAGE_ALIAS", None)
        if alias:
            return storages[alias]
        return FileSystemStorage(location=settings.PRIVATE_EVIDENCE_ROOT)

    def _open(self, name, mode="rb"):
        return self.backend.open(name, mode)

    def _save(self, name, content):
        return self.backend.save(name, content)

    def exists(self, name):
        return self.backend.exists(name)

    def delete(self, name):
        return self.backend.delete(name)

    def size(self, name):
        return self.backend.size(name)

    def path(self, name):
        return self.backend.path(name)

    def url(self, name):
        raise ValueError("Additional evidence requires authenticated access.")


def evidence_upload_path(instance, filename):
    return f"{instance.report_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"
