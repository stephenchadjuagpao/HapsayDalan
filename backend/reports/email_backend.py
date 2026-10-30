"""Transactional delivery over HTTPS for hosts that block outbound SMTP."""
import json
from email.utils import parseaddr
from smtplib import SMTPException
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


def address(value):
    name, email = parseaddr(value)
    if not email or "@" not in email or "\n" in value or "\r" in value:
        raise ValueError("Invalid email address.")
    return {"email": email, **({"name": name} if name else {})}


class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages or []:
            if not message.recipients():
                continue
            try:
                if not getattr(settings, "BREVO_API_KEY", ""):
                    raise ValueError("HTTPS email API key is not configured.")
                # Validate Django's normal header checks before sending JSON.
                message.message()
                payload = {"sender": address(message.from_email), "subject": message.subject,
                           "textContent": message.body}
                for field in ("to", "cc", "bcc"):
                    if getattr(message, field):
                        payload[field] = [address(value) for value in getattr(message, field)]
                if message.reply_to:
                    payload["replyTo"] = address(message.reply_to[0])
                for alternative in getattr(message, "alternatives", []):
                    if alternative.mimetype == "text/html":
                        payload["htmlContent"] = alternative.content
                if message.attachments:
                    raise ValueError("This email backend does not support attachments.")
                request = Request("https://api.brevo.com/v3/smtp/email",
                                  data=json.dumps(payload).encode("utf-8"), method="POST",
                                  headers={"api-key": settings.BREVO_API_KEY,
                                           "Content-Type": "application/json", "Accept": "application/json"})
                with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                    result = json.loads(response.read())
                    if response.status != 201 or not result.get("messageId"):
                        raise ValueError("Email was not accepted.")
            except (URLError, OSError, ValueError):
                if not self.fail_silently:
                    # Do not expose provider response bodies, recipients or API keys.
                    raise SMTPException("HTTPS email delivery failed.") from None
            else:
                sent += 1
        return sent
