"""Configure the local Django environment for a Tailscale Funnel hostname."""

import secrets
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/configure_public_env.py <device>.<tailnet>.ts.net")
    host = sys.argv[1].strip().lower().rstrip(".")
    if not host.endswith(".ts.net") or "/" in host or ":" in host or " " in host:
        raise SystemExit("Expected a Tailscale DNS hostname ending in .ts.net")

    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    if not env_path.is_file():
        raise SystemExit("backend/.env is missing")
    lines = env_path.read_text(encoding="utf-8").splitlines()
    values = {}
    positions = {}
    for index, line in enumerate(lines):
        if line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
        positions[key.strip()] = index

    def set_value(key, value):
        line = f"{key}={value}"
        values[key] = value
        if key in positions:
            lines[positions[key]] = line
        else:
            positions[key] = len(lines)
            lines.append(line)

    def append_csv(key, item):
        items = [part.strip() for part in values.get(key, "").split(",") if part.strip()]
        if item not in items:
            items.append(item)
        set_value(key, ",".join(items))

    secret = values.get("DJANGO_SECRET_KEY", "")
    if len(secret) < 50 or secret.startswith("django-insecure-"):
        set_value("DJANGO_SECRET_KEY", secrets.token_urlsafe(64))
    set_value("DJANGO_DEBUG", "False")
    append_csv("DJANGO_ALLOWED_HOSTS", host)
    append_csv("DJANGO_CORS_ALLOWED_ORIGINS", f"https://{host}")
    append_csv("DJANGO_CSRF_TRUSTED_ORIGINS", f"https://{host}")
    for allowed_host in [item.strip() for item in values.get("DJANGO_ALLOWED_HOSTS", "").split(",")]:
        if allowed_host and allowed_host != "*":
            append_csv("RECAPTCHA_ALLOWED_HOSTNAMES", allowed_host)
    append_csv("RECAPTCHA_ALLOWED_HOSTNAMES", host)
    set_value("FRONTEND_URL", f"https://{host}")
    set_value("DJANGO_TRUST_HTTPS_PROXY", "True")
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Configured public origin: https://{host}")


if __name__ == "__main__":
    main()
