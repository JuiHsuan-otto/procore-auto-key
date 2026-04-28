#!/usr/bin/env python3
"""Generate review-ready cross-platform content drafts for ProCore.

This script does not publish anything. It reads an existing official website
entry from blog.json and creates platform-specific draft files under drafts/.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.carkey.com.tw"
PHONE = "0909277670"
LINE_ID = "@420gknem"
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
]


def load_blog_items() -> list[dict]:
    path = ROOT / "blog.json"
    if not path.exists():
        raise SystemExit("blog.json not found")
    return json.loads(path.read_text(encoding="utf-8"))


def clean_text(text: str) -> str:
    text = re.sub(r"【[^】]{1,24}】", "", text or "")
    replacements = {
        "專業指南": "車主指南",
        "全解析": "整理",
        "實錄": "紀錄",
        "火速": "到場",
        "數據重構": "資料重建",
        "深入解析": "整理",
        "完美匹配": "完成匹配",
        "職人": "技師",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug_from_link(link: str) -> str:
    return link.strip("/").replace("/", "-") or "home"


def with_utm(url: str, channel: str) -> str:
    params = {
        "blogger": "utm_source=blogger&utm_medium=referral&utm_campaign=ai_content_pack",
        "threads": "utm_source=threads&utm_medium=social&utm_campaign=ai_content_pack",
        "googleBusinessProfile": "utm_source=google_business_profile&utm_medium=local_post&utm_campaign=ai_content_pack",
    }[channel]
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{params}"


def pick_item(args: argparse.Namespace) -> dict:
    items = load_blog_items()
    if not items:
        raise SystemExit("blog.json is empty")
    if args.link:
        target = args.link if args.link.startswith("/") else f"/{args.link}"
        for item in items:
            if item.get("link") == target:
                return item
        raise SystemExit(f"No blog.json item found for link: {target}")
    return items[0]


def build_blogger(item: dict, official_url: str) -> str:
    title = clean_text(item.get("title", "汽車鑰匙服務紀錄"))
    summary = clean_text(item.get("summary", ""))
    labels = item.get("keywords") or [item.get("category", "汽車鑰匙"), "極致核心"]
    label_text = "、".join(str(x) for x in labels[:5])
    backlink = with_utm(official_url, "blogger")
    return f"""<article>
  <h1>{title}</h1>
  <p>{summary}</p>
  <p>如果你遇到類似狀況，先確認車款年份、停車位置、是否還有備用鑰匙，再決定是否需要拖車。多數案件可以先評估是否能到場處理。</p>
  <p>完整官網說明與相關案例：<a href=\"{backlink}\" rel=\"noopener\">{official_url}</a></p>
  <h2>聯絡前建議準備</h2>
  <ul>
    <li>車款、年份與所在地</li>
    <li>鑰匙是全丟、備份，還是感應異常</li>
    <li>車輛是否在地下室、拍場、路邊或維修廠</li>
    <li>儀表是否有錯誤訊息</li>
  </ul>
  <p>極致核心 ProCore：電話 {PHONE}，LINE ID {LINE_ID}。</p>
  <p>標籤：{label_text}</p>
</article>
""".strip() + "\n"


def build_threads(item: dict, official_url: str) -> str:
    title = clean_text(item.get("title", "汽車鑰匙服務紀錄"))
    summary = clean_text(item.get("summary", ""))
    url = with_utm(official_url, "threads")
    posts = [
        f"鑰匙全丟時，先別急著拖車。先確認車款年份、停車位置、是否還有備用鑰匙，再判斷能不能到場處理。{url}",
        f"{title}\n重點不是把鑰匙外殼複製出來，而是確認防盜系統、遙控、感應與啟動都能正常。LINE：{LINE_ID}",
        f"車停在地下室、拍場或路邊都可以先傳定位與車款。技師會先評估處理方式，再報價與安排到場。電話：{PHONE}",
    ]
    # Keep a trace of the source summary for reviewers without forcing it into a post.
    return "\n\n".join(f"THREAD {idx}\n{post[:500]}" for idx, post in enumerate(posts, 1)) + f"\n\nSOURCE_NOTE\n{summary}\n"


def build_gbp(item: dict, official_url: str) -> dict:
    title = clean_text(item.get("title", "汽車鑰匙服務"))
    summary = clean_text(item.get("summary", ""))
    summary = f"{title}。{summary} 可先傳車款、年份與所在地，評估是否能到場處理。LINE：{LINE_ID}"
    if len(summary) > 330:
        summary = summary[:327] + "..."
    return {
        "languageCode": "zh-TW",
        "summary": summary,
        "topicType": "STANDARD",
        "callToAction": {
            "actionType": "LEARN_MORE",
            "url": with_utm(official_url, "googleBusinessProfile"),
        },
    }


def build_checklist(item: dict, official_url: str) -> str:
    title = clean_text(item.get("title", "汽車鑰匙服務紀錄"))
    return f"""# Website Publishing Checklist

Source title: {title}
Official URL: {official_url}

- [ ] Official URL is clean and has no `.html`.
- [ ] Page has title, meta description, canonical, OG, Twitter, JSON-LD.
- [ ] Article has exactly one H1.
- [ ] Image alt text describes the vehicle/problem naturally.
- [ ] Include 2-4 internal links to related articles, `/blog`, `/cases`, or `/service-areas`.
- [ ] CTA uses phone `{PHONE}` and LINE `{LINE_ID}`.
- [ ] If this is a new HTML article, run the approved publish/sitemap sync flow.
- [ ] Generate Blogger, Threads, and Google Business Profile drafts after website validation.
- [ ] Do not publish external channels until status is `approved_for_publish`.
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["latest"], default="latest")
    parser.add_argument("--link", help="Official clean URL path, for example /article-lost-key-rescue-guide")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--out", default="drafts")
    args = parser.parse_args()

    item = pick_item(args)
    link = item.get("link", "/blog")
    if link.endswith(".html"):
        raise SystemExit("Refusing to generate drafts from .html URL. Use clean URL.")
    official_url = f"{SITE}{link}"
    slug = slug_from_link(link)
    out_dir = ROOT / args.out / f"{args.date}-{slug}"
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "date": args.date,
        "status": "drafted",
        "source": {
            "title": item.get("title"),
            "category": item.get("category"),
            "summary": item.get("summary"),
            "link": link,
            "officialUrl": official_url,
        },
        "channels": {
            "blogger": {"file": "blogger.html", "status": "draft"},
            "threads": {"file": "threads.txt", "status": "draft"},
            "googleBusinessProfile": {"file": "google-business-profile.json", "status": "draft"},
            "websiteChecklist": {"file": "website-checklist.md", "status": "review"},
        },
        "approvalRequired": True,
    }

    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "blogger.html").write_text(build_blogger(item, official_url), encoding="utf-8")
    (out_dir / "threads.txt").write_text(build_threads(item, official_url), encoding="utf-8")
    (out_dir / "google-business-profile.json").write_text(json.dumps(build_gbp(item, official_url), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "website-checklist.md").write_text(build_checklist(item, official_url), encoding="utf-8")

    print(f"DRAFT_PACK={out_dir.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
