#!/usr/bin/env python3
"""Generate review-ready ProCore content packs from mobile/Discord case intake.

The script is intentionally draft-only. It writes website, Blogger, Threads,
and Google Business Profile drafts under drafts/ and never publishes content.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from datetime import date
from html import escape
from pathlib import Path

try:
    from gemini_seo_writer import generate_ai_copy
except ImportError:  # pragma: no cover - keeps the generator usable if copied alone
    generate_ai_copy = None


ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.carkey.com.tw"
PHONE = "0909277670"
LINE_ID = "@420gknem"

ISSUE_LABELS = {
    "all_keys_lost": "鑰匙全丟",
    "smart_key": "智慧鑰匙處理",
    "keyless_not_detected": "感應鑰匙異常",
    "remote_failure": "遙控鑰匙異常",
    "lockout": "車門反鎖",
    "spare_key": "備用鑰匙",
}

ISSUE_SLUGS = {
    "all_keys_lost": "akl",
    "smart_key": "smartkey",
    "keyless_not_detected": "keyless",
    "remote_failure": "remote",
    "lockout": "lockout",
    "spare_key": "spare-key",
}

LOCATION_SLUGS = {
    "台北": "taipei",
    "臺北": "taipei",
    "新北": "new-taipei",
    "基隆": "keelung",
    "桃園": "taoyuan",
    "新竹": "hsinchu",
    "苗栗": "miaoli",
    "台中": "taichung",
    "臺中": "taichung",
    "彰化": "changhua",
    "南投": "nantou",
    "雲林": "yunlin",
    "嘉義": "chiayi",
    "台南": "tainan",
    "臺南": "tainan",
    "高雄": "kaohsiung",
    "屏東": "pingtung",
    "宜蘭": "yilan",
    "花蓮": "hualien",
    "台東": "taitung",
    "臺東": "taitung",
}

BANNED_TECH_TERMS = [
    "EEPROM",
    "OBD",
    "PIN code",
    "immobilizer dump",
    "bypass",
]


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def write_text(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8")


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_space(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def compact_summary(value: str, limit: int = 110) -> str:
    value = clean_space(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip("，。、 ") + "…"


def ai_ok(ai_copy: dict | None) -> bool:
    return isinstance(ai_copy, dict) and ai_copy.get("status") == "ok"


def apply_ai_copy(identity: dict, ai_copy: dict | None) -> None:
    if not ai_ok(ai_copy):
        return
    for target, source in [
        ("title", "title"),
        ("h1", "h1"),
        ("summary", "summary"),
        ("primaryKeyword", "primaryKeyword"),
    ]:
        value = clean_space(ai_copy.get(source))
        if value:
            identity[target] = value
    secondary = ai_copy.get("secondaryKeywords")
    if isinstance(secondary, list):
        values = [clean_space(item) for item in secondary if clean_space(item)]
        if values:
            identity["secondaryKeywords"] = values


def ensure_contact_and_backlink(html: str, official_url: str) -> str:
    html = html.strip()
    if not html:
        return ""
    additions: list[str] = []
    if official_url not in html:
        backlink = f"{official_url}?utm_source=blogger&utm_medium=referral&utm_campaign=ai_content_pack"
        additions.append(f'<p>完整官網案例：<a href="{backlink}" rel="noopener">{official_url}</a></p>')
    if PHONE not in html or LINE_ID not in html:
        additions.append(f"<p>極致核心 ProCore：電話 {PHONE}，LINE ID {LINE_ID}。</p>")
    if additions:
        if "</article>" in html:
            html = html.replace("</article>", "\n" + "\n".join(additions) + "\n</article>")
        else:
            html += "\n" + "\n".join(additions)
    return html


def slugify(value: str, fallback: str) -> str:
    text = value.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or fallback


def location_slug(location: str) -> str:
    for key, value in LOCATION_SLUGS.items():
        if key in location:
            return value
    return slugify(location, "taiwan")


def issue_label(issue_type: str) -> str:
    return ISSUE_LABELS.get(issue_type, clean_space(issue_type) or "汽車鑰匙服務")


def issue_slug(issue_type: str) -> str:
    return ISSUE_SLUGS.get(issue_type, slugify(issue_type, "service"))


def vehicle_label(intake: dict) -> str:
    vehicle = intake.get("vehicle", {})
    explicit = clean_space(vehicle.get("publicVehicleLabel"))
    if explicit:
        return explicit
    parts = [vehicle.get("brand"), vehicle.get("model"), vehicle.get("year")]
    return " ".join(clean_space(part) for part in parts if clean_space(part)) or "車輛"


def build_article_identity(intake: dict) -> dict:
    vehicle = intake.get("vehicle", {})
    context = intake.get("caseContext", {})
    seo = intake.get("seo", {})
    public_location = clean_space(context.get("publicLocation")) or "台灣"
    issue_type = clean_space(context.get("issueType")) or "service"
    label = vehicle_label(intake)
    brand = slugify(clean_space(vehicle.get("brand")), "car")
    model = slugify(clean_space(vehicle.get("model")), "key")
    year = slugify(clean_space(vehicle.get("year")), "")
    location = location_slug(public_location)
    slug_parts = ["article", brand, model, year, location, issue_slug(issue_type)]
    slug = "-".join(part for part in slug_parts if part)
    link = f"/{slug}"
    title = f"{public_location}{label}{issue_label(issue_type)}到場處理紀錄 | 極致核心 ProCore"
    h1 = f"{public_location}{label}{issue_label(issue_type)}處理紀錄"
    service = clean_space(context.get("serviceType")) or issue_label(issue_type)
    result = clean_space(context.get("result")) or "完成檢測與交車確認"
    scene = clean_space(context.get("scene")) or "車主遇到鑰匙或啟動相關問題"
    primary_keyword = clean_space(seo.get("primaryKeyword")) or f"{public_location} {label} {issue_label(issue_type)}"
    secondary = [clean_space(item) for item in seo.get("secondaryKeywords", []) if clean_space(item)]
    summary = compact_summary(f"{label}在{public_location}遇到{issue_label(issue_type)}狀況，技師到場評估後完成{service}，並確認{result}。")
    return {
        "slug": slug,
        "link": link,
        "officialUrl": f"{SITE}{link}",
        "title": title,
        "h1": h1,
        "summary": summary,
        "scene": scene,
        "service": service,
        "result": result,
        "vehicleLabel": label,
        "publicLocation": public_location,
        "issueLabel": issue_label(issue_type),
        "issueType": issue_type,
        "primaryKeyword": primary_keyword,
        "secondaryKeywords": secondary,
        "category": "案件紀錄",
    }


def copy_media(intake: dict, out_dir: Path, enabled: bool) -> list[dict]:
    media = intake.get("media", {})
    copied: list[dict] = []
    if not enabled:
        return copied
    photo_paths = media.get("photoPaths") or []
    if not photo_paths:
        return copied
    target_dir = out_dir / "media" / "originals"
    target_dir.mkdir(parents=True, exist_ok=True)
    for index, raw in enumerate(photo_paths, 1):
        source = Path(str(raw)).expanduser()
        entry = {"source": str(raw), "exists": source.exists()}
        if source.exists() and source.is_file():
            safe_name = f"case-photo-{index}{source.suffix.lower() or '.jpg'}"
            target = target_dir / safe_name
            shutil.copy2(source, target)
            entry["copiedTo"] = target.relative_to(out_dir).as_posix()
        copied.append(entry)
    return copied


def build_website_article(identity: dict, intake: dict, media_entries: list[dict], ai_copy: dict | None = None) -> str:
    context = intake.get("caseContext", {})
    case_date = clean_space(context.get("date")) or date.today().isoformat()
    meta_desc = compact_summary(identity["summary"], 150)
    keywords = [identity["primaryKeyword"], *identity["secondaryKeywords"]]
    keyword_meta = "、".join(dict.fromkeys(keywords))
    image_note = ""
    usable_media = [item for item in media_entries if item.get("copiedTo")]
    if usable_media:
        image_note = (
            "\n    <section>\n"
            "      <h2>照片審核</h2>\n"
            "      <p>原始照片已放在草稿包內，發布前請先遮蔽車牌、臉部、文件、VIN 與地址資訊。</p>\n"
            "    </section>\n"
        )
    ai_sections = ""
    if ai_ok(ai_copy):
        blocks = []
        for section in ai_copy.get("sections", []):
            heading = clean_space(section.get("heading"))
            body = clean_space(section.get("body"))
            if heading and body:
                blocks.append(
                    "\n      <section>\n"
                    f"        <h2>{escape(heading)}</h2>\n"
                    f"        <p>{escape(body)}</p>\n"
                    "      </section>\n"
                )
        ai_sections = "".join(blocks)
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": identity["title"],
        "description": meta_desc,
        "datePublished": case_date,
        "dateModified": case_date,
        "inLanguage": "zh-TW",
        "mainEntityOfPage": identity["officialUrl"],
        "publisher": {
            "@type": "Organization",
            "name": "極致核心 ProCore",
            "url": SITE,
            "telephone": PHONE,
        },
    }
    return f"""<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(identity["title"])}</title>
  <meta name="description" content="{escape(meta_desc)}">
  <meta name="keywords" content="{escape(keyword_meta)}">
  <link rel="canonical" href="{identity["officialUrl"]}">
  <meta property="og:title" content="{escape(identity["title"])}">
  <meta property="og:description" content="{escape(meta_desc)}">
  <meta property="og:url" content="{identity["officialUrl"]}">
  <meta property="og:type" content="article">
  <script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
