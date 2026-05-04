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
    "原廠標準",
    "最短時間",
    "免拖車快速解決",
    "無論車輛停放何處",
    "無需再為鑰匙問題煩惱",
    "功能是否靈敏",
    "車主的車輛是",
    "嚴重影響日常行程",
    "了解這種焦慮",
    "緊急到場服務",
    "專業到場服務",
    "專業到場處理服務",
    "專業的到場處理服務",
    "專門提供",
    "避免不必要的拖吊費用與等待時間",
    "免去拖車煩惱",
    "拖車煩惱",
    "即時協助",
    "迅速提供",
    "迅速評估",
    "嚴謹的交車前確認",
    "透明公開",
    "充分的信心",
    "安心地重新駕駛愛車",
    "確保您的行車安全與便利",
    "重獲新生",
    "預防勝於治療",
    "燃眉之急",
    "致力於提供",
    "高效、可靠",
    "大幅節省您的時間與拖車費用",
    "直接前往您的車輛停放地點",
    "成功為車主解決",
    "精準判斷",
    "精準報價",
    "快速評估與報價流程",
    "省去不必要的等待",
    "無後顧之憂",
    "不用再擔心",
    "車主感到滿意",
]
LINE_ID = "@420gknem"
PHONE = "0909277670"
SITE_HOSTS = {"www.carkey.com.tw", "carkey.com.tw"}
GENERIC_VEHICLE_LABELS = {"", "車輛", "汽車", "愛車", "車款", "車款未確認", "未確認車款"}
GENERIC_LOCATIONS = {"", "台灣", "全台", "全省"}
TECH_DISCLOSURE_TERMS = [
    "EEPROM",
    "immobilizer dump",
    "bypass",
    "PIN code",
]
HIDDEN_SEO_PATTERNS = [
    r"display\s*:\s*none",
    r"visibility\s*:\s*hidden",
    r"font-size\s*:\s*0",
    r"opacity\s*:\s*0",
    r"text-indent\s*:\s*-",
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


def check_allowed_external_hosts(text: str, label: str, allowed_hosts: set[str], errors: list[str]) -> None:
    urls = set(re.findall(r"https?://[^\s\"'<>]+", text))
    urls.update(re.findall(r"""(?:href|url)\s*=\s*["'](https?://[^"']+)["']""", text, flags=re.I))
    for url in urls:
        host = urlparse(url.rstrip(".,)")).netloc.lower()
        if host and host not in allowed_hosts:
            fail(errors, f"{label}: unexpected external host: {host}")


def check_banned(text: str, label: str, errors: list[str]) -> None:
    for phrase in BANNED:
        if phrase in text:
            fail(errors, f"{label}: banned phrase found: {phrase}")


def check_case_copy_quality(text: str, label: str, errors: list[str]) -> None:
    readable = plain_text(text) if "<" in text else re.sub(r"\s+", "", text)
    if readable.count("極致核心ProCore") > 4:
        fail(errors, f"{label}: brand name repeated too often")
    if re.search(r"(?:19\d{2}|20\d{2})車輛", readable):
        fail(errors, f"{label}: contains generic year + vehicle wording")
    if "遙控、感應、啟動" in text and "若" not in text:
        fail(errors, f"{label}: lists remote/smart/start checks as universal facts")


def check_technical_disclosure(text: str, label: str, errors: list[str]) -> None:
    lower = text.lower()
    for term in TECH_DISCLOSURE_TERMS:
        if term.lower() in lower:
            fail(errors, f"{label}: technical disclosure term found: {term}")


def plain_text(html: str) -> str:
    text = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", "", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", "", text)


def shingle_overlap(left: str, right: str, size: int = 16) -> float:
    if len(left) < size or len(right) < size:
        return 0.0
    left_set = {left[index : index + size] for index in range(0, len(left) - size + 1)}
    right_set = {right[index : index + size] for index in range(0, len(right) - size + 1)}
    if not left_set:
        return 0.0
    return len(left_set & right_set) / len(left_set)


