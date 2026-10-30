"""Choose the frontend URL actually used for a local-network request."""
from urllib.parse import urlsplit

from django.conf import settings

from config.network import current_lan_addresses


def frontend_url_for_request(request):
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin not in settings.CORS_ALLOWED_ORIGINS:
        return settings.FRONTEND_URL
    parsed = urlsplit(origin)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.path or parsed.query or parsed.fragment:
        return settings.FRONTEND_URL
    if settings.DEBUG and parsed.hostname not in {"localhost", "127.0.0.1", *current_lan_addresses()}:
        return settings.FRONTEND_URL
    return origin
