#!/usr/bin/env python3
"""Static pre-publish checks for the ProCore website."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "www.carkey.com.tw"
EXPECTED_LINE = "420gknem"
SKIP_PARTS = {"backup", "backups", ".git", "node_modules", "vendor"}


def live_files(pattern: str):
    for path in ROOT.rglob(pattern):
        if not any(part in SKIP_PARTS for part in path.relative_to(ROOT).parts):
            yield path


def route_exists(raw: str) -> bool:
    parsed = urlparse(raw)
    if parsed.netloc and parsed.netloc not in {DOMAIN, "carkey.com.tw"}:
        return True
    route = unquote(parsed.path)
    if not route or route == "/":
        return (ROOT / "index.html").is_file()
    rel = route.lstrip("/")
    candidates = [ROOT / rel]
    if not Path(rel).suffix:
        candidates += [ROOT / f"{rel}.html", ROOT / rel / "index.html"]
    return any(p.is_file() for p in candidates)


def main() -> int:
    errors: list[str] = []
    html_files = sorted(live_files("*.html"))
    for path in html_files:
        rel = path.relative_to(ROOT)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            errors.append(f"{rel}: invalid UTF-8 ({exc})")
            continue
        if "\ufffd" in text or re.search(r"\?{3,}", text):
            errors.append(f"{rel}: replacement/corruption marker found")
        if re.search(r'(?:href|src)=\\["\']', text):
            errors.append(f"{rel}: escaped quote in href/src")
        soup = BeautifulSoup(text, "html.parser")
        ids = [tag.get("id") for tag in soup.find_all(attrs={"id": True})]
        for duplicate in sorted({x for x in ids if ids.count(x) > 1}):
            errors.append(f"{rel}: duplicate id #{duplicate}")
        for tag, attr in [("a", "href"), ("img", "src"), ("script", "src"), ("link", "href"), ("source", "src")]:
            for node in soup.find_all(tag):
                value = (node.get(attr) or "").strip()
                if not value or value.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                    continue
                if value.startswith(("http://", "https://", "//")):
                    parsed = urlparse(value if not value.startswith("//") else "https:" + value)
                    if parsed.netloc not in {DOMAIN, "carkey.com.tw"}:
                        continue
                if not route_exists(value):
                    errors.append(f"{rel}: missing local {attr} {value}")
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            try:
                json.loads(script.string or script.get_text())
            except Exception as exc:
                errors.append(f"{rel}: invalid JSON-LD ({exc})")
        for match in re.finditer(r"line\.me/(?:R/ti/p/|ti/p/)?@([A-Za-z0-9_-]+)", text):
            if match.group(1) != EXPECTED_LINE:
                errors.append(f"{rel}: unexpected LINE ID @{match.group(1)}")

    for json_path in [ROOT / "blog.json", ROOT / "cases.json"]:
        try:
            json.loads(json_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{json_path.name}: invalid JSON ({exc})")

    try:
        tree = ET.parse(ROOT / "sitemap.xml")
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        seen = set()
        for loc in tree.findall(".//s:loc", ns):
            url = (loc.text or "").strip()
            if url in seen:
                errors.append(f"sitemap.xml: duplicate URL {url}")
            seen.add(url)
            if not route_exists(url):
                errors.append(f"sitemap.xml: URL has no matching file {url}")
    except Exception as exc:
        errors.append(f"sitemap.xml: invalid XML ({exc})")

    request_page = (ROOT / "rescue-request.html").read_text(encoding="utf-8")
    forbidden = ["localStorage", "sessionStorage", "document.cookie", "indexedDB", "XMLHttpRequest", "fetch("]
    for token in forbidden:
        if token in request_page:
            errors.append(f"rescue-request.html: forbidden persistence/network token {token}")
    if re.search(r"<form[^>]+action=", request_page, flags=re.I):
        errors.append("rescue-request.html: form action must not be present")
    for required in ["@420gknem", "0909277670", "不會把內容送出或儲存", "#draft=", "草稿連結"]:
        if required not in request_page:
            errors.append(f"rescue-request.html: missing required text {required}")

    if errors:
        print(f"FAIL: {len(errors)} issue(s)")
        for issue in errors:
            print(f"- {issue}")
        return 1
    print(f"PASS: {len(html_files)} HTML files, JSON, JSON-LD, sitemap, routes, assets, contacts and privacy checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
