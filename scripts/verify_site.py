#!/usr/bin/env python3
"""Static integrity checks for the ProCore website."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.carkey.com.tw"
ERRORS: list[str] = []


class Scanner(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []
        self.canonicals: list[str] = []
        self.titles = 0
        self.h1s = 0
        self.descriptions = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self.titles += 1
        elif tag == "h1":
            self.h1s += 1
        elif tag == "meta" and data.get("name", "").lower() == "description":
            self.descriptions += 1
        for attr in ("href", "src", "poster"):
            if data.get(attr):
                self.refs.append((attr, data[attr]))
        if tag.lower() == "link" and data.get("rel", "").lower() == "canonical":
            self.canonicals.append(data.get("href", ""))


def fail(message: str) -> None:
    ERRORS.append(message)


def local_target(source: Path, raw: str) -> Path | None:
    raw = raw.strip()
    if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return None
    if "${" in raw or "{{" in raw:
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    if path.startswith("/"):
        candidate = ROOT / path.lstrip("/")
    else:
        candidate = source.parent / path
    if path.endswith("/"):
        return candidate / "index.html"
    if candidate.exists():
        return candidate
    if candidate.suffix:
        return candidate
    if (candidate.with_suffix(".html")).exists():
        return candidate.with_suffix(".html")
    if (candidate / "index.html").exists():
        return candidate / "index.html"
    return candidate.with_suffix(".html")


def extract_array(path: Path, name: str) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(\[.*?\]);", text, re.S)
    if not match:
        fail(f"{path.name}: missing JS array {name}")
        return []
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        fail(f"{path.name}: invalid {name}: {exc}")
        return []


def check_html(path: Path) -> None:
    rel = path.relative_to(ROOT)
    text = path.read_text(encoding="utf-8")
    if "\ufffd" in text or "???" in text:
        fail(f"{rel}: mojibake/corruption marker")
    parser = Scanner()
    try:
        parser.feed(text)
    except Exception as exc:
        fail(f"{rel}: HTML parse error: {exc}")
    if rel.parent == Path(".") and rel.name != "offline.html":
        if parser.titles != 1:
            fail(f"{rel}: expected one title, found {parser.titles}")
        if parser.descriptions != 1:
            fail(f"{rel}: expected one meta description, found {parser.descriptions}")
        if parser.h1s != 1:
            fail(f"{rel}: expected one H1, found {parser.h1s}")
        if len(parser.canonicals) != 1:
            fail(f"{rel}: expected exactly one canonical, found {len(parser.canonicals)}")
        elif not parser.canonicals[0].startswith(SITE):
            fail(f"{rel}: canonical is outside official site")
    for attr, ref in parser.refs:
        target = local_target(path, ref)
        if target is not None and not target.exists():
            fail(f"{rel}: missing {attr} target {ref}")
    for index, payload in enumerate(re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', text, re.S | re.I), 1):
        try:
            json.loads(payload)
        except json.JSONDecodeError as exc:
            fail(f"{rel}: invalid JSON-LD #{index}: {exc}")


def check_sitemap() -> None:
    path = ROOT / "sitemap.xml"
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        fail(f"sitemap.xml: parse error: {exc}")
        return
    seen: set[str] = set()
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    for node in tree.findall("s:url/s:loc", ns):
        url = (node.text or "").strip()
        if url in seen:
            fail(f"sitemap.xml: duplicate URL {url}")
        seen.add(url)
        if not url.startswith(SITE):
            fail(f"sitemap.xml: foreign URL {url}")
            continue
        target = local_target(ROOT / "index.html", url[len(SITE):] or "/")
        if target is not None and not target.exists():
            fail(f"sitemap.xml: URL has no local target {url}")
    for required in (f"{SITE}/rescue-request", f"{SITE}/article-audi-r8-neihu-all-keys-lost"):
        if required not in seen:
            fail(f"sitemap.xml: missing required URL {required}")


def check_indexes() -> None:
    try:
        blog_json = json.loads((ROOT / "blog.json").read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"blog.json: invalid JSON: {exc}")
        blog_json = []
    embedded = extract_array(ROOT / "blog.html", "blogData")
    if blog_json != embedded:
        fail("blog.json and blog.html blogData differ")
    for item in blog_json:
        target = local_target(ROOT / "blog.html", item.get("link", ""))
        if target is not None and not target.exists():
            fail(f"blog.json: missing article {item.get('link')}")

    cases = extract_array(ROOT / "cases.html", "caseData")
    for item in cases:
        for key in ("link", "img"):
            target = local_target(ROOT / "cases.html", item.get(key, ""))
            if target is not None and not target.exists():
                fail(f"cases.html: missing {key} {item.get(key)}")

    latest = extract_array(ROOT / "index.html", "latestCases")
    if len(latest) != 4:
        fail(f"index.html: latestCases must contain 4 items, found {len(latest)}")
    for item in latest:
        for key in ("link", "img"):
            target = local_target(ROOT / "index.html", item.get(key, ""))
            if target is not None and not target.exists():
                fail(f"index.html: latestCases missing {key} {item.get(key)}")


def check_contact_and_privacy_tool() -> None:
    html_files = list(ROOT.glob("*.html")) + list((ROOT / "local").rglob("*.html"))
    for path in html_files:
        text = path.read_text(encoding="utf-8")
        for phone in re.findall(r"(?<!\d)09\d{8}(?!\d)", text):
            if phone != "0909277670":
                fail(f"{path.relative_to(ROOT)}: unexpected mobile number {phone}")
        css_at_rules = {"@keyframes", "@supports", "@charset", "@namespace", "@document"}
        for line_id in re.findall(r"(?<![\w])@[A-Za-z0-9_-]{6,}", text):
            if line_id not in {"@420gknem", "@context"} | css_at_rules:
                fail(f"{path.relative_to(ROOT)}: unexpected LINE-like ID {line_id}")

    tool = (ROOT / "rescue-request.html").read_text(encoding="utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "document.cookie"):
        if forbidden in tool:
            fail(f"rescue-request.html: forbidden persistence/network API {forbidden}")
    if "https://line.me/R/oaMessage/@420gknem/" not in tool:
        fail("rescue-request.html: missing official LINE message target")
    if "URLSearchParams" not in tool or "get('location')" not in tool:
        fail("rescue-request.html: missing safe location prefill support")
    for marker in ('id="draft-generate"', 'id="draft-copy"', 'id="draft-clear"', "window.location.hash", "'#draft='"):
        if marker not in tool:
            fail(f"rescue-request.html: missing hash-draft marker {marker}")
    if "?draft=" in tool or 'searchParams.set("draft"' in tool or "searchParams.set('draft'" in tool:
        fail("rescue-request.html: draft state must not use query parameters")
    for entry in ("index.html", "service-areas.html", "vcard.html"):
        if "/rescue-request" not in (ROOT / entry).read_text(encoding="utf-8"):
            fail(f"{entry}: missing rescue-request entry point")
    areas = (ROOT / "service-areas.html").read_text(encoding="utf-8")
    for marker in ('id="area-finder-form"', 'id="area-result"', "?location=", "官網目前尚未單列"):
        if marker not in areas:
            fail(f"service-areas.html: missing area finder marker {marker}")
    for forbidden in ("fetch(", "XMLHttpRequest", "localStorage", "sessionStorage"):
        if forbidden in areas:
            fail(f"service-areas.html: forbidden area lookup API {forbidden}")


def main() -> int:
    for path in sorted(ROOT.glob("*.html")):
        check_html(path)
    for path in sorted((ROOT / "local").rglob("*.html")):
        check_html(path)
    check_sitemap()
    check_indexes()
    check_contact_and_privacy_tool()
    if ERRORS:
        print(f"SITE_VERIFY_FAILED ({len(ERRORS)} issues)")
        for item in ERRORS:
            print(f"- {item}")
        return 1
    print("SITE_VERIFY_OK")
    print(f"HTML_FILES={len(list(ROOT.glob('*.html'))) + len(list((ROOT / 'local').rglob('*.html')))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
