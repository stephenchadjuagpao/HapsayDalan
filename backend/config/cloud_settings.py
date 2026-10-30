"""Cloud-only settings; the laptop deployment keeps using config.settings."""
import os

os.environ["DJANGO_LOAD_ENV_FILE"] = "False"
os.environ["DJANGO_DEBUG"] = "False"
os.environ["DJANGO_AUTO_LAN_HOSTS"] = "False"

from .settings import *  # noqa: E402,F403
import dj_database_url
from botocore.config import Config


def required(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"Cloud deployment requires {name}.")
    return value


cloud_hostname = required("RENDER_EXTERNAL_HOSTNAME")
if "/" in cloud_hostname or ":" in cloud_hostname:
    raise ImproperlyConfigured("RENDER_EXTERNAL_HOSTNAME must be a hostname only.")
ALLOWED_HOSTS = [cloud_hostname, "localhost", "127.0.0.1"]
FRONTEND_URL = f"https://{cloud_hostname}"
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
# We do not own Render's parent domain or arbitrary subdomains of this hostname.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
SECURE_REDIRECT_EXEMPT = [r"^healthz$"]

DATABASES = {"default": dj_database_url.parse(
    required("DATABASE_URL"), conn_max_age=60, conn_health_checks=True, ssl_require=True,
)}
DATABASES["default"]["OPTIONS"]["connect_timeout"] = 10

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "access_key": required("EVIDENCE_S3_ACCESS_KEY_ID"),
            "secret_key": required("EVIDENCE_S3_SECRET_ACCESS_KEY"),
            "bucket_name": required("EVIDENCE_S3_BUCKET"),
            "endpoint_url": required("EVIDENCE_S3_ENDPOINT_URL"),
            "region_name": required("EVIDENCE_S3_REGION"),
            "signature_version": "s3v4",
            "client_config": Config(
                signature_version="s3v4", s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
            "addressing_style": "path",
            "default_acl": None,
            "querystring_auth": True,
            "querystring_expire": 3600,
            "file_overwrite": False,
            "location": "media",
            "max_memory_size": 5 * 1024 * 1024,
        },
    },
    "private_evidence": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {},
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if not STORAGES["default"]["OPTIONS"]["endpoint_url"].startswith("https://"):
    raise ImproperlyConfigured("Evidence storage requires an HTTPS endpoint.")
STORAGES["private_evidence"]["OPTIONS"] = {
    **STORAGES["default"]["OPTIONS"], "location": "private-evidence",
}
EVIDENCE_STORAGE_ALIAS = "private_evidence"
STATIC_URL = "/static/"
FRONTEND_BUILD_ROOT = BASE_DIR / "frontend_build"
WHITENOISE_ROOT = FRONTEND_BUILD_ROOT
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
ROOT_URLCONF = "config.cloud_urls"

# Render Free blocks SMTP ports. All existing send_mail calls use HTTPS here.
EMAIL_BACKEND = "reports.email_backend.BrevoEmailBackend"
BREVO_API_KEY = required("BREVO_API_KEY")
DEFAULT_FROM_EMAIL = required("DEFAULT_FROM_EMAIL")
RECAPTCHA_SITE_KEY = required("RECAPTCHA_SITE_KEY")
RECAPTCHA_SECRET_KEY = required("RECAPTCHA_SECRET_KEY")
RECAPTCHA_ALLOWED_HOSTNAMES = [cloud_hostname]
