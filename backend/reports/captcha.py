import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError
from config.network import current_lan_addresses


class CaptchaUnavailable(APIException):
    status_code = 503
    default_detail = "CAPTCHA verification is unavailable. Please try again later."


def verify_report_captcha(token):
    if not settings.RECAPTCHA_SITE_KEY or not settings.RECAPTCHA_SECRET_KEY:
        raise CaptchaUnavailable("CAPTCHA is not configured yet. Please contact the administrator.")
    if not isinstance(token, str) or not token.strip() or len(token) > 8192:
        raise ValidationError({"captcha_token": "Please complete the CAPTCHA before submitting."})
    request = Request(
        "https://www.google.com/recaptcha/api/siteverify",
        data=urlencode({"secret": settings.RECAPTCHA_SECRET_KEY, "response": token}).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        raise CaptchaUnavailable() from None
    if not isinstance(result, dict):
        raise CaptchaUnavailable()
    if result.get("success") is not True:
        codes = result.get("error-codes")
        if isinstance(codes, list) and {"invalid-input-secret", "missing-input-secret"}.intersection(codes):
            raise CaptchaUnavailable("CAPTCHA configuration could not be verified. Please contact the administrator.")
        raise ValidationError({"captcha_token": "CAPTCHA expired or could not be verified. Please complete a new challenge."})
    hostname = result.get("hostname")
    allowed_hosts = {host.lower() for host in settings.RECAPTCHA_ALLOWED_HOSTNAMES}
    if settings.DEBUG and settings.AUTO_LAN_HOSTS:
        allowed_hosts.update(current_lan_addresses())
    if not isinstance(hostname, str) or hostname.lower() not in allowed_hosts:
        raise ValidationError({"captcha_token": "CAPTCHA is not valid for this website. Please try again."})
