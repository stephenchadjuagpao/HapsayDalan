"""Freeze a retired laptop deployment while its data moves to cloud hosting."""
import json
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse


class CloudMigrationGate:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        state_file = Path(getattr(settings, "CLOUD_MIGRATION_STATE_FILE", settings.BASE_DIR / ".cloud-migration.json"))
        if not state_file.exists():
            return self.get_response(request)
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
            target = state.get("target", "").rstrip("/")
            parsed = urlsplit(target)
            valid_target = (parsed.scheme == "https" and parsed.hostname and not parsed.username
                            and not parsed.password and not parsed.path and not parsed.query and not parsed.fragment)
            if state.get("mode") == "redirect" and valid_target:
                if request.method in {"GET", "HEAD"}:
                    response = HttpResponseRedirect(target + request.get_full_path())
                else:
                    response = JsonResponse({"detail": "This site has moved. Open the cloud website to continue.",
                                             "website": target}, status=503)
            else:
                response = JsonResponse({"detail": "Reports are being moved to cloud hosting. Please try again shortly."}, status=503)
        except (OSError, ValueError, TypeError, AttributeError):
            response = JsonResponse({"detail": "The site is temporarily unavailable during migration."}, status=503)
        response["Cache-Control"] = "no-store"
        response["Retry-After"] = "120"
        return response