</head>
<body>
  <main>
    <article>
      <p>{escape(case_date)} · {escape(identity["category"])}</p>
      <h1>{escape(identity["h1"])}</h1>
      <p>{escape(identity["summary"])}</p>

      <section>
        <h2>案件狀況</h2>
        <p>{escape(identity["scene"])}</p>
      </section>

      <section>
        <h2>處理方式</h2>
        <p>技師先確認車款年份、現場條件與車主需求，再安排合適的到場處理流程。公開文章只描述服務結果，不公開可被複製的技術步驟。</p>
      </section>

      <section>
        <h2>完成結果</h2>
        <p>{escape(identity["result"])}</p>
      </section>
{ai_sections}
{image_note}
      <section>
        <h2>遇到類似狀況怎麼辦</h2>
        <ul>
          <li>先準備車款、年份、所在地與鑰匙狀況。</li>
          <li>如果車在地下室、拍場或路邊，請先說明現場環境。</li>
          <li>可透過 LINE 傳照片與位置，先評估是否能到場處理。</li>
        </ul>
        <p>聯絡極致核心 ProCore：電話 {PHONE}，LINE ID {LINE_ID}。</p>
      </section>
    </article>
  </main>
</body>
</html>
"""


def build_blogger(identity: dict, ai_copy: dict | None = None) -> str:
    if ai_ok(ai_copy):
        html = ensure_contact_and_backlink(str(ai_copy.get("bloggerHtml") or ""), identity["officialUrl"])
        if html:
            return html
    labels = [identity["primaryKeyword"], *identity["secondaryKeywords"], identity["category"]]
    labels = [item for item in dict.fromkeys(labels) if item]
    backlink = f"{identity['officialUrl']}?utm_source=blogger&utm_medium=referral&utm_campaign=ai_content_pack"
    return f"""<article>
  <h1>{escape(identity["h1"])}</h1>
  <p>{escape(identity["summary"])}</p>
  <p>如果你遇到類似狀況，建議先整理車款、年份、所在地、是否還有備用鑰匙，以及車輛是否能正常開門或啟動。</p>
  <p>完整官網說明與相關案例：<a href="{backlink}" rel="noopener">{identity["officialUrl"]}</a></p>
  <h2>聯絡前建議準備</h2>
  <ul>
    <li>車款、年份與所在地</li>
    <li>鑰匙是全丟、備份，還是感應異常</li>
    <li>車輛是否在地下室、拍場、路邊或維修廠</li>
    <li>儀表是否有錯誤訊息</li>
  </ul>
  <p>極致核心 ProCore：電話 {PHONE}，LINE ID {LINE_ID}。</p>
  <p>標籤：{escape("、".join(labels[:5]))}</p>
