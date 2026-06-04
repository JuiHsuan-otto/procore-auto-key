#!/usr/bin/env python3
"""Fail the deployment when core SEO, routing, encoding or contact data breaks."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.carkey.com.tw"
PHONE = "0909277670"
LINE_ID = "@420gknem"
CORE = {"index.html", "blog.html", "cases.html", "service-areas.html", "vcard.html"}
TEXT_EXT = {".html", ".json", ".xml", ".txt", ".md", ".py", ".js"}


def local_target(path: str) -> Path | None:
    path = urlparse(path).path
    if path in {"", "/"}:
        return ROOT / "index.html"
    rel = path.lstrip("/")
    direct = ROOT / rel
    if direct.exists():
        return direct
    html = ROOT / f"{rel}.html"
    return html if html.exists() else None


def main() -> None:
    errors: list[str] = []
    html_files = sorted(ROOT.glob("*.html"))
    by_clean = {"/" if p.name == "index.html" else f"/{p.stem}": p for p in html_files}
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    blog = json.loads((ROOT / "blog.json").read_text(encoding="utf-8"))
    listed = {item.get("link") for item in blog}

    for p in sorted(x for x in ROOT.rglob("*") if x.is_file() and x.suffix.lower() in TEXT_EXT):
        text = p.read_text(encoding="utf-8-sig")
        rel = p.relative_to(ROOT)
        if "\ufffd" in text or re.search(r"\?{4,}", text):
            errors.append(f"{rel}: possible mojibake")
        if re.search(r"(?:0909[- ]?277[- ]?670|0909277670)", text) and PHONE not in text:
            errors.append(f"{rel}: phone must be written as {PHONE}")
        for line_id in re.findall(r"@\d{3}[a-z0-9]+", text, flags=re.I):
            if line_id.lower() != LINE_ID.lower():
                errors.append(f"{rel}: unexpected LINE ID {line_id}")

    for p in html_files:
        text = p.read_text(encoding="utf-8")
        soup = BeautifulSoup(text, "html.parser")
        if not soup.title or not soup.title.get_text(strip=True):
            errors.append(f"{p.name}: missing title")
        if not soup.select_one('meta[name="description"]'):
            errors.append(f"{p.name}: missing meta description")
        canonical = soup.select('link[rel="canonical"]')
        if len(canonical) != 1 or not canonical[0].get("href", "").startswith(SITE):
            errors.append(f"{p.name}: invalid canonical")
        if len(soup.select("h1")) != 1:
            errors.append(f"{p.name}: expected exactly one h1")
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                json.loads(script.string or script.get_text())
            except json.JSONDecodeError as exc:
                errors.append(f"{p.name}: invalid JSON-LD ({exc.msg})")
        for tag in soup.select("a[href],img[src],script[src],link[href]"):
            attr = "href" if tag.has_attr("href") else "src"
            value = tag.get(attr, "")
            if not value or value.startswith(("#", "tel:", "mailto:", "javascript:", "data:")):
                continue
            parsed = urlparse(value)
            if parsed.scheme or parsed.netloc:
                continue
            if local_target(value) is None:
                errors.append(f"{p.name}: missing internal target {value}")
            if attr == "href" and parsed.path.endswith(".html") and p.name != "index.html":
                errors.append(f"{p.name}: public link must use clean URL: {value}")

    for route, p in by_clean.items():
        if p.name.startswith("article-"):
            if route not in listed:
                errors.append(f"{p.name}: absent from blog.json")
            if f"<loc>{SITE}{route}</loc>" not in sitemap:
                errors.append(f"{p.name}: absent from sitemap.xml")
    for name in CORE:
        if not (ROOT / name).exists():
            errors.append(f"missing core page {name}")

    if errors:
        print("SITE_VALID=0")
        print("\n".join(sorted(set(errors))))
        return 1
    print(f"SITE_VALID=1 pages={len(html_files)} articles={len(by_clean)-1}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
