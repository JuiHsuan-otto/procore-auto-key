#!/usr/bin/env python3
"""Commit and push an approved ProCore case pack.

This script intentionally stages only the files that the ProCore website
publishing flow is expected to touch, so local automation code edits do not
get swept into a case deployment commit by accident.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.carkey.com.tw"


def clean_link(raw_path: str) -> str:
    link = str(raw_path or "").strip()
    if not link.startswith("/"):
        link = f"/{link}"
    if link.endswith(".html"):
        link = link[:-5]
    return link


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def run(command: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if check and result.returncode != 0:
        output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
        raise SystemExit(f"Command failed ({result.returncode}): {' '.join(command)}\n{output}")
    return result


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def candidate_files(pack: Path, publish_args: dict) -> list[Path]:
    link = clean_link(publish_args["path"])
    slug = link.strip("/")
    files = [
        ROOT / f"{slug}.html",
        ROOT / "blog.json",
        ROOT / "blog.html",
        ROOT / "cases.html",
        ROOT / "cases.json",
        ROOT / "sitemap.xml",
        ROOT / "index.html",
    ]

    case_img = str(publish_args.get("caseImg") or "").replace("\\", "/").lstrip("/")
    if case_img and not case_img.startswith(("http://", "https://")):
        image_path = ROOT / case_img
        if image_path.exists():
            files.append(image_path)

    return [path for path in files if path.exists()]


def git_stage(files: list[Path]) -> None:
    if not files:
        raise SystemExit("No deployable files found.")
    run(["git", "add", "--", *[rel(path) for path in files]])


def git_staged_files() -> list[str]:
    result = run(["git", "diff", "--cached", "--name-only"])
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def git_has_staged_changes() -> bool:
    result = run(["git", "diff", "--cached", "--quiet"], check=False)
    return result.returncode != 0


def git_branch() -> str:
    result = run(["git", "branch", "--show-current"])
    branch = result.stdout.strip()
    return branch or "main"


def git_commit(title: str, link: str) -> str:
    subject = title.replace("\n", " ").strip()
    if len(subject) > 72:
        subject = subject[:69].rstrip() + "..."
    message = f"Add ProCore case: {subject}"
    run(["git", "commit", "-m", message, "-m", f"Official URL: {SITE}{link}"])
    result = run(["git", "rev-parse", "--short", "HEAD"])
    return result.stdout.strip()


def git_push(branch: str) -> None:
    run(["git", "push", "origin", branch])


def blogger_env_ready() -> bool:
    return all(os.environ.get(name) for name in ["BLOGGER_SMTP_USER", "BLOGGER_SMTP_APP_PASSWORD"])


def publish_blogger(pack: Path, publish_args: dict) -> str:
    if not blogger_env_ready():
        return "BLOGGER=skipped missing BLOGGER_SMTP_USER/BLOGGER_SMTP_APP_PASSWORD"
    html_path = pack / "blogger.html"
    if not html_path.exists():
        return "BLOGGER=skipped missing blogger.html"

    case_img = str(publish_args.get("caseImg") or "").replace("\\", "/").lstrip("/")
    image_arg = ""
    if case_img and not case_img.startswith(("http://", "https://")) and (ROOT / case_img).exists():
        image_arg = str(ROOT / case_img)

    command = [
        sys.executable,
        str(ROOT / "scripts" / "blogger" / "auto_publish.py"),
        publish_args["title"],
        html_path.read_text(encoding="utf-8"),
    ]
    if image_arg:
        command.append(image_arg)
    result = run(command, check=False)
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    if result.returncode == 0:
        return "BLOGGER=published\n" + output
    return "BLOGGER=failed\n" + output


def deploy(args: argparse.Namespace) -> None:
    pack = Path(args.pack).resolve()
    if not pack.exists():
        raise SystemExit(f"Pack not found: {pack}")

    publish_args = read_json(pack / "publish-tool-args.json")
    link = clean_link(publish_args["path"])
    files = candidate_files(pack, publish_args)

    blogger_status = "BLOGGER=not_requested"
    if args.blogger:
        blogger_status = publish_blogger(pack, publish_args)

    existing_staged = git_staged_files()
    if existing_staged:
        print("DEPLOY=blocked")
        print("REASON=git index already has staged files")
        print("STAGED=" + ",".join(existing_staged))
        print(blogger_status)
        raise SystemExit(2)

    git_stage(files)
    if not git_has_staged_changes():
        print("DEPLOY=skipped")
        print("REASON=no staged website changes")
        print(blogger_status)
        print(f"URL={SITE}{link}")
        return

    commit = git_commit(publish_args["title"], link)
    branch = git_branch()
    if not args.no_push:
        git_push(branch)
        pushed = "1"
    else:
        pushed = "0"

    print("DEPLOY=1")
    print(f"COMMIT={commit}")
    print(f"BRANCH={branch}")
    print(f"PUSHED={pushed}")
    print(f"URL={SITE}{link}")
    print("FILES=" + ",".join(rel(path) for path in files))
    print(blogger_status)


def main() -> None:
    parser = argparse.ArgumentParser(description="Commit and push an approved ProCore case pack.")
    parser.add_argument("pack", help="Approved draft pack directory.")
    parser.add_argument("--no-push", action="store_true", help="Commit only; do not push.")
    parser.add_argument("--blogger", action="store_true", help="Publish Blogger draft if SMTP env vars are set.")
    args = parser.parse_args()
    deploy(args)


if __name__ == "__main__":
    main()