</article>
"""


def build_threads(identity: dict, ai_copy: dict | None = None) -> str:
    url = f"{identity['officialUrl']}?utm_source=threads&utm_medium=social&utm_campaign=ai_content_pack"
    if ai_ok(ai_copy) and ai_copy.get("threads"):
        posts = [clean_space(item) for item in ai_copy.get("threads", []) if clean_space(item)]
        if posts:
            if not any(identity["officialUrl"] in post for post in posts):
                posts[0] = compact_summary(f"{posts[0]} {url}", 500)
            return "\n\n".join(f"THREAD {idx}\n{post[:500]}" for idx, post in enumerate(posts[:3], 1)) + "\n"
    posts = [
        f"{identity['vehicleLabel']}在{identity['publicLocation']}遇到{identity['issueLabel']}，重點是先確認車款年份、停放環境與是否還有備用鑰匙，再判斷能否到場處理。{url}",
        f"{identity['h1']}。公開案例只說明車主遇到的狀況與完成結果，不公開可複製的技術步驟。LINE：{LINE_ID}",
        f"車停在地下室、拍場或路邊，都可以先傳車款、年份、位置與照片。技師會先評估，再報價與安排。電話：{PHONE}",
    ]
    return "\n\n".join(f"THREAD {idx}\n{post[:500]}" for idx, post in enumerate(posts, 1)) + "\n"


def build_gbp(identity: dict, ai_copy: dict | None = None) -> dict:
    url = f"{identity['officialUrl']}?utm_source=google_business_profile&utm_medium=local_post&utm_campaign=ai_content_pack"
    summary = clean_space(ai_copy.get("gbpSummary")) if ai_ok(ai_copy) else ""
    if not summary:
        summary = (
            f"{identity['h1']}。{identity['summary']} "
            f"可先透過 LINE 傳車款、年份、所在地與照片，評估是否能到場處理。LINE：{LINE_ID}"
        )
    return {
        "languageCode": "zh-TW",
        "summary": compact_summary(summary, 650),
        "topicType": "STANDARD",
        "callToAction": {
            "actionType": "LEARN_MORE",
            "url": url,
        },
    }


def build_checklist(identity: dict, media_entries: list[dict]) -> str:
    media_lines = "\n".join(
        f"- [ ] {entry.get('copiedTo') or entry.get('source')} 已確認不含車牌、臉、文件、VIN、住址。"
        for entry in media_entries
    )
    if not media_lines:
        media_lines = "- [ ] 本次沒有附照片，或照片另行人工審核。"
    return f"""# ProCore Case Publishing Checklist

