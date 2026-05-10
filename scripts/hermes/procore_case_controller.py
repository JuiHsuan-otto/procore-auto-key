#!/usr/bin/env python3
"""Hermes-facing controller for the ProCore case publishing pipeline.

This script does not call an LLM. It prepares briefs for Hermes, accepts
Hermes-authored aiCopy JSON, and delegates mechanical work to the existing
content automation scripts.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLAYBOOKS = [
    ROOT / "ops" / "hermes_memory" / "PROCORE_CONTENT_PLAYBOOK.md",
    ROOT / "ops" / "hermes_memory" / "PROCORE_LEAD_STRATEGY.md",
    ROOT / "ops" / "hermes_memory" / "PUBLISH_QA_RULES.md",
]


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_repo_path(path_value: str) -> Path:
    path = Path(path_value)
    if not path.is_absolute():
        path = ROOT / path
    return path


def command_intake(args: argparse.Namespace) -> int:
    out_path = resolve_repo_path(args.out)
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "procore_mobile_intake.py"),
        "--message",
        args.message,
        "--out",
        str(out_path),
    ]
    for photo in args.photo:
        command.extend(["--photo", photo])
    result = run(command)
    print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    return result.returncode


def command_brief(args: argparse.Namespace) -> int:
    intake_path = resolve_repo_path(args.intake)
    intake = read_json(intake_path)
    vehicle = intake.get("vehicle", {})
    context = intake.get("caseContext", {})
    seo = intake.get("seo", {})
    locked_facts = {
        "publicLocation": clean(context.get("publicLocation")),
        "year": clean(vehicle.get("year")),
        "vehicleLabel": clean(vehicle.get("publicVehicleLabel")),
        "issueType": clean(context.get("issueType")),
        "serviceType": clean(context.get("serviceType")),
        "result": clean(context.get("result")),
    }
    brief = {
        "task": "Write Hermes-authored ProCore aiCopy JSON. Do not publish.",
        "intake": intake_path.relative_to(ROOT).as_posix() if intake_path.is_relative_to(ROOT) else str(intake_path),
        "lockedFacts": locked_facts,
        "seo": {
            "primaryKeyword": clean(seo.get("primaryKeyword")),
            "secondaryKeywords": seo.get("secondaryKeywords", []),
        },
        "requiredOutput": {
            "provider": "hermes",
            "status": "ok",
            "title": "Must include publicLocation, year, and vehicleLabel.",
            "h1": "Must include publicLocation, year, and vehicleLabel.",
            "metaDescription": "70-150 zh-TW chars.",
            "summary": "Must include locked facts and owner next step.",
            "primaryKeyword": "Must include location and vehicle.",
            "secondaryKeywords": [],
            "searchIntent": "",
            "conversionAngle": "",
            "cta": "",
            "sections": [{"heading": "", "body": ""}],
            "bloggerTitle": "",
            "bloggerHtml": "",
            "threads": [],
            "gbpSummary": "",
        },
        "readBeforeWriting": [path.relative_to(ROOT).as_posix() for path in PLAYBOOKS],
    }
    if args.out:
        out_path = resolve_repo_path(args.out)
        write_json(out_path, brief)
        print(f"BRIEF={out_path.relative_to(ROOT).as_posix() if out_path.is_relative_to(ROOT) else out_path}")
    else:
        print(json.dumps(brief, ensure_ascii=False, indent=2))
    return 0


def command_pack(args: argparse.Namespace) -> int:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "procore_case_pack.py"),
        "--intake",
        str(resolve_repo_path(args.intake)),
        "--ai-copy",
        str(resolve_repo_path(args.ai_copy)),
    ]
    if args.out:
        command.extend(["--out", args.out])
    result = run(command)
    print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    return result.returncode


def command_validate(args: argparse.Namespace) -> int:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "validate_content_pack.py"),
        str(resolve_repo_path(args.pack)),
    ]
    result = run(command)
    print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    return result.returncode


def command_prompt(args: argparse.Namespace) -> int:
    intake_path = resolve_repo_path(args.intake)
    print(
        "\n".join(
            [
                "請讀取以下 ProCore 規則，替這個 intake 寫 Hermes aiCopy JSON，不要發布：",
                "",
                *[f"- {path.relative_to(ROOT).as_posix()}" for path in PLAYBOOKS],
                f"- {intake_path.relative_to(ROOT).as_posix() if intake_path.is_relative_to(ROOT) else intake_path}",
                "",
                "輸出只要 JSON，必須符合 scripts/hermes/procore_case_controller.py brief 的 requiredOutput 欄位。",
                "title、h1、summary、primaryKeyword 必須包含地點、年份、車款。",
                "不准使用 Gemini，不准寫入官網，不准 commit/push。",
                "如果 JSON 很長，請直接寫入 drafts/intakes/*-case-ai-copy.json 並回報路徑，不要貼成多段 Discord 訊息。",
                "流程完成時請回報 INTAKE、AI_COPY、CASE_PACK、VALID、PUBLISH=not_requested。",
            ]
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Hermes controller for ProCore case workflow.")
    sub = parser.add_subparsers(dest="command", required=True)

    intake = sub.add_parser("intake", help="Create an intake JSON from message text.")
    intake.add_argument("--message", required=True)
    intake.add_argument("--out", required=True)
    intake.add_argument("--photo", action="append", default=[])
    intake.set_defaults(func=command_intake)

    brief = sub.add_parser("brief", help="Create a Hermes writing brief from intake JSON.")
    brief.add_argument("--intake", required=True)
    brief.add_argument("--out", default="")
    brief.set_defaults(func=command_brief)

    prompt = sub.add_parser("prompt", help="Print a concise instruction for Hermes.")
    prompt.add_argument("--intake", required=True)
    prompt.set_defaults(func=command_prompt)

    pack = sub.add_parser("pack", help="Generate a draft pack from intake plus Hermes aiCopy.")
    pack.add_argument("--intake", required=True)
    pack.add_argument("--ai-copy", required=True)
    pack.add_argument("--out", default="")
    pack.set_defaults(func=command_pack)

    validate = sub.add_parser("validate", help="Validate a draft pack.")
    validate.add_argument("--pack", required=True)
    validate.set_defaults(func=command_validate)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
