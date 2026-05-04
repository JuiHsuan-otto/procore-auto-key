#!/usr/bin/env python3
"""Approve a ProCore case draft pack into the live static website files.

Default mode is a dry run. Use --confirm to write the article and update
blog/cases/sitemap/homepage indexes.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.carkey.com.tw"
PHONE = "0909277670"
LINE_ID = "@420gknem"
DEFAULT_CASE_IMG = "img/procore_logo_main.jpg"
PUBLIC_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8")


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_text(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def shorten(value: str, limit: int) -> str:
    value = clean_text(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip("，。、 ") + "…"


def load_pack(pack: Path) -> tuple[dict, dict]:
    manifest = read_json(pack / "manifest.json")
    publish_args = read_json(pack / "publish-tool-args.json")
    return manifest, publish_args


def run_validator(pack: Path) -> None:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "validate_content_pack.py"),
        str(pack),
    ]
    subprocess.run(command, cwd=ROOT, check=True)


def clean_link(raw_path: str) -> str:
    link = clean_text(raw_path)
    if not link.startswith("/"):
        link = f"/{link}"
    if link.endswith(".html"):
        link = link[:-5]
    return link


def article_path_from_link(link: str) -> Path:
    slug = clean_link(link).strip("/")
    if not slug.startswith("article-"):
        raise SystemExit(f"Refusing to approve non-article path: {link}")
    return ROOT / f"{slug}.html"


def safe_public_image(case_img: str, require_exists: bool = False) -> str:
    case_img = clean_text(case_img) or DEFAULT_CASE_IMG
    if case_img.startswith(("http://", "https://")):
        return case_img
    normalized = case_img.replace("\\", "/").lstrip("/")
    target = (ROOT / normalized).resolve()
    if not target.is_relative_to(ROOT):
        raise SystemExit(f"Refusing image path outside repo: {case_img}")
    if require_exists and not target.exists():
        raise SystemExit(f"Public image not found: {normalized}")
    return normalized


def copy_first_media(pack: Path, publish_args: dict, redaction_confirmed: bool) -> str:
    if not redaction_confirmed:
        raise SystemExit("--copy-first-media requires --redaction-confirmed")
    manifest = read_json(pack / "manifest.json")
    for item in manifest.get("media", {}).get("files", []):
        copied = clean_text(item.get("copiedTo"))
        if not copied:
            continue
        source = pack / copied
        if not source.exists() or source.suffix.lower() not in PUBLIC_IMAGE_SUFFIXES:
            continue
        slug = clean_link(publish_args["path"]).strip("/")
        target_dir = ROOT / "img" / "cases"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{slug}{source.suffix.lower()}"
        shutil.copy2(source, target)
        return target.relative_to(ROOT).as_posix()
    raise SystemExit("No browser-safe copied media found in pack.")


def resolve_case_img(args: argparse.Namespace, pack: Path, publish_args: dict) -> str:
    if args.copy_first_media:
        return copy_first_media(pack, publish_args, args.redaction_confirmed)
    if args.case_img:
        return safe_public_image(args.case_img, require_exists=True)
    candidate = clean_text(publish_args.get("caseImg"))
    if candidate:
        normalized = candidate.replace("\\", "/").lstrip("/")
        if not normalized.startswith(("media/", "drafts/")) and (ROOT / normalized).exists():
            return safe_public_image(normalized)
    return safe_public_image(DEFAULT_CASE_IMG, require_exists=True)


def render_article(manifest: dict, publish_args: dict, case_img: str) -> str:
    source = manifest.get("source", {})
    ai_copy = manifest.get("aiCopy", {}) if isinstance(manifest.get("aiCopy"), dict) else {}
    title = clean_text(publish_args["title"])
    summary = shorten(clean_text(publish_args["summary"]), 150)
    link = clean_link(publish_args["path"])
    official_url = f"{SITE}{link}"
    h1 = clean_text(source.get("title")) or title
    h1 = h1.replace(" | 極致核心 ProCore", "")
    vehicle = clean_text(source.get("vehicleLabel")) or clean_text(publish_args.get("caseCar")) or "車款未確認"
    location = clean_text(source.get("publicLocation")) or clean_text(publish_args.get("caseRegion")) or "地點未確認"
    issue_type = clean_text(source.get("issueType"))
    issue_label = {
        "all_keys_lost": "鑰匙全丟",
        "keyless_not_detected": "感應鑰匙異常",
        "remote_failure": "遙控鑰匙異常",
        "lockout": "車門反鎖",
        "spare_key": "備用鑰匙",
        "smart_key": "智慧鑰匙服務",
    }.get(issue_type, "汽車鑰匙服務")
    keywords = [item.strip() for item in clean_text(publish_args.get("keywords")).split(",") if item.strip()]
    keywords_meta = "、".join(dict.fromkeys(keywords))
    image_url = case_img if case_img.startswith("http") else f"{SITE}/{case_img}"
    date_value = clean_text(publish_args.get("lastmod")) or clean_text(publish_args.get("date")).replace(".", "-")
    json_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{SITE}/#website",
                "url": f"{SITE}/",
                "name": "極致核心 ProCore Auto Key",
                "inLanguage": "zh-TW",
            },
            {
                "@type": "LocalBusiness",
                "@id": f"{SITE}/#business",
                "name": "極致核心 ProCore Auto Key",
                "alternateName": "ProCore Auto Key",
                "url": f"{SITE}/",
                "telephone": "+886909277670",
                "image": f"{SITE}/img/procore_logo_main.jpg",
                "priceRange": "$$",
                "address": {"@type": "PostalAddress", "addressCountry": "TW"},
            },
            {
                "@type": "Article",
                "@id": f"{official_url}#webpage",
                "url": official_url,
                "headline": title,
                "description": summary,
                "image": image_url,
                "datePublished": date_value,
                "dateModified": date_value,
                "inLanguage": "zh-TW",
                "publisher": {"@id": f"{SITE}/#business"},
                "author": {"@id": f"{SITE}/#business"},
                "mainEntityOfPage": official_url,
            },
        ],
    }
    image_block = ""
    if case_img:
        image_block = f"""
      <div class="glass-panel text-center">
        <img src="{escape(case_img)}" alt="{escape(vehicle)} {escape(issue_label)}到場處理紀錄" class="rounded-lg mb-6 w-full shadow-2xl mx-auto">
        <p class="text-xs text-gray-500">案件照片僅保留服務情境，發布前須確認車牌、臉部、文件、VIN 與地址資訊已遮蔽。</p>
      </div>"""
    ai_sections = ""
    if ai_copy.get("status") == "ok" and isinstance(ai_copy.get("sections"), list):
        blocks = []
        for section in ai_copy.get("sections", [])[:6]:
            if not isinstance(section, dict):
                continue
            heading = clean_text(section.get("heading"))
            body = clean_text(section.get("body"))
            if heading and body:
                blocks.append(
                    f"""
      <h2 class="text-2xl font-bold text-white mt-12 mb-6 border-l-4 border-yellow-500 pl-4">{escape(heading)}</h2>
      <p class="text-gray-300 mb-8">{escape(body)}</p>"""
                )
        ai_sections = "".join(blocks)
    return f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(summary)}">
  <meta name="keywords" content="{escape(keywords_meta)}">
  <link rel="canonical" href="{official_url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(summary)}">
  <meta property="og:url" content="{official_url}">
  <meta property="og:image" content="{image_url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(title)}">
  <meta name="twitter:description" content="{escape(summary)}">
  <meta name="twitter:image" content="{image_url}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    body {{ font-family: 'Noto Sans TC', sans-serif; background: #050505; color: #e5e5e5; line-height: 1.8; }}
    .gold-accent {{ color: #D4AF37; }}
    .glass-panel {{ background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.08); padding: 2rem; border-radius: 16px; margin: 2rem 0; }}
    .btn-call {{ background-color: #D4AF37; color: black; font-weight: bold; padding: 1rem 2rem; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; width: 100%; max-width: 320px; white-space: nowrap; text-decoration: none; }}
  </style>
  <script type="application/ld+json" data-seo="procore">{json.dumps(json_ld, ensure_ascii=False)}</script>
</head>
<body class="p-6 md:p-12">
  <article class="max-w-4xl mx-auto">
    <header class="mb-16">
      <a href="/cases" class="text-gray-500 text-sm hover:text-white transition">回到案件紀錄</a>
      <div class="mt-8">
        <span class="text-gold-accent border border-yellow-600/30 px-3 py-1 text-[10px] uppercase tracking-widest">Field Case</span>
      </div>
      <h1 class="text-3xl md:text-5xl font-bold text-white mt-6 mb-8 leading-tight">
        {escape(h1)}
      </h1>
      <p class="text-gray-300 text-lg">{escape(summary)}</p>
    </header>

    <section class="article-content">
{image_block}
      <h2 class="text-2xl font-bold text-white mb-6 border-l-4 border-yellow-500 pl-4">案件狀況</h2>
      <p class="text-gray-300 mb-8">
        {escape(vehicle)} 在 {escape(location)} 遇到 {escape(issue_label)} 狀況。技師先確認車款年份、停放環境、鑰匙狀態與車主需求，再判斷是否適合安排到場處理。
      </p>
{ai_sections}

      <div class="glass-panel">
        <h3 class="text-xl font-bold text-gold-accent mb-6">處理原則</h3>
        <ul class="text-gray-300 text-sm space-y-3">
          <li><strong class="text-white">先確認身份與車輛資訊：</strong>避免錯誤作業，也保護車主權益。</li>
          <li><strong class="text-white">只公開服務結果：</strong>文章不揭露可複製的防盜、匹配或解鎖細節。</li>
          <li><strong class="text-white">交車前完整測試：</strong>確認遙控、感應、啟動與車主實際使用流程。</li>
        </ul>
      </div>

      <h2 class="text-2xl font-bold text-white mt-12 mb-6 border-l-4 border-yellow-500 pl-4">完成結果</h2>
      <p class="text-gray-300 mb-8">
        {escape(summary)} 如遇相同情況，可先傳車款、年份、所在地與照片，由 ProCore 判斷是否能到場協助。
      </p>

      <div class="bg-yellow-900/20 border border-yellow-500/30 p-8 rounded-2xl mt-12 text-center">
        <h4 class="text-gold-accent font-bold text-xl mb-4">需要汽車鑰匙到場服務？</h4>
        <p class="text-gray-400 text-sm mb-6">請先準備車款、年份、所在地與鑰匙狀況；若車輛在地下室、拍場或路邊，也請一併告知現場環境。</p>
        <div class="flex flex-col md:flex-row gap-4 justify-center">
          <a href="tel:{PHONE}" class="btn-call transition transform hover:scale-105">電話：{PHONE}</a>
          <a href="https://line.me/R/ti/p/{LINE_ID}" class="border border-green-600 text-green-500 font-bold px-8 py-4 rounded-full hover:bg-green-600 hover:text-white transition">LINE：{LINE_ID}</a>
        </div>
      </div>
    </section>
  </article>
</body>
</html>
"""


