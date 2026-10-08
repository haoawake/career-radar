#!/usr/bin/env python3
"""Create platform-labelled source+launcher ZIPs for the local Workers app.

Career Radar uses vinext + Cloudflare D1, not a native desktop runtime.
The local launcher installs Node dependencies and starts the local web server.
"""
import argparse
import pathlib
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--platform", choices=("win", "mac"), required=True)
args = parser.parse_args()
out = ROOT / "dist"
out.mkdir(exist_ok=True)
name = "CareerRadar-win-x64.zip" if args.platform == "win" else "CareerRadar-mac-universal.zip"
launcher = "Start-Career-Radar.cmd" if args.platform == "win" else "Start-Career-Radar.command"
files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
with zipfile.ZipFile(out / name, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for relative in files:
        if not relative or relative.startswith((".github/", "distribution/", "tests/", "docs/")):
            continue
        if relative in {".gitignore", ".gitattributes", "Start-Radar.bat"}:
            continue
        filename = ROOT / relative
        if filename.is_file():
            archive.write(filename, "CareerRadar/" + relative)
    entry = zipfile.ZipInfo("CareerRadar/" + launcher)
    entry.create_system = 3
    entry.external_attr = (0o100755 if args.platform == "mac" else 0o100644) << 16
    archive.writestr(entry, (ROOT / "distribution" / launcher).read_bytes())
    intro = """Career Radar / 职达

This is a local web application, NOT a native Windows or macOS binary.
Requires Node.js 22.13+ and an internet connection at first launch.
Your local database is stored under .wrangler/state in this folder.
Do not run it from a temporary unzip folder.

Windows: double-click Start-Career-Radar.cmd
macOS: double-click Start-Career-Radar.command (or run it from Terminal)
Open the local address shown in the terminal. Keep the terminal running.
See README.zh-CN.md for details.
"""
    archive.writestr("CareerRadar/INSTALL.txt", intro)
with zipfile.ZipFile(out / name) as check:
    assert check.testzip() is None
    assert "CareerRadar/package.json" in check.namelist()
    assert "CareerRadar/wrangler.local.json" in check.namelist()
    assert "CareerRadar/.openai/hosting.json" in check.namelist()
    assert "CareerRadar/" + launcher in check.namelist()
print(out / name)
