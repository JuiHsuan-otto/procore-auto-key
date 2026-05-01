#!/usr/bin/env python3
"""Convert mobile or Discord case notes into a ProCore intake JSON file.

This script is the bridge between a short Discord message and the existing
content pack generator. It is deliberately conservative: it extracts public
case facts, avoids technical process details, and leaves final publishing to
the approval step.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

FIELD_ALIASES = {
    "品牌": "brand",
    "廠牌": "brand",
    "brand": "brand",
    "車款": "model",
    "型號": "model",
    "model": "model",
    "年份": "year",
    "年式": "year",
    "year": "year",
    "地點": "location",
    "地區": "location",
    "區域": "location",
    "location": "location",
    "日期": "date",
    "date": "date",
    "狀況": "scene",
    "情況": "scene",
    "問題": "scene",
    "案件": "scene",
    "scene": "scene",
    "結果": "result",
    "處理結果": "result",
    "完成": "result",
    "result": "result",
    "服務": "service_type",
    "服務項目": "service_type",
    "項目": "service_type",
    "service": "service_type",
    "類型": "issue_type",
    "問題類型": "issue_type",
    "issue": "issue_type",
    "issueType": "issue_type",
    "主關鍵字": "primary_keyword",
    "關鍵字": "primary_keyword",
    "primaryKeyword": "primary_keyword",
    "次關鍵字": "secondary_keywords",
    "延伸關鍵字": "secondary_keywords",
    "secondaryKeywords": "secondary_keywords",
    "公開車名": "public_vehicle_label",
    "車名": "public_vehicle_label",
    "備註": "private_notes",
    "內部備註": "private_notes",
}

ISSUE_LABELS = {
    "all_keys_lost": "鑰匙全丟",
    "smart_key": "智慧鑰匙服務",
    "keyless_not_detected": "感應鑰匙異常",
    "remote_failure": "遙控鑰匙異常",
    "lockout": "車門反鎖",
    "spare_key": "備用鑰匙",
}

ISSUE_PATTERNS = [
    ("lockout", ["反鎖", "鎖在車內", "開鎖", "車門打不開"]),
    ("all_keys_lost", ["全丟", "全失", "遺失", "不見", "沒有鑰匙", "鑰匙丟"]),
    ("keyless_not_detected", ["感應不到", "偵測不到", "無法感應", "keyless", "未偵測"]),
    ("remote_failure", ["遙控", "按鍵", "無法解鎖", "不能上鎖", "remote"]),
    ("spare_key", ["備用", "備份", "新增鑰匙", "追加鑰匙", "多打一支"]),
    ("smart_key", ["智慧鑰匙", "感應鑰匙", "smart key", "晶片"]),
]

BRAND_ALIASES = {
    "benz": "Benz",
    "mercedes": "Benz",
    "賓士": "Benz",
    "chevrolet": "Chevrolet",
    "雪佛蘭": "Chevrolet",
    "camaro": "Chevrolet",
    "大黃蜂": "Chevrolet",
    "bmw": "BMW",
    "vw": "VW",
    "volkswagen": "VW",
    "福斯": "VW",
    "audi": "Audi",
    "toyota": "Toyota",
    "lexus": "Lexus",
    "honda": "Honda",
    "ford": "Ford",
    "mazda": "Mazda",
    "nissan": "Nissan",
    "porsche": "Porsche",
    "mini": "Mini",
    "volvo": "Volvo",
    "skoda": "Skoda",
    "tesla": "Tesla",
    "hyundai": "Hyundai",
    "kia": "Kia",
}

MODEL_HINTS = {
    "camaro": ("Chevrolet", "Camaro"),
    "大黃蜂": ("Chevrolet", "Camaro"),
    "mustang": ("Ford", "Mustang"),
    "野馬": ("Ford", "Mustang"),
    "beetle": ("VW", "Beetle"),
    "金龜車": ("VW", "Beetle"),
}

LOCATION_HINTS = {
    "林口": "新北林口",
    "新店": "新北新店",
    "板橋": "新北板橋",
    "三重": "新北三重",
    "蘆洲": "新北蘆洲",
    "內湖": "台北內湖",
    "士林": "台北士林",
    "北投": "台北北投",
    "北屯": "台中北屯",
    "西屯": "台中西屯",
    "梧棲": "台中梧棲",
    "員林": "彰化員林",
    "斗南鎮": "雲林斗南",
    "斗南": "雲林斗南",
    "拍場": "新北林口",
}

LOCATION_PREFIXES = {
    "台北": "台北",
    "臺北": "台北",
    "新北": "新北",
    "桃園": "桃園",
    "新竹": "新竹",
    "苗栗": "苗栗",
    "台中": "台中",
    "臺中": "台中",
    "彰化": "彰化",
    "南投": "南投",
    "雲林": "雲林",
    "嘉義": "嘉義",
    "台南": "台南",
    "臺南": "台南",
    "高雄": "高雄",
    "屏東": "屏東",
    "宜蘭": "宜蘭",
    "花蓮": "花蓮",
    "台東": "台東",
    "臺東": "台東",
    "基隆": "基隆",
}

NON_LOCATION_TAILS = {
    "全丟",
    "全失",
    "遺失",
    "不見",
    "鑰匙",
    "智慧",
    "感應",
    "遙控",
    "服務",
    "處理",
    "到場",
    "完成",
    "車主",
    "案例",
}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def split_csv(value: str) -> list[str]:
    return [clean(item) for item in re.split(r"[,，、/|]", value) if clean(item)]


def strip_mode_words(message: str) -> str:
    lines = [line.rstrip() for line in message.strip().splitlines()]
    while lines and clean(lines[0]).lower() in {
        "draft",
        "草稿",
        "publish",
        "發布",
        "發佈",
        "full",
        "完整",
    }:
        lines.pop(0)
    return "\n".join(lines).strip()


def normalize_field(label: str) -> str | None:
    label = clean(label).strip("#* ")
    return FIELD_ALIASES.get(label) or FIELD_ALIASES.get(label.lower())


def parse_fields(message: str) -> tuple[dict[str, str], list[str]]:
    fields: dict[str, str] = {}
    free_lines: list[str] = []
    for raw_line in message.splitlines():
        line = clean(raw_line)
        if not line:
            continue
        match = re.match(r"^([^:：=]{1,24})\s*[:：=]\s*(.+)$", line)
        if not match:
            free_lines.append(line)
            continue
        key = normalize_field(match.group(1))
        value = clean(match.group(2))
        if key and value:
            fields[key] = value
        else:
            free_lines.append(line)
    return fields, free_lines


def infer_brand(text: str) -> str:
    lower = text.lower()
    for hint, (brand, _model) in MODEL_HINTS.items():
        if hint.lower() in lower:
            return brand
    for alias, brand in BRAND_ALIASES.items():
        if alias.lower() in lower:
            return brand
    return ""


def infer_year(text: str) -> str:
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return match.group(1) if match else ""


def infer_issue_type(text: str) -> str:
    lower = text.lower()
    for issue_type, needles in ISSUE_PATTERNS:
        if any(needle.lower() in lower for needle in needles):
            return issue_type
    if text in ISSUE_LABELS:
        return text
    for issue_type, label in ISSUE_LABELS.items():
        if label in text:
            return issue_type
    return "smart_key"


def normalize_issue_type(value: str, full_text: str) -> str:
    value = clean(value)
    if value in ISSUE_LABELS:
        return value
    return infer_issue_type(f"{value} {full_text}")


def default_result(issue_type: str) -> str:
    if issue_type == "all_keys_lost":
        return "完成鑰匙全丟到場處理與交車前確認"
    if issue_type in {"smart_key", "spare_key"}:
        return "完成鑰匙匹配與交車前確認"
    if issue_type in {"remote_failure", "keyless_not_detected"}:
        return "完成異常檢查與交車前確認"
    return "完成到場處理與交車前確認"


def infer_model(text: str, brand: str, year: str) -> str:
    lower = text.lower()
    for hint, (_brand, model) in MODEL_HINTS.items():
        if hint.lower() in lower:
            return model
    if not brand:
        return ""
    pattern = re.compile(re.escape(brand), re.I)
    match = pattern.search(text)
    if not match:
        return ""
    tail = text[match.end() : match.end() + 40]
    if year:
        tail = tail.split(year, 1)[0]
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9-]{0,12}", tail)
    skip = {"key", "smart", "remote", "all", "lost"}
    tokens = [token for token in tokens if token.lower() not in skip]
    return tokens[0].upper() if tokens else ""


def infer_location(text: str) -> str:
    for hint, location in LOCATION_HINTS.items():
        if hint in text:
            return location
    for prefix, normalized in LOCATION_PREFIXES.items():
        match = re.search(rf"{re.escape(prefix)}(?:縣|市)?\s*([\u4e00-\u9fff]{{1,4}}(?:區|鎮|鄉|市)?)?", text)
        if not match:
            continue
        tail = clean(match.group(1))
        if not tail:
            return normalized
        tail_core = re.sub(r"(區|鎮|鄉|市)$", "", tail)
        if tail_core in NON_LOCATION_TAILS or any(word in tail_core for word in NON_LOCATION_TAILS):
            return normalized
        return f"{normalized}{tail_core}"
    match = re.search(r"([\u4e00-\u9fff]{2,6}(?:市|縣|區|鎮|鄉|拍場))", text)
    return match.group(1) if match else ""


def build_intake(message: str, photo_paths: list[str]) -> dict:
    message = strip_mode_words(message)
    fields, free_lines = parse_fields(message)
    full_text = "\n".join([message, *free_lines])

    brand = clean(fields.get("brand")) or infer_brand(full_text)
    year = clean(fields.get("year")) or infer_year(full_text)
    model = clean(fields.get("model")) or infer_model(full_text, brand, year)
    public_vehicle_label = clean(fields.get("public_vehicle_label")) or clean(
        " ".join(part for part in [brand, model] if part)
    )
    if not public_vehicle_label:
        public_vehicle_label = "車輛"

    public_location = clean(fields.get("location")) or infer_location(full_text) or "台灣"
    issue_type = normalize_issue_type(fields.get("issue_type", ""), full_text)
    issue_label = ISSUE_LABELS.get(issue_type, "汽車鑰匙服務")
    scene = clean(fields.get("scene")) or clean("；".join(free_lines)) or f"{public_vehicle_label}遇到{issue_label}狀況"
    service_type = clean(fields.get("service_type")) or f"{issue_label}到場處理"
    result = clean(fields.get("result")) or default_result(issue_type)
    case_date = clean(fields.get("date")) or date.today().isoformat()

    primary_keyword = clean(fields.get("primary_keyword")) or f"{public_location} {public_vehicle_label} {issue_label}"
    secondary_keywords = split_csv(fields.get("secondary_keywords", ""))
    if not secondary_keywords:
        secondary_keywords = [
            f"{public_location}汽車鑰匙",
            f"{public_vehicle_label}鑰匙",
            issue_label,
        ]

    return {
        "version": "1.1",
        "purpose": "Daily vehicle case intake from Discord/mobile workflow.",
        "publishIntent": {
            "website": True,
            "blogger": False,
            "threads": False,
            "googleBusinessProfile": False,
            "notes": "Website can be approved from Discord. External channels require explicit approval.",
        },
        "vehicle": {
            "brand": brand,
            "model": model,
            "year": year,
            "publicVehicleLabel": public_vehicle_label,
        },
        "caseContext": {
            "date": case_date,
            "publicLocation": public_location,
            "privateLocation": "Do not publish exact address unless explicitly allowed.",
            "scene": scene,
            "issueType": issue_type,
            "allKeysLost": issue_type == "all_keys_lost",
            "serviceType": service_type,
            "result": result,
        },
        "media": {
            "photoPaths": photo_paths,
            "redactionRequired": True,
            "redact": [
                "license_plate",
                "faces",
                "exact_address",
                "documents",
                "vin",
                "customer_name",
                "phone_number",
            ],
        },
        "seo": {
            "primaryKeyword": primary_keyword,
            "secondaryKeywords": secondary_keywords,
            "tone": "清楚、可信、結果導向，不公開可複製的技術細節",
        },
        "privateNotes": clean(fields.get("private_notes")),
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_pack(intake_path: Path, ai_provider: str = "") -> tuple[int, str]:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "procore_case_pack.py"),
        "--intake",
        str(intake_path),
    ]
    if ai_provider:
        command.extend(["--ai-provider", ai_provider])
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    return result.returncode, output


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a ProCore intake JSON from a mobile/Discord message.")
    parser.add_argument("--message", required=True, help="Raw Discord/mobile message body.")
    parser.add_argument("--out", required=True, help="Output intake JSON path.")
    parser.add_argument("--photo", action="append", default=[], help="Photo path saved from Discord attachment.")
    parser.add_argument("--pack", action="store_true", help="Generate a draft content pack after writing intake.")
    parser.add_argument("--ai-provider", default="", help="Optional AI provider for pack generation, e.g. gemini.")
    parser.add_argument("--use-gemini", action="store_true", help="Use Gemini API when GEMINI_API_KEY is configured.")
    parser.add_argument("--use-openai", action="store_true", help="Reserved for future AI parsing; currently ignored.")
    args = parser.parse_args()
    if args.use_gemini and not args.ai_provider:
        args.ai_provider = "gemini"

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    intake = build_intake(args.message, args.photo)
    write_json(out_path, intake)
    print(f"INTAKE={out_path.relative_to(ROOT).as_posix() if out_path.is_relative_to(ROOT) else out_path}")

    if args.pack:
        code, output = run_pack(out_path, args.ai_provider)
        if output:
            print(output)
        raise SystemExit(code)


if __name__ == "__main__":
    main()
