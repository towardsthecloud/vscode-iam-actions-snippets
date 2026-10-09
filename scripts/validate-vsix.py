"""Validate and unpack the exact VSIX that integration tests and publishing use."""

import importlib.util
import json
import shutil
import sys
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "generator", root / "src/update-iam-action-snippets.py"
)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

archive_path = Path(sys.argv[1])
destination = root / ".vscode-test/packaged"
with ZipFile(archive_path) as archive:
    package = json.loads(archive.read("extension/package.json"))
    main = "extension/" + package["main"].removeprefix("./")
    if main not in archive.namelist():
        raise SystemExit(f"Missing extension entry point: {main}")
    catalog = json.loads(archive.read("extension/snippets/iam-actions.json"))
    total = module.validate_catalog(catalog)
    for name in archive.namelist():
        if not (destination / name).resolve().is_relative_to(destination.resolve()):
            raise SystemExit(f"Unsafe archive path: {name}")
    if destination.exists():
        shutil.rmtree(destination)
    archive.extractall(destination)
print(
    f"Validated {archive_path}: {total} actions, {len(catalog)} services; unpacked for integration tests"
)