def render_article_latest(manifest: dict, publish_args: dict, case_img: str) -> str:
    source = manifest.get("source", {})
    ai_copy = manifest.get("aiCopy", {}) if isinstance(manifest.get("aiCopy"), dict) else {}
    title = clean_text(publish_args["title"])
    summary = shorten(clean_text(publish_args["summary"]), 150)
    link = clean_link(publish_args["path"])
    official_url = f"{SITE}{link}"
    vehicle = clean_text(source.get("vehicleLabel")) or clean_text(publish_args.get("caseCar")) or "車輛"
    location = clean_text(source.get("publicLocation")) or clean_text(publish_args.get("caseRegion")) or "台灣"
    issue_type = clean_text(source.get("issueType"))
    issue_label = {
        "all_keys_lost": "鑰匙全丟",
        "keyless_not_detected": "感應鑰匙異常",
        "remote_failure": "遙控鑰匙異常",
        "lockout": "車門反鎖",
        "spare_key": "備用鑰匙",
        "smart_key": "智慧鑰匙服務",
    }.get(issue_type, "汽車鑰匙服務")
    service_label = clean_text(source.get("serviceLabel")) or issue_label
    scene = clean_text(source.get("scene"))
    service = clean_text(source.get("service")) or service_label
    result = clean_text(source.get("result")) or clean_text(publish_args.get("summary"))
    year = clean_text(source.get("year"))
    vehicle_with_year = " ".join(part for part in [year, vehicle] if part)
    h1 = clean_text(ai_copy.get("h1")) if ai_copy.get("status") == "ok" else ""
    h1 = h1 or clean_text(source.get("title")) or title
    h1 = h1.replace(" | 極致核心 ProCore", "")
    h1 = h1.replace("｜極致核心 ProCore", "")
    keywords = [item.strip() for item in clean_text(publish_args.get("keywords")).split(",") if item.strip()]
    keywords_meta = "、".join(dict.fromkeys(keywords))
    image_url = case_img if case_img.startswith("http") else f"{SITE}/{case_img}"
    date_value = clean_text(publish_args.get("lastmod")) or clean_text(publish_args.get("date")).replace(".", "-")
    hero_tag = f"{location}｜{vehicle}｜{service_label}".upper()
    hero_summary = clean_text(ai_copy.get("summary")) if ai_copy.get("status") == "ok" else ""
    hero_summary = hero_summary or summary

    if scene and "新增" in scene:
        scene_clause = "這次需求是新增智慧鑰匙，重點不是鑰匙全丟救援，而是確認原鑰匙狀態、車輛辨識與新增後的日常使用功能。"
        prep_detail = "新增案件會先確認目前是否還有可用鑰匙、是否只需要備用鑰匙，以及車主希望保留哪些日常使用功能。"
        prep_next_step = "若是新增鑰匙，請說明目前是否還有可用鑰匙，以及希望新增備用鑰匙還是處理感應、遙控或啟動異常。"
    elif scene and ("全丟" in scene or "遺失" in scene):
        scene_clause = "車主回報手邊沒有可用鑰匙，重點會放在身分確認、車輛狀態與安全的到場處理條件。"
        prep_detail = "鑰匙全丟案件會先確認車主身分、車輛是否可接近、停放位置與車輛電力狀態。"
        prep_next_step = "若是鑰匙全丟，請先說明車輛是否可開門、停放位置是否方便到場，以及手邊是否還有備用鑰匙或車籍相關資料。"
    elif scene:
        scene_clause = f"車主回報的狀況是{scene}，處理前會先把車款、年份、停放環境與功能需求確認清楚。"
        prep_detail = "這類案件會先確認故障或需求發生在哪一段，避免只用單一關鍵字判斷作業方向。"
        prep_next_step = "請描述遙控、感應、開門或啟動是哪一段出問題，也可以先附現場照片協助判斷。"
    else:
        scene_clause = "車主先提供車款、年份、所在地與現場照片，方便先判斷是否適合到場處理。"
        prep_detail = "到場前會先確認車款年份、停放位置、鑰匙狀態與車主需求，降低現場資訊不足造成的誤判。"
        prep_next_step = "請先提供車款年份、所在地、鑰匙狀況與現場照片，方便判斷下一步。"

    result_sentence = result.rstrip("。")
    direction_label = service_label[:-2] if service_label.endswith("處理") else service_label

    intro = (
        f"這次是{location}的 {vehicle_with_year} {service_label}案例。"
        f"{scene_clause}"
        f"收到照片與基本資料後，會先確認車款年份、停放位置、車輛狀態與身分資料，再評估現場條件是否適合到場處理。"
    )
    section_blocks = []
    if ai_copy.get("status") == "ok" and isinstance(ai_copy.get("sections"), list):
        for section in ai_copy.get("sections", [])[:6]:
            if not isinstance(section, dict):
                continue
            heading = clean_text(section.get("heading"))
            body = clean_text(section.get("body"))
            if heading and body:
                section_blocks.append((heading, body))
    if not section_blocks:
        section_blocks = [
            (
                f"{location} {vehicle} {service_label}案件背景",
                f"車主先提供車款、年份、所在地與現場照片，確認這次是{vehicle_with_year}的{service_label}需求。{prep_detail}公開案例只保留車款、地區、需求與完成結果，不公開可被濫用的作業細節。",
            ),
            (
                "到場前為什麼要先看照片？",
                f"照片可以先看車輛停放位置、周邊作業空間與是否有需要遮蔽的資訊。對{vehicle}這類車款來說，年份、鑰匙型式與現場條件都會影響安排方式；先把資訊補齊，才比較能判斷適合的處理方式。",
            ),
            (
                f"{vehicle} {direction_label}處理方向",
                f"本次到場處理以{service_label}為目標，現場依車輛狀態完成必要確認後，{result_sentence}。交車前會確認開關鎖、啟動與日常使用需要的功能；若實車有遙控或感應配備，也會依車況一起確認。",
            ),
            (
                f"{location}車主可先準備什麼",
                f"如果你也在{location}或附近遇到{vehicle}鑰匙需求，可以先傳車款年份、所在地、鑰匙狀況與現場照片。{prep_next_step}",
            ),
        ]
    article_sections = []
    for heading, body in section_blocks:
        article_sections.append(f"""
    <h2>{escape(heading)}</h2>
    <p>{escape(body)}</p>""")
    article_sections_html = "".join(article_sections)

    json_ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{SITE}/#website",
                "url": f"{SITE}/",
                "name": "極致核心 ProCore Auto Key",
                "inLanguage": "zh-TW",
                "publisher": {"@id": f"{SITE}/#business"},
            },
            {
                "@type": "LocalBusiness",
                "@id": f"{SITE}/#business",
                "name": "極致核心 ProCore Auto Key",
                "alternateName": "ProCore Auto Key",
                "url": f"{SITE}/",
                "telephone": "+886909277670",
                "image": f"{SITE}/img/procore_logo_main.jpg",
                "priceRange": "$$",
                "areaServed": ["台北市", "新北市", "桃園市", "新竹縣市", "苗栗縣", "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣"],
                "address": {"@type": "PostalAddress", "addressCountry": "TW"},
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+886909277670",
                    "contactType": "customer service",
                    "availableLanguage": ["zh-TW"],
                },
            },
            {
                "@type": "Article",
                "@id": f"{official_url}#webpage",
                "url": official_url,
                "headline": title,
                "description": summary,
                "image": image_url,
                "datePublished": date_value,
                "dateModified": date_value,
                "inLanguage": "zh-TW",
                "publisher": {"@id": f"{SITE}/#business"},
                "author": {"@id": f"{SITE}/#business"},
                "mainEntityOfPage": official_url,
            },
        ],
    }

    return f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(summary)}">
  <meta name="keywords" content="{escape(keywords_meta)}">
  <link rel="canonical" href="{official_url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="極致核心 ProCore Auto Key">
  <meta property="og:title" content="{escape(title)}">
  <meta property="og:description" content="{escape(summary)}">
  <meta property="og:url" content="{official_url}">
  <meta property="og:image" content="{image_url}">
  <meta property="og:image:secure_url" content="{image_url}">
  <meta property="og:image:alt" content="{escape(location)} {escape(vehicle)} {escape(issue_label)}處理完成案例">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escape(title)}">
  <meta name="twitter:description" content="{escape(summary)}">
  <meta name="twitter:image" content="{image_url}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=Cinzel:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {{ --gold: #d4af37; --gold-soft: rgba(212, 175, 55, .14); --panel: rgba(255,255,255,.055); }}
    body {{ margin: 0; font-family: 'Noto Sans TC', sans-serif; color: #ececec; background: radial-gradient(circle at 20% 0%, #202020 0, #080808 42%, #030303 100%); line-height: 1.85; }}
    .brand {{ font-family: 'Cinzel', serif; letter-spacing: .18em; }}
    .gold {{ color: var(--gold); }}
    .panel {{ background: var(--panel); border: 1px solid rgba(255,255,255,.1); border-radius: 22px; box-shadow: 0 24px 80px rgba(0,0,0,.32); }}
    .hero-line {{ background: linear-gradient(90deg, transparent, var(--gold), transparent); height: 1px; }}
    .btn-gold {{ background: linear-gradient(135deg, #f7e7a2, #d4af37 48%, #9e7418); color: #090909; font-weight: 900; border-radius: 999px; padding: .95rem 1.45rem; display: inline-flex; justify-content: center; align-items: center; text-decoration: none; }}
    .btn-dark {{ border: 1px solid rgba(212,175,55,.55); color: #f7e7a2; border-radius: 999px; padding: .95rem 1.45rem; display: inline-flex; justify-content: center; align-items: center; text-decoration: none; }}
    .article p {{ color: #cfcfcf; }}
    .article h2 {{ color: #fff; font-size: clamp(1.45rem, 3vw, 2rem); font-weight: 900; line-height: 1.35; margin-top: 2.8rem; margin-bottom: 1rem; }}
    .article h3 {{ color: #f7e7a2; font-weight: 800; margin-top: 1.4rem; margin-bottom: .5rem; }}
    .article a {{ color: #f7e7a2; text-decoration: underline; text-underline-offset: 4px; }}
  </style>
  <script type="application/ld+json" data-seo="procore">{json.dumps(json_ld, ensure_ascii=False)}</script>
</head>
<body>
  <main class="max-w-5xl mx-auto px-5 py-8 md:py-14">
    <nav class="flex items-center justify-between gap-4 mb-10 text-sm text-zinc-400">
      <a href="/" class="brand text-zinc-200 no-underline">PROCORE</a>
      <div class="flex gap-4">
        <a href="/cases" class="hover:text-white">案例</a>
        <a href="/blog" class="hover:text-white">專欄</a>
        <a href="/vcard" class="hover:text-white">電子名片</a>
      </div>
    </nav>

    <header class="panel overflow-hidden mb-10">
      <div class="grid md:grid-cols-[1.05fr_.95fr] gap-0 items-stretch">
        <div class="p-7 md:p-10 flex flex-col justify-center">
          <p class="gold text-xs tracking-[.32em] font-bold mb-4">{escape(hero_tag)}</p>
          <h1 class="text-3xl md:text-5xl font-black leading-tight text-white mb-6">{escape(h1)}</h1>
          <p class="text-zinc-300 text-lg">{escape(hero_summary)}</p>
          <div class="hero-line my-7"></div>
          <div class="flex flex-col sm:flex-row gap-3">
            <a class="btn-gold" href="tel:{PHONE}">電話 {PHONE}</a>
            <a class="btn-dark" href="https://line.me/R/ti/p/{LINE_ID}">LINE {LINE_ID}</a>
          </div>
        </div>
        <figure class="m-0 bg-black/30">
          <img src="{escape(case_img)}" alt="{escape(location)} {escape(vehicle)} {escape(issue_label)}處理完成案例" class="w-full h-full object-cover min-h-[360px]" loading="eager">
        </figure>
      </div>
    </header>

    <article class="article panel p-7 md:p-10">
      <p class="text-sm gold font-bold tracking-widest mb-4">案例分享</p>
      <p>{escape(intro)}</p>
{article_sections_html}

      <h2>這次處理重點</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="panel p-5">
          <h3>先確認車款與鑰匙需求</h3>
          <p>{escape(vehicle_with_year)} 的鑰匙型式、現有鑰匙狀態與車主需求會先確認清楚，再安排到場。</p>
        </div>
        <div class="panel p-5">
          <h3>依現場條件安排</h3>
          <p>停放位置、車輛是否可接近、周邊作業空間都會影響處理方式，先傳照片能更快判斷。</p>
        </div>
        <div class="panel p-5">
          <h3>完成後確認功能</h3>
          <p>完成後會確認開關鎖、啟動與日常使用狀態；若車輛具備遙控或感應功能，也會依車況確認。</p>
        </div>
        <div class="panel p-5">
          <h3>公開內容保留安全邊界</h3>
          <p>案例只保留地區、車款、需求與結果，不公開車主個資或可被複製的技術細節。</p>
        </div>
      </div>

      <section class="panel p-6 mt-10" id="faq">
        <h2 class="mt-0">{escape(vehicle)} {escape(issue_label)}常見問題</h2>
        <h3>一定要拖車嗎？</h3>
        <p>不一定。會先看車輛狀態、停放地點與現場條件；如果環境不適合作業，再建議更安全的方式。</p>
        <h3>可以直接報價嗎？</h3>
        <p>可以先估方向，但仍要看年份、鑰匙型式與車況。最準的方式是先傳車款、所在地與照片。</p>
        <h3>會公開車牌或個人資料嗎？</h3>
        <p>不會。案例素材會以去識別化為原則，也會避免公開不該外流的細節。</p>
      </section>

      <div class="mt-10 p-6 rounded-2xl" style="background: var(--gold-soft); border: 1px solid rgba(212,175,55,.28);">
        <h2 class="mt-0">{escape(location)} {escape(vehicle)} {escape(issue_label)}，可先傳照片評估</h2>
        <p>遇到汽車鑰匙問題，可以先把車款、年份、所在地與現場照片傳來。確認車況與停放條件後，再判斷是否適合到場處理。</p>
        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <a class="btn-gold" href="tel:{PHONE}">電話 {PHONE}</a>
          <a class="btn-dark" href="https://line.me/R/ti/p/{LINE_ID}">LINE {LINE_ID}</a>
        </div>
      </div>

      <div class="mt-10 grid sm:grid-cols-3 gap-4 text-sm">
        <a href="/cases" class="panel p-4 block no-underline">看更多案例分享</a>
        <a href="/blog" class="panel p-4 block no-underline">閱讀汽車鑰匙專欄</a>
        <a href="/vcard" class="panel p-4 block no-underline">儲存電子名片</a>
      </div>
    </article>
  </main>
</body>
</html>
"""


def replace_js_array(path: Path, name: str, data: list[dict]) -> None:
    text = path.read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    pattern = rf"const\s+{re.escape(name)}\s*=\s*\[.*?\];"
    updated, count = re.subn(pattern, f"const {name} = {payload};", text, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not replace {name} in {path.name}; matches={count}")
    write_text(path, updated)


def extract_js_array(path: Path, name: str) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(\[.*?\]);", text, flags=re.S)
    if not match:
        raise SystemExit(f"Could not find {name} in {path.name}")
    return json.loads(match.group(1))


def update_home_latest(publish_args: dict, case_img: str, limit: int) -> None:
    path = ROOT / "index.html"
    items = extract_js_array(path, "latestCases")
    link = clean_link(publish_args["path"])
    item = {
        "car": clean_text(publish_args.get("caseCar")) or "ProCore",
        "label": clean_text(publish_args["title"]).replace(" | 極致核心 ProCore", ""),
        "img": case_img,
        "link": link,
    }
    kept = [entry for entry in items if entry.get("link") != link]
    replace_js_array(path, "latestCases", [item, *kept][:limit])


def sync_indexes(publish_args: dict, case_img: str) -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    import publish_tool

    args = SimpleNamespace(
        title=publish_args["title"],
        path=publish_args["path"],
        category=publish_args["category"],
        summary=publish_args["summary"],
        date=publish_args["date"],
        lastmod=publish_args["lastmod"],
        keywords=publish_args.get("keywords", ""),
        case_region=publish_args.get("caseRegion", ""),
        case_car=publish_args.get("caseCar", ""),
        case_img=case_img,
        case_type=publish_args.get("caseType", ""),
    )
    link = publish_tool.clean_link(args.path)
    publish_tool.sync_blog(args, link)
    publish_tool.sync_cases(args, link)
    publish_tool.sync_sitemap(link, args.lastmod)


def approve(args: argparse.Namespace) -> None:
    pack = Path(args.pack).resolve()
    if not pack.exists():
        raise SystemExit(f"Pack not found: {pack}")
    run_validator(pack)
    manifest, publish_args = load_pack(pack)
    link = clean_link(publish_args["path"])
    article_path = article_path_from_link(link)
    case_img = resolve_case_img(args, pack, publish_args)
    plan = {
        "pack": pack.relative_to(ROOT).as_posix() if pack.is_relative_to(ROOT) else str(pack),
        "article": article_path.relative_to(ROOT).as_posix(),
        "link": link,
        "caseImg": case_img,
        "updates": ["article html", "blog.json", "blog.html", "cases.html", "cases.json", "sitemap.xml", "index.html latestCases"],
        "mode": "confirm" if args.confirm else "dry-run",
    }
    print(json.dumps(plan, ensure_ascii=False, indent=2))
    if not args.confirm:
        print("DRY_RUN=1")
        print("NEXT=add --confirm to approve and write website files")
        return
    if article_path.exists() and not args.allow_overwrite:
        raise SystemExit(f"Article already exists. Use --allow-overwrite to replace: {article_path.name}")
    article_html = render_article_latest(manifest, publish_args, case_img)
    write_text(article_path, article_html)
    publish_args["caseImg"] = case_img
    write_json(pack / "publish-tool-args.json", publish_args)
    sync_indexes(publish_args, case_img)
    update_home_latest(publish_args, case_img, args.home_limit)
    print(f"APPROVED=1")
    print(f"ARTICLE={article_path.relative_to(ROOT).as_posix()}")
    print(f"URL={SITE}{link}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Approve a ProCore case pack into the website.")
    parser.add_argument("pack", help="Draft pack directory.")
    parser.add_argument("--confirm", action="store_true", help="Actually write article and update indexes.")
    parser.add_argument("--allow-overwrite", action="store_true", help="Allow replacing an existing article file.")
    parser.add_argument("--case-img", default="", help="Already-redacted public image path, e.g. img/cases/foo.jpg.")
    parser.add_argument("--copy-first-media", action="store_true", help="Copy the first browser-safe draft media file into img/cases.")
    parser.add_argument("--redaction-confirmed", action="store_true", help="Required with --copy-first-media.")
    parser.add_argument("--home-limit", type=int, default=4, help="Number of homepage latest cases to keep.")
    args = parser.parse_args()
    approve(args)


if __name__ == "__main__":
    main()
