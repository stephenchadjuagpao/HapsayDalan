"""Run a Django cloud command with credentials from an ignored local env file."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
envfile = ROOT / "deploy" / ".env.cloud"
if not envfile.is_file():
    raise SystemExit("Create deploy/.env.cloud from deploy/cloud.env.example first.")
for line in envfile.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    os.environ[key.strip()] = value
os.environ["DJANGO_SETTINGS_MODULE"] = "config.cloud_settings"
os.environ["DJANGO_LOAD_ENV_FILE"] = "False"
sys.path.insert(0, str(ROOT / "backend"))
from django.core.management import execute_from_command_line

execute_from_command_line(["manage.py", *sys.argv[1:]])
