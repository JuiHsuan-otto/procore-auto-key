#!/usr/bin/env python3
"""Validate a ProCore cross-platform draft pack."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

BANNED = [
    "職人",
    "火速",
    "攻克",
    "深入解析",
    "完美匹配",
    "守護您的駕駛權限",
    "魂動美學",
    "數據重構",
    "全台．跨區．遠征",
    "在現代社會中",
    "隨著科技",
    "不可或缺",
    "至關重要",
    "本文將",
    "以下將",
    "本文旨在",
    "深入探討",
    "專業團隊",
    "量身打造",
    "值得信賴",
    "最佳選擇",
    "頂尖",
    "快速有效",
    "高效便捷",
    "一站式解決方案",
    "全方位解決方案",
    "為您提供最",
    "無論是",
    "不僅如此",
]
LINE_ID = "@420gknem"
PHONE = "0909277670"
SITE_HOSTS = {"www.carkey.com.tw", "carkey.com.tw"}
TECH_DISCLOSURE_TERMS = [
    "EEPROM",
    "immobilizer dump",
    "bypass",
    "PIN code",
]


def fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


def check_no_bad_links(text: str, label: str, errors: list[str]) -> None:
    for url in re.findall(r"https?://[^\s\"'<>]+", text):
        parsed = urlparse(url.rstrip(".,)"))
        if parsed.netloc in SITE_HOSTS and parsed.path.endswith(".html"):
            fail(errors, f"{label}: official URL is not clean: {url}")
    for href in re.findall(r"""(?:href|url)\s*=\s*["']([^"']+)["']""", text, flags=re.I):
        if href.startswith("/") and href.endswith(".html"):
            fail(errors, f"{label}: href uses .html path: {href}")


def check_banned(text: str, label: str, errors: list[str]) -> None:
    for phrase in BANNED:
        if phrase in text:
            fail(errors, f"{label}: banned phrase found: {phrase}")


def check_technical_disclosure(text: str, label: str, errors: list[str]) -> None:
    lower = text.lower()
    for term in TECH_DISCLOSURE_TERMS:
        if term.lower() in lower:
            fail(errors, f"{label}: technical disclosure term found: {term}")


def check_website_article(pack: Path, official: str, errors: list[str]) -> None:
    path = pack / "website-article.html"
    if not path.exists():
        return
    html = path.read_text(encoding="utf-8")
    check_no_bad_links(html, "website-article", errors)
    check_banned(html, "website-article", errors)
    check_technical_disclosure(html, "website-article", errors)
    if official and official not in html:
        fail(errors, "website-article: missing canonical official URL")
    if "<h1" not in html.lower():
        fail(errors, "website-article: missing h1")
    if "application/ld+json" not in html:
        fail(errors, "website-article: missing JSON-LD")
    if LINE_ID not in html:
        fail(errors, "website-article: missing correct LINE ID")
    if PHONE not in html:
        fail(errors, "website-article: missing correct phone")


def check_publish_args(pack: Path, official: str, errors: list[str]) -> None:
    path = pack / "publish-tool-args.json"
    if not path.exists():
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    link = payload.get("path", "")
    if not link.startswith("/"):
        fail(errors, "publish-tool-args: path must be a clean root-relative URL")
    if link.endswith(".html"):
        fail(errors, "publish-tool-args: path must not end with .html")
    if official and not official.endswith(link):
        fail(errors, "publish-tool-args: path does not match manifest officialUrl")
    for field in ["title", "category", "summary", "date", "lastmod"]:
        if not str(payload.get(field, "")).strip():
            fail(errors, f"publish-tool-args: missing {field}")
    title = str(payload.get("title", ""))
    summary = str(payload.get("summary", ""))
    keywords = str(payload.get("keywords", ""))
    region = str(payload.get("caseRegion", "")).strip()
    car = str(payload.get("caseCar", "")).strip()
    check_banned(json.dumps(payload, ensure_ascii=False), "publish-tool-args", errors)
    if region and region not in title:
        fail(errors, "publish-tool-args: title should include public location for local SEO")
    if car and not any(part and part in title for part in car.split()):
        fail(errors, "publish-tool-args: title should include vehicle label for search intent")
    if len(summary) < 45:
        fail(errors, f"publish-tool-args: summary too short for SEO: {len(summary)}")
    if len(summary) > 180:
        fail(errors, f"publish-tool-args: summary too long for meta/index use: {len(summary)}")
    if region and region not in keywords:
        fail(errors, "publish-tool-args: keywords should include public location")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python validate_content_pack.py <draft-pack-dir>")
    pack = Path(sys.argv[1])
    errors: list[str] = []
    required = ["manifest.json", "blogger.html", "threads.txt", "google-business-profile.json", "website-checklist.md"]
    for name in required:
        if not (pack / name).exists():
            fail(errors, f"missing {name}")
    if errors:
        print("VALID=0")
        print("\n".join(errors))
        raise SystemExit(1)

    manifest = json.loads((pack / "manifest.json").read_text(encoding="utf-8"))
    official = manifest.get("source", {}).get("officialUrl", "")
    if not official.startswith("https://www.carkey.com.tw/"):
        fail(errors, "manifest: officialUrl must point to www.carkey.com.tw")
    check_no_bad_links(json.dumps(manifest, ensure_ascii=False), "manifest", errors)

    blogger = (pack / "blogger.html").read_text(encoding="utf-8")
    check_no_bad_links(blogger, "blogger", errors)
    check_banned(blogger, "blogger", errors)
    if official not in blogger:
        fail(errors, "blogger: missing official backlink")
    if LINE_ID not in blogger:
        fail(errors, "blogger: missing correct LINE ID")
    if PHONE not in blogger:
        fail(errors, "blogger: missing correct phone")

    threads = (pack / "threads.txt").read_text(encoding="utf-8")
    check_no_bad_links(threads, "threads", errors)
    check_banned(threads, "threads", errors)
    if "0909-277-670" in threads:
        fail(errors, "threads: phone format must be 0909277670")
    for block in re.split(r"\n\s*\n", threads.strip()):
        if block.startswith("THREAD"):
            content = "\n".join(block.splitlines()[1:]).strip()
            if len(content) > 500:
                fail(errors, f"threads: post exceeds 500 chars: {len(content)}")

    gbp = json.loads((pack / "google-business-profile.json").read_text(encoding="utf-8"))
    if gbp.get("languageCode") != "zh-TW":
        fail(errors, "gbp: languageCode must be zh-TW")
    if gbp.get("topicType") != "STANDARD":
        fail(errors, "gbp: topicType must be STANDARD by default")
    summary = gbp.get("summary", "")
    check_banned(summary, "gbp.summary", errors)
    if len(summary) > 700:
        fail(errors, f"gbp: summary too long: {len(summary)}")
    cta = gbp.get("callToAction", {})
    if cta.get("actionType") != "LEARN_MORE":
        fail(errors, "gbp: CTA actionType must be LEARN_MORE")
    if not cta.get("url", "").startswith("https://www.carkey.com.tw/"):
        fail(errors, "gbp: CTA URL must point to official site")
    check_no_bad_links(json.dumps(gbp, ensure_ascii=False), "gbp", errors)

    checklist = (pack / "website-checklist.md").read_text(encoding="utf-8")
    check_banned(checklist, "website-checklist", errors)
    if LINE_ID not in checklist:
        fail(errors, "website-checklist: missing correct LINE ID")
    if PHONE not in checklist:
        fail(errors, "website-checklist: missing correct phone")

    check_website_article(pack, official, errors)
    check_publish_args(pack, official, errors)

    if errors:
        print("VALID=0")
        print("\n".join(errors))
        raise SystemExit(1)
    print("VALID=1")
    print(f"PACK={pack.as_posix()}")


if __name__ == "__main__":
    main()
