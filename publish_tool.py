#!/usr/bin/env python3
"""Publish/sync a ProCore article into site indexes.

This tool updates blog.json, the embedded blogData array in blog.html,
the embedded caseData array in cases.html when case metadata is provided,
and sitemap.xml. It does not create the article HTML itself.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = "https://www.carkey.com.tw"


def clean_link(value: str) -> str:
    link = value.strip()
    if not link.startswith("/"):
        link = f"/{link}"
    if link.endswith(".html"):
        link = link[:-5]
    return link


def read_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: list[dict]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def dedupe_prepend(items: list[dict], item: dict, key: str = "link") -> list[dict]:
    target = item.get(key)
    kept = [entry for entry in items if entry.get(key) != target]
    return [item, *kept]


def replace_js_array(path: Path, name: str, data: list[dict]) -> None:
    content = path.read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    pattern = rf"const\s+{re.escape(name)}\s*=\s*\[.*?\];"
    replacement = f"const {name} = {payload};"
    updated, count = re.subn(pattern, replacement, content, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not replace {name} in {path.name}; matches={count}")
    path.write_text(updated, encoding="utf-8")


def extract_js_array(path: Path, name: str) -> list[dict]:
    content = path.read_text(encoding="utf-8")
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(\[.*?\]);", content, flags=re.S)
    if not match:
        return []
    return json.loads(match.group(1))


def sync_blog(args: argparse.Namespace, link: str) -> None:
    item = {
        "date": args.date,
        "category": args.category,
        "title": args.title,
        "summary": args.summary,
        "link": link,
    }
    if args.keywords:
        item["keywords"] = [keyword.strip() for keyword in args.keywords.split(",") if keyword.strip()]
    blog_json = ROOT / "blog.json"
    items = dedupe_prepend(read_json(blog_json), item)
    write_json(blog_json, items)
    replace_js_array(ROOT / "blog.html", "blogData", items)


def sync_cases(args: argparse.Namespace, link: str) -> None:
    if not (args.case_region and args.case_car and args.case_img):
        return
    case_item = {
        "region": args.case_region,
        "car": args.case_car,
        "title": args.title.replace(" | 極致核心 ProCore", ""),
        "img": args.case_img,
        "link": link,
    }
    cases_path = ROOT / "cases.html"
    cases = dedupe_prepend(extract_js_array(cases_path, "caseData"), case_item)
    replace_js_array(cases_path, "caseData", cases)
    sync_cases_json(args)


def sync_cases_json(args: argparse.Namespace) -> None:
    path = ROOT / "cases.json"
    cases = read_json(path)
    existing = next((entry for entry in cases if entry.get("img") == args.case_img), None)
    kept = [entry for entry in cases if entry.get("img") != args.case_img]
    next_id = int(existing.get("id")) if existing else max([int(entry.get("id", 0)) for entry in kept] or [0]) + 1
    item = {
        "id": next_id,
        "date": args.date,
        "location": args.case_region,
        "brand": args.case_car,
        "type": args.case_type or args.category,
        "desc": args.summary,
        "img": args.case_img,
        "tag": "SUCCESS",
    }
    write_json(path, [item, *kept])


def sync_sitemap(link: str, lastmod: str) -> None:
    path = ROOT / "sitemap.xml"
    content = path.read_text(encoding="utf-8")
    loc = f"{SITE}{link}"
    item = f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod><priority>0.7</priority></url>"
    pattern = rf"\s*<url><loc>{re.escape(loc)}</loc>.*?</url>"
    if re.search(pattern, content, flags=re.S):
        content = re.sub(pattern, "\n" + item, content, flags=re.S)
    else:
        content = content.replace("</urlset>", f"{item}\n</urlset>")
    path.write_text(content, encoding="utf-8")


def withdraw_publication(link: str) -> None:
    blog_json = ROOT / "blog.json"
    blog_items = [entry for entry in read_json(blog_json) if entry.get("link") != link]
    write_json(blog_json, blog_items)
    replace_js_array(ROOT / "blog.html", "blogData", blog_items)

    cases_path = ROOT / "cases.html"
    cases = extract_js_array(cases_path, "caseData")
    removed_images = {entry.get("img") for entry in cases if entry.get("link") == link}
    replace_js_array(cases_path, "caseData", [entry for entry in cases if entry.get("link") != link])
    cases_json = ROOT / "cases.json"
    write_json(cases_json, [entry for entry in read_json(cases_json) if entry.get("img") not in removed_images])

    sitemap_path = ROOT / "sitemap.xml"
    content = sitemap_path.read_text(encoding="utf-8")
    loc = f"{SITE}{link}"
    pattern = rf"\s*<url><loc>{re.escape(loc)}</loc>.*?</url>"
    content, count = re.subn(pattern, "", content, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not remove one sitemap entry for {link}; matches={count}")
    sitemap_path.write_text(content, encoding="utf-8")


def main() -> None:
    global ROOT
    parser = argparse.ArgumentParser(description="Sync a ProCore article into indexes.")
    parser.add_argument("title", nargs="?")
    parser.add_argument("path", nargs="?", help="Article path, with or without .html")
    parser.add_argument("category", nargs="?")
    parser.add_argument("summary", nargs="?")
    parser.add_argument("--root", type=Path, default=ROOT, help="Explicit site worktree root")
    parser.add_argument("--withdraw", metavar="PATH", help="Remove one existing article from registries and sitemap")
    parser.add_argument("--date", default=date.today().strftime("%Y.%m.%d"))
    parser.add_argument("--lastmod", default=date.today().isoformat())
    parser.add_argument("--keywords", default="")
    parser.add_argument("--case-region", default="")
    parser.add_argument("--case-car", default="")
    parser.add_argument("--case-img", default="")
    parser.add_argument("--case-type", default="")
    parser.add_argument("--page-only", action="store_true", help="Update sitemap only for a non-article page")
    args = parser.parse_args()

    ROOT = args.root.resolve()

    if args.withdraw:
        link = clean_link(args.withdraw)
        withdraw_publication(link)
        print(f"WITHDRAWN_INDEX={link}")
        return
    if not all([args.title, args.path, args.category, args.summary]):
        parser.error("title, path, category and summary are required unless --withdraw is used")

    link = clean_link(args.path)
    if not args.page_only:
        sync_blog(args, link)
        sync_cases(args, link)
    sync_sitemap(link, args.lastmod)
    print(f"PUBLISHED_INDEX={link}")


if __name__ == "__main__":
    main()
