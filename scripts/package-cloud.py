"""Build a clean source ZIP, excluding local credentials, data and Git history."""
from pathlib import Path
import os
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "deploy" / "runtime" / "hapsaydalan-cloud-source.zip"
EXCLUDED = {"node_modules", "venv", ".venv", ".git", "__pycache__", ".certs",
            "build", "coverage", ".npm-cache", "media", "private_evidence", "staticfiles"}


def include(path):
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED for part in relative.parts):
        return False
    if path.name.startswith(".env") or path.name == "hapsaydalan-local-ca.cer":
        return False
    if relative.parts[0] == "backend":
        return path.suffix in {".py", ".txt"} or path.name in {"Dockerfile", ".dockerignore"}
    return path.suffix.lower() not in {".log", ".pem", ".key", ".cer", ".pyc", ".sql", ".dump", ".zip"}


if __name__ == "__main__":
    candidates = [ROOT / name for name in (
        "render.yaml", ".dockerignore", ".gitignore", ".gitattributes", "deploy/CLOUD_HOSTING.md",
        "scripts/cloud-manage.py", "scripts/package-cloud.py",
        "deploy/cloud.env.example",
    )]
    for directory in ("backend", "frontend", "deploy/cloud"):
        for parent, directories, files in os.walk(ROOT / directory):
            directories[:] = [name for name in directories if name not in EXCLUDED]
            candidates.extend(path for name in files if include(path := Path(parent) / name))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
        for path in sorted(candidates):
            archive.write(path, path.relative_to(ROOT).as_posix())
    print(f"Created clean cloud source: {OUTPUT}")
    print(f"Files: {len(candidates)}. Local accounts, evidence, credentials and Git history are excluded.")
