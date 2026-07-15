#!/usr/bin/env python3
"""Fast, dependency-free-enough pre-deploy checks for the static site."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.carkey.com.tw"


def pages() -> list[Path]:
    return sorted(ROOT.glob("*.html")) + sorted(ROOT.glob("local/*/*/*/index.html"))


def resolves(page: Path, value: str) -> bool:
    value = unquote(value.split("#", 1)[0].split("?", 1)[0])
    if not value:
        return True
    if value.startswith("/"):
        rel = value.lstrip("/")
        return any(candidate.exists() for candidate in (ROOT / rel, ROOT / f"{rel}.html", ROOT / rel / "index.html"))
    return (page.parent / value).exists()


def main() -> int:
    errors: list[str] = []
    html_pages = pages()
    indexable_canonicals: set[str] = set()
    for page in html_pages:
        rel = page.relative_to(ROOT)
        try:
            raw = page.read_text(encoding="utf-8", errors="strict")
        except UnicodeError as exc:
            errors.append(f"{rel}: invalid UTF-8: {exc}")
            continue
        soup = BeautifulSoup(raw, "html.parser")
        if "\ufffd" in raw or re.search(r"\?{4,}", raw):
            errors.append(f"{rel}: probable encoding corruption")
        if not soup.title or not soup.title.get_text(strip=True):
            errors.append(f"{rel}: missing title")
        if not soup.find("meta", attrs={"name": "description", "content": True}):
            errors.append(f"{rel}: missing meta description")
        canonical = soup.find("link", rel=lambda value: value and "canonical" in value)
        if not canonical:
            errors.append(f"{rel}: missing canonical")
        else:
            canonical_url = (canonical.get("href") or "").strip()
            if canonical_url and not canonical_url.startswith(SITE):
                errors.append(f"{rel}: canonical is outside canonical host: {canonical_url}")
            robots = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
            robots_value = (robots.get("content") or "").lower() if robots else ""
            if canonical_url and "noindex" not in robots_value:
                indexable_canonicals.add(canonical_url)
        if len(soup.find_all("h1")) != 1:
            errors.append(f"{rel}: expected exactly one h1")
        for tag, attr in (("a", "href"), ("img", "src"), ("script", "src"), ("link", "href")):
            for node in soup.find_all(tag):
                value = (node.get(attr) or "").strip()
                if not value or value.startswith(("#", "tel:", "mailto:", "javascript:", "data:", "http://", "https://", "//")):
                    continue
                if not resolves(page, value):
                    errors.append(f"{rel}: missing internal target {value!r}")
        for node in soup.find_all("script", attrs={"type": "application/ld+json"}):
            try:
                json.loads(node.string or node.get_text())
            except (TypeError, json.JSONDecodeError) as exc:
                errors.append(f"{rel}: invalid JSON-LD: {exc}")

    for index_name in ("blog.json", "cases.json"):
        try:
            entries = json.loads((ROOT / index_name).read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{index_name}: invalid JSON: {exc}")
            continue
        for entry in entries:
            link = entry.get("link")
            if link and not resolves(ROOT / index_name, link):
                errors.append(f"{index_name}: missing indexed page {link}")

    sitemap_path = ROOT / "sitemap.xml"
    sitemap = sitemap_path.read_text(encoding="utf-8-sig")
    blog_entries = json.loads((ROOT / "blog.json").read_text(encoding="utf-8"))
    for entry in blog_entries:
        link = entry.get("link", "")
        if link and f"<loc>{SITE}{link}</loc>" not in sitemap:
            errors.append(f"sitemap.xml: missing blog URL {link}")

    try:
        tree = ET.fromstring(sitemap)
        sitemap_urls = {node.text.strip() for node in tree.findall(".//{*}loc") if node.text}
        for url in sorted(indexable_canonicals - sitemap_urls):
            errors.append(f"sitemap.xml: missing indexable canonical {url}")
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML: {exc}")

    if errors:
        print("SITE QUALITY CHECK FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"SITE QUALITY CHECK PASSED: {len(html_pages)} HTML pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