Source title: {identity["title"]}
Official URL: {identity["officialUrl"]}

## Website
- [ ] `website-article.html` 已人工讀過，沒有技術細節外洩。
- [ ] 標題、H1、meta description 與 canonical 正確。
- [ ] 正式發布前，將文章內容套入目前官網模板。
- [ ] 正式發布後，使用 `publish_tool.py` 更新 `blog.json`、`blog.html`、`cases.html`、`cases.json` 與 `sitemap.xml`。

## Media
{media_lines}

## External Channels
- [ ] Blogger 草稿有官網 backlink，且不是 `.html` URL。
- [ ] Threads 每則小於 500 字。
- [ ] Google Business Profile JSON 使用 `LEARN_MORE` 並指向官網。
- [ ] Blogger、Threads、Google Business Profile 必須逐一明確核准後才發布。

## Contact
- [ ] CTA 使用電話 `{PHONE}`。
- [ ] CTA 使用 LINE `{LINE_ID}`。
"""


def build_publish_args(identity: dict, intake: dict, media_entries: list[dict]) -> dict:
    context = intake.get("caseContext", {})
    case_date = clean_space(context.get("date")) or date.today().isoformat()
    case_img = ""
    for entry in media_entries:
        copied = clean_space(entry.get("copiedTo"))
        if copied:
            case_img = copied
            break
    return {
        "title": identity["title"],
        "path": identity["link"],
        "category": identity["category"],
        "summary": identity["summary"],
        "date": case_date.replace("-", "."),
        "lastmod": case_date,
        "keywords": ",".join([identity["primaryKeyword"], *identity["secondaryKeywords"]]),
        "caseRegion": identity["publicLocation"],
        "caseCar": identity["vehicleLabel"],
        "caseImg": case_img,
        "caseType": identity["issueType"],
        "exampleCommand": (
            f"python publish_tool.py \"{identity['title']}\" \"{identity['link']}\" "
            f"\"{identity['category']}\" \"{identity['summary']}\""
        ),
    }


def build_manifest(identity: dict, intake: dict, media_entries: list[dict], case_date: str, ai_copy: dict | None = None) -> dict:
    publish_intent = intake.get("publishIntent", {})
    media = intake.get("media", {})
    return {
        "version": "1.1",
        "date": case_date,
        "status": "drafted",
        "sourceType": "daily_vehicle_case",
        "source": {
            "title": identity["title"],
            "category": identity["category"],
            "summary": identity["summary"],
            "link": identity["link"],
            "officialUrl": identity["officialUrl"],
            "vehicleLabel": identity["vehicleLabel"],
            "publicLocation": identity["publicLocation"],
            "issueType": identity["issueType"],
        },
        "channels": {
            "websiteDraft": {"file": "website-article.html", "status": "draft"},
            "blogger": {"file": "blogger.html", "status": "draft"},
            "threads": {"file": "threads.txt", "status": "draft"},
            "googleBusinessProfile": {"file": "google-business-profile.json", "status": "draft"},
            "websiteChecklist": {"file": "website-checklist.md", "status": "review"},
        },
        "publishIntent": {
            "website": bool(publish_intent.get("website")),
            "blogger": bool(publish_intent.get("blogger")),
            "threads": bool(publish_intent.get("threads")),
            "googleBusinessProfile": bool(publish_intent.get("googleBusinessProfile")),
        },
        "media": {
            "redactionRequired": bool(media.get("redactionRequired", True)),
            "redact": media.get("redact", []),
            "files": media_entries,
        },
        "approvalRequired": True,
        "privacyBoundary": {
            "privateNotesOmitted": True,
            "privateLocationOmitted": True,
            "technicalDetailsOmitted": True,
        },
        "aiCopy": ai_copy or {"provider": "none", "status": "not_requested"},
    }


def generate_pack(args: argparse.Namespace) -> Path:
    intake_path = Path(args.intake).resolve()
    intake = read_json(intake_path)
    identity = build_article_identity(intake)
    case_date = clean_space(intake.get("caseContext", {}).get("date")) or args.date
    out_dir = ROOT / args.out / f"{case_date}-{identity['slug']}"
    out_dir.mkdir(parents=True, exist_ok=True)
    media_entries = copy_media(intake, out_dir, not args.no_copy_media)
    ai_entries = [dict(entry, _packRoot=str(out_dir)) for entry in media_entries]
    ai_provider = clean_space(args.ai_provider or os.environ.get("PROCORE_AI_PROVIDER"))
    ai_copy = {}
    if generate_ai_copy is not None:
        ai_copy = generate_ai_copy(identity, intake, ai_entries, provider=ai_provider)
    apply_ai_copy(identity, ai_copy)

    write_json(out_dir / "manifest.json", build_manifest(identity, intake, media_entries, case_date, ai_copy))
    write_text(out_dir / "website-article.html", build_website_article(identity, intake, media_entries, ai_copy))
    write_text(out_dir / "blogger.html", build_blogger(identity, ai_copy))
    write_text(out_dir / "threads.txt", build_threads(identity, ai_copy))
    write_json(out_dir / "google-business-profile.json", build_gbp(identity, ai_copy))
    write_text(out_dir / "website-checklist.md", build_checklist(identity, media_entries))
    write_json(out_dir / "publish-tool-args.json", build_publish_args(identity, intake, media_entries))

    return out_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a ProCore review-ready case content pack.")
    parser.add_argument("--intake", required=True, help="Path to a case intake JSON file.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Fallback date when intake has no case date.")
    parser.add_argument("--out", default="drafts", help="Output directory relative to repo root.")
    parser.add_argument("--no-copy-media", action="store_true", help="Do not copy source photos into the draft pack.")
    parser.add_argument("--ai-provider", default="", help="Optional AI provider, e.g. gemini.")
    parser.add_argument("--use-gemini", action="store_true", help="Use Gemini API when GEMINI_API_KEY is configured.")
    args = parser.parse_args()
    if args.use_gemini and not args.ai_provider:
        args.ai_provider = "gemini"

    out_dir = generate_pack(args)
    print(f"CASE_PACK={out_dir.relative_to(ROOT).as_posix()}")
    print("NEXT=python scripts/content_automation/validate_content_pack.py " + out_dir.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
