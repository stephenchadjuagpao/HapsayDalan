from django.conf import settings


def email_delivery_configured():
    backend = settings.EMAIL_BACKEND
    if backend == "django.core.mail.backends.locmem.EmailBackend":
        return True
    if not settings.DEFAULT_FROM_EMAIL:
        return False
    if backend == "reports.email_backend.BrevoEmailBackend":
        return bool(getattr(settings, "BREVO_API_KEY", ""))
    return backend == "django.core.mail.backends.smtp.EmailBackend" and bool(settings.EMAIL_HOST)
