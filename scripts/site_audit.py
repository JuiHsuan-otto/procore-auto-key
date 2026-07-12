#!/usr/bin/env python3
"""Fail deployment when core static-site, SEO or contact invariants are broken."""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PHONE = "0909277670"
LINE = "@420gknem"

class Scanner(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls=[]; self.titles=[]; self.h1=0; self.canonical=[]; self.charset=False
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if tag=="meta" and d.get("charset","").lower()=="utf-8": self.charset=True
        if tag=="h1": self.h1+=1
        if tag=="link" and d.get("rel")=="canonical": self.canonical.append(d.get("href",""))
        for key in ("href","src"):
            if d.get(key): self.urls.append(d[key])
    def handle_data(self, data): self.titles.append(data)

def local_exists(url: str) -> bool:
    path=urlparse(url).path.lstrip("/")
    if not path: return (ROOT/"index.html").exists()
    if "${" in path: return True
    return (ROOT/path).exists() or (ROOT/f"{path}.html").exists()

errors=[]
pages=list(ROOT.glob("*.html"))
for page in pages:
    raw=page.read_text("utf-8", errors="replace")
    p=Scanner(); p.feed(raw)
    if "\ufffd" in raw or re.search(r"\?{3,}", raw): errors.append(f"{page.name}: contains replacement/mojibake text")
    if not p.charset: errors.append(f"{page.name}: missing UTF-8 charset")
    if not re.search(r"<title>\s*[^<]{2,}\s*</title>",raw,re.I): errors.append(f"{page.name}: missing title")
    if not p.canonical: errors.append(f"{page.name}: missing canonical")
    if p.h1!=1: errors.append(f"{page.name}: expected one h1, got {p.h1}")
    for url in p.urls:
        url=url.replace('\\"','"')
        if url.startswith(("#","http://","https://","tel:","mailto:","data:","javascript:")): continue
        if not local_exists(url): errors.append(f"{page.name}: broken local URL {url}")

blog=json.loads((ROOT/"blog.json").read_text("utf-8"))
for item in blog:
    if not local_exists(item.get("link","")): errors.append(f"blog.json: broken article {item.get('link')}")

tree=ET.parse(ROOT/"sitemap.xml")
locs={n.text for n in tree.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
for item in blog:
    expected="https://www.carkey.com.tw"+item["link"]
    if expected not in locs: errors.append(f"sitemap.xml: missing {expected}")

core="\n".join((ROOT/f).read_text("utf-8") for f in ["index.html","blog.html","cases.html","service-areas.html","vcard.html"])
if PHONE not in core or LINE not in core: errors.append("core pages: canonical contact details missing")
if errors:
    print("SITE AUDIT FAILED\n"+"\n".join(f"- {e}" for e in sorted(set(errors)))); sys.exit(1)
print(f"SITE AUDIT OK: {len(pages)} HTML pages, {len(blog)} indexed posts, contacts {PHONE} / {LINE}")
