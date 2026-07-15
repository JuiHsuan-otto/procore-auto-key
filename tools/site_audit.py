#!/usr/bin/env python3
"""Static production-site checks for CarKey/ProCore.

Checks HTML metadata, headings, JSON-LD, local links/fragments, common
encoding corruption, canonical uniqueness, contact consistency, sitemap XML,
and JSON data files. Exits non-zero on errors.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup

SKIP_DIRS = {".git", "backup", "backups", "node_modules", "busan_doc", "__pycache__"}
SITE_HOSTS = {"carkey.com.tw", "www.carkey.com.tw"}
PHONE_DIGITS = "0909277670"
LINE_ID = "@420gknem"
GARBLED = (
    re.compile(r"\ufffd"),
    re.compile(r"(?:Ã.|Â.|â€|ðŸ)"),
    re.compile(r"\?{4,}"),
)
MOBILE_RE = re.compile(r"(?<!\d)09\d{2}[\s-]?\d{3}[\s-]?\d{3}(?!\d)")
LINE_RE = re.compile(r"(?<![\w])@[A-Za-z0-9._-]{5,}")


def production_html(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.html"):
        rel = path.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if path.name.endswith((".pre_fix.html", ".bak.html")):
            continue
        files.append(path)
    return sorted(files)


def route_target(root: Path, source: Path, raw_path: str) -> Path | None:
    """Resolve a same-site URL path to a source file, including clean URLs."""
    path = unquote(raw_path).replace("\\", "/")
    if path.startswith("/"):
        candidate = root / path.lstrip("/")
    else:
        candidate = source.parent / path
    try:
        candidate = candidate.resolve()
        candidate.relative_to(root.resolve())
    except (ValueError, OSError):
        return None
    if candidate.is_file():
        return candidate
    if candidate.suffix:
        return candidate
    html = candidate.with_suffix(".html")
    if html.is_file():
        return html
    index = candidate / "index.html"
    if index.is_file():
        return index
    return html


def is_placeholder_href(value: str) -> bool:
    return value.strip() in {"", "#"} or value.lower().startswith(("javascript:", "mailto:", "tel:", "data:"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".", help="repository root")
    parser.add_argument("--root-only", action="store_true", help="audit only top-level HTML")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    files = production_html(root)
    if args.root_only:
        files = [p for p in files if p.parent == root]

    errors: list[str] = []
    warnings: list[str] = []
    soups: dict[Path, BeautifulSoup] = {}
    canonical_to_files: defaultdict[str, list[str]] = defaultdict(list)

    def err(path: Path | str, message: str) -> None:
        label = str(path.relative_to(root)) if isinstance(path, Path) else path
        errors.append(f"{label}: {message}")

    for path in files:
        rel = path.relative_to(root)
        try:
            raw = path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError as exc:
            err(path, f"not UTF-8 ({exc})")
            continue
        soup = BeautifulSoup(raw, "html.parser")
        soups[path.resolve()] = soup

        if not soup.html or (soup.html.get("lang") or "").lower() not in {"zh-tw", "zh-hant", "zh", "vi-tw", "vi"}:
            err(path, "missing/incorrect html lang")
        if not soup.title or not soup.title.get_text(strip=True):
            err(path, "missing title")
        description = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if not description or not description.get("content", "").strip():
            err(path, "missing meta description")
        canonical = soup.find_all("link", rel=lambda value: value and "canonical" in value)
        if len(canonical) != 1 or not canonical[0].get("href"):
            err(path, f"expected 1 canonical, found {len(canonical)}")
        else:
            href = canonical[0]["href"].strip().rstrip("/") or "https://www.carkey.com.tw"
            canonical_to_files[href].append(str(rel))
        h1s = soup.find_all("h1")
        if len(h1s) != 1:
            err(path, f"expected 1 h1, found {len(h1s)}")

        for pattern in GARBLED:
            match = pattern.search(raw)
            if match:
                err(path, f"possible encoding corruption near {match.group(0)!r}")
                break

        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            payload = script.string or script.get_text()
            try:
                json.loads(payload)
            except json.JSONDecodeError as exc:
                err(path, f"invalid JSON-LD at line {exc.lineno}: {exc.msg}")

        # Contact consistency: any mobile number or explicit LINE ID must match.
        for match in MOBILE_RE.findall(raw):
            if re.sub(r"\D", "", match) != PHONE_DIGITS:
                err(path, f"unexpected mobile number {match}")
        for match in LINE_RE.findall(raw):
            if match in {"@context", "@graph", "@keyframes", "@media"}:
                continue
            if match.lower() != LINE_ID.lower():
                err(path, f"unexpected LINE-like ID {match}")

    for canonical, owners in canonical_to_files.items():
        if len(owners) > 1:
            indexable = []
            for owner in owners:
                owner_soup = soups.get((root / owner).resolve())
                robots = owner_soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)}) if owner_soup else None
                content = (robots.get("content", "") if robots else "").lower()
                if "noindex" not in content:
                    indexable.append(owner)
            if len(indexable) > 1:
                err("canonical", f"duplicate indexable canonical {canonical}: {', '.join(indexable)}")

    # Link and fragment validation.
    for source, soup in soups.items():
        for node in soup.find_all(["a", "link", "script", "img", "source"]):
            attr = "href" if node.name in {"a", "link"} else "src"
            value = (node.get(attr) or "").strip()
            if not value or is_placeholder_href(value):
                continue
            split = urlsplit(value)
            if split.scheme and split.scheme not in {"http", "https"}:
                continue
            if split.netloc and split.netloc.lower() not in SITE_HOSTS:
                continue
            target_path = split.path
            if not target_path and split.fragment:
                target = source
            elif not target_path:
                continue
            else:
                target = route_target(root, source, target_path)
            # Asset URLs can have cache query strings; route_target handles path only.
            if target is None or not target.exists():
                err(source, f"missing local target: {value}")
                continue
            if split.fragment and target.suffix.lower() == ".html":
                target_soup = soups.get(target.resolve())
                if target_soup is None:
                    try:
                        target_soup = BeautifulSoup(target.read_text(encoding="utf-8-sig"), "html.parser")
                    except Exception:
                        continue
                frag = unquote(split.fragment)
                if not target_soup.find(id=frag) and not target_soup.find(attrs={"name": frag}):
                    err(source, f"missing fragment #{frag} in {target.relative_to(root)}")

    # Machine-readable files.
    for name in ("vercel.json", "blog.json", "cases.json"):
        path = root / name
        if not path.exists():
            warnings.append(f"{name}: missing")
            continue
        try:
            json.loads(path.read_text(encoding="utf-8-sig"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            err(path, f"invalid JSON: {exc}")
    sitemap = root / "sitemap.xml"
    try:
        tree = ET.parse(sitemap)
        locs = [e.text for e in tree.getroot().iter() if e.tag.endswith("loc")]
        if len(locs) != len(set(locs)):
            err(sitemap, "duplicate <loc> entries")
        if "https://www.carkey.com.tw/rescue-intake" not in locs:
            err(sitemap, "missing rescue-intake URL")
    except (ET.ParseError, OSError) as exc:
        err(sitemap, f"invalid XML: {exc}")

    print(f"Audited {len(files)} HTML files")
    for item in warnings:
        print(f"WARN  {item}")
    if errors:
        for item in errors:
            print(f"ERROR {item}")
        print(f"FAILED: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