def check_distribution_quality(pack: Path, blogger: str, errors: list[str]) -> None:
    for pattern in HIDDEN_SEO_PATTERNS:
        if re.search(pattern, blogger, flags=re.I):
            fail(errors, f"blogger: hidden SEO pattern found: {pattern}")
    blogger_text = plain_text(blogger)
    if len(blogger_text) > 2200:
        fail(errors, f"blogger: too long for summary distribution: {len(blogger_text)} chars")
    if "摘要版" not in blogger and "完整案例" not in blogger:
        fail(errors, "blogger: should identify itself as summary content and link to the full case")
    website_path = pack / "website-article.html"
    if website_path.exists():
        website_text = plain_text(website_path.read_text(encoding="utf-8"))
        overlap = shingle_overlap(blogger_text, website_text)
        if len(blogger_text) > 280 and overlap > 0.42:
            fail(errors, f"blogger: too similar to website article for SEO distribution: {overlap:.2f}")


def check_website_article(pack: Path, official: str, errors: list[str]) -> None:
    path = pack / "website-article.html"
    if not path.exists():
        return
    html = path.read_text(encoding="utf-8")
    check_no_bad_links(html, "website-article", errors)
    check_banned(html, "website-article", errors)
    check_case_copy_quality(html, "website-article", errors)
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


def is_generic_vehicle_label(value: str) -> bool:
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    if value in GENERIC_VEHICLE_LABELS:
        return True
    return value.replace(" ", "") in {item.replace(" ", "") for item in GENERIC_VEHICLE_LABELS}


def check_manifest_facts(manifest: dict, errors: list[str]) -> None:
    source = manifest.get("source", {}) if isinstance(manifest.get("source"), dict) else {}
    vehicle = str(source.get("vehicleLabel", "")).strip()
    location = str(source.get("publicLocation", "")).strip()
    year = str(source.get("year", "")).strip()
    title = str(source.get("title", ""))
    summary = str(source.get("summary", ""))
    if is_generic_vehicle_label(vehicle):
        fail(errors, "manifest: vehicleLabel is generic; require brand/model before publishing")
    if location in GENERIC_LOCATIONS:
        fail(errors, "manifest: publicLocation is generic; require city/district before publishing")
    if not re.fullmatch(r"(19\d{2}|20\d{2})", year):
        fail(errors, "manifest: year is missing or invalid; require vehicle year before publishing")
    if any(generic and generic in title for generic in {"車款未確認", "未確認車款"}):
        fail(errors, "manifest: title contains generic vehicle placeholder")
    if re.search(r"(?:19\d{2}|20\d{2})\s*車輛", title) or re.search(r"(?:19\d{2}|20\d{2})\s*車輛", summary):
        fail(errors, "manifest: summary contains generic vehicle placeholder")


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
    check_case_copy_quality(json.dumps(payload, ensure_ascii=False), "publish-tool-args", errors)
    if is_generic_vehicle_label(car):
        fail(errors, "publish-tool-args: caseCar is generic; require brand/model before publishing")
    if region in GENERIC_LOCATIONS:
        fail(errors, "publish-tool-args: caseRegion is generic; require city/district before publishing")
    if re.search(r"(?:19\d{2}|20\d{2})\s*車輛", title) or re.search(r"(?:19\d{2}|20\d{2})\s*車輛", summary):
        fail(errors, "publish-tool-args: title/summary contains generic vehicle placeholder")
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
    check_manifest_facts(manifest, errors)
    official = manifest.get("source", {}).get("officialUrl", "")
    if not official.startswith("https://www.carkey.com.tw/"):
        fail(errors, "manifest: officialUrl must point to www.carkey.com.tw")
    check_no_bad_links(json.dumps(manifest, ensure_ascii=False), "manifest", errors)
    check_banned(json.dumps(manifest, ensure_ascii=False), "manifest", errors)

    blogger = (pack / "blogger.html").read_text(encoding="utf-8")
    check_no_bad_links(blogger, "blogger", errors)
    check_allowed_external_hosts(blogger, "blogger", SITE_HOSTS, errors)
    check_banned(blogger, "blogger", errors)
    check_case_copy_quality(blogger, "blogger", errors)
    if official not in blogger:
        fail(errors, "blogger: missing official backlink")
    if LINE_ID not in blogger:
        fail(errors, "blogger: missing correct LINE ID")
    if PHONE not in blogger:
        fail(errors, "blogger: missing correct phone")
    check_distribution_quality(pack, blogger, errors)

    threads = (pack / "threads.txt").read_text(encoding="utf-8")
    check_no_bad_links(threads, "threads", errors)
    check_banned(threads, "threads", errors)
    check_case_copy_quality(threads, "threads", errors)
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
    check_case_copy_quality(summary, "gbp.summary", errors)
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
    check_case_copy_quality(checklist, "website-checklist", errors)
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
