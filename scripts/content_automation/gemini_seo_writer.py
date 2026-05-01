#!/usr/bin/env python3
"""Gemini-backed SEO copy generation for ProCore case packs.

Uses the Gemini REST generateContent endpoint directly so the Discord bot does
not need an extra SDK dependency.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash"
MAX_IMAGES = 3
MAX_IMAGE_BYTES = 8 * 1024 * 1024


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def should_use_gemini(provider: str = "") -> bool:
    provider = clean(provider or os.environ.get("PROCORE_AI_PROVIDER")).lower()
    enabled = clean(os.environ.get("PROCORE_USE_GEMINI")).lower() in {"1", "true", "yes", "on"}
    return provider == "gemini" or enabled


def image_part(path: Path) -> dict[str, Any] | None:
    if not path.exists() or not path.is_file():
        return None
    if path.stat().st_size > MAX_IMAGE_BYTES:
        return None
    mime, _encoding = mimetypes.guess_type(str(path))
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        return None
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"inlineData": {"mimeType": mime, "data": data}}


def case_prompt(identity: dict, intake: dict) -> str:
    vehicle = intake.get("vehicle", {})
    context = intake.get("caseContext", {})
    seo = intake.get("seo", {})
    payload = {
        "vehicle": {
            "brand": vehicle.get("brand", ""),
            "model": vehicle.get("model", ""),
            "year": vehicle.get("year", ""),
            "publicVehicleLabel": identity.get("vehicleLabel", ""),
        },
        "case": {
            "publicLocation": identity.get("publicLocation", ""),
            "issueType": identity.get("issueType", ""),
            "issueLabel": identity.get("issueLabel", ""),
            "scene": context.get("scene", ""),
            "serviceType": context.get("serviceType", ""),
            "result": context.get("result", ""),
        },
        "seo": {
            "primaryKeyword": identity.get("primaryKeyword", ""),
            "secondaryKeywords": identity.get("secondaryKeywords", []),
            "tone": seo.get("tone", ""),
        },
    }
    return (
        "你是 ProCore 官網的真人案例編輯，不是廣告文案機器。"
        "請把技師回報、案件資訊與可能附上的現場照片，整理成可直接發布的繁體中文 SEO 案例內容。\n\n"
        "寫作核心：\n"
        "- 讀者是正在搜尋「地區 + 車款 + 汽車鑰匙問題」的台灣車主；內容要回答他下一步該準備什麼、怎麼判斷能否到場處理。\n"
        "- 每一段都必須有案件事實或決策價值：地點、車款年份、停放場域、鑰匙狀況、風險控管、完成結果、聯絡前準備。\n"
        "- 不要像 AI 文章。禁止開場空話、趨勢語、華麗形容詞、抽象承諾。不要寫「在現代社會中、隨著科技、不可或缺、至關重要、本文將、以下將、深入探討、專業團隊、量身打造、值得信賴、最佳選擇、快速有效、完美、頂尖」。\n"
        "- 不要寫得像教學文或技術揭密；這是案例頁，不是作業流程公開文。\n\n"
        "SEO 規則：\n"
        "- title 格式優先使用「地點 + 年份 + 車款 + 服務意圖｜極致核心 ProCore」，60 字內，讀起來像真人標題。\n"
        "- H1 要包含地點、車款、問題類型；首段前 60 字要自然出現主關鍵字，不要堆疊。\n"
        "- metaDescription 120-150 字，必須包含地點、車款、問題、結果與聯絡前可準備的資訊。\n"
        "- secondaryKeywords 請放長尾搜尋詞，例如「台北士林 VW T6 智慧鑰匙」、「台北汽車鑰匙到場」、「VW 感應鑰匙異常」。\n"
        "- H2 請用搜尋者會問的語氣，不要用空泛詞，例如「VW T6 感應鑰匙異常，先確認哪些狀況？」。\n"
        "- 不做關鍵字堆砌；同一關鍵字在正文自然出現 1-2 次即可。\n\n"
        "安全與品牌規則：\n"
        "- 不公開車主姓名、電話、完整地址、車牌、VIN、文件細節。\n"
        "- 不揭露可複製的技術流程、設備步驟、繞過方式、PIN、EEPROM、OBD、dump 等敏感詞。\n"
        "- 只描述情境判斷、現場限制、風險控管、到場確認、完成結果與車主提醒。\n"
        "- 官網是 canonical source；Blogger 只做摘要與回鏈，不要複製整篇官網文。\n\n"
        "內容結構：\n"
        "- sections 至少 4 段，每段 120-180 字。\n"
        "- 建議段落：案件背景、現場條件與評估、處理結果與交車確認、同車主可先準備什麼。\n"
        "- 如果照片能看出場域，只能描述可公開的環境類型，例如拍場、停車場、地下室、保修廠；不要猜完整地址或車主身份。\n\n"
        "請只回傳 JSON，格式如下：\n"
        "{\n"
        '  "title": "60字內 SEO title，含地點、車款、服務",\n'
        '  "h1": "官網 H1",\n'
        '  "metaDescription": "120-150字摘要",\n'
        '  "summary": "80-120字案例摘要",\n'
        '  "primaryKeyword": "主關鍵字",\n'
        '  "secondaryKeywords": ["關鍵字1", "關鍵字2", "關鍵字3"],\n'
        '  "sections": [\n'
        '    {"heading": "案件背景", "body": "120-180字"},\n'
        '    {"heading": "現場條件與評估", "body": "120-180字"},\n'
        '    {"heading": "處理結果與交車確認", "body": "120-180字"},\n'
        '    {"heading": "同車主可先準備什麼", "body": "120-180字"}\n'
        "  ],\n"
        '  "bloggerTitle": "Blogger 標題",\n'
        '  "bloggerHtml": "<article>...</article>",\n'
        '  "threads": ["500字內貼文1", "500字內貼文2", "500字內貼文3"],\n'
        '  "gbpSummary": "Google 商家檔案 650字內摘要"\n'
        "}\n\n"
        "案件資料 JSON：\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def extract_text(response: dict[str, Any]) -> str:
    candidates = response.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    chunks = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "\n".join(chunk for chunk in chunks if chunk).strip()


def parse_json_text(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise
        payload = json.loads(match.group(0))
    if not isinstance(payload, dict):
        raise ValueError("Gemini response JSON must be an object")
    return payload


def sanitize_ai_copy(payload: dict[str, Any]) -> dict[str, Any]:
    sections = payload.get("sections")
    if not isinstance(sections, list):
        sections = []
    clean_sections = []
    for item in sections[:6]:
        if not isinstance(item, dict):
            continue
        heading = clean(item.get("heading"))
        body = clean(item.get("body"))
        if heading and body:
            clean_sections.append({"heading": heading[:48], "body": body[:900]})

    threads = payload.get("threads")
    if not isinstance(threads, list):
        threads = []
    clean_threads = [clean(item)[:500] for item in threads if clean(item)][:3]

    secondary = payload.get("secondaryKeywords")
    if not isinstance(secondary, list):
        secondary = []

    return {
        "provider": "gemini",
        "model": clean(payload.get("model")),
        "title": clean(payload.get("title"))[:90],
        "h1": clean(payload.get("h1"))[:90],
        "metaDescription": clean(payload.get("metaDescription"))[:180],
        "summary": clean(payload.get("summary"))[:180],
        "primaryKeyword": clean(payload.get("primaryKeyword"))[:80],
        "secondaryKeywords": [clean(item)[:60] for item in secondary if clean(item)][:8],
        "sections": clean_sections,
        "bloggerTitle": clean(payload.get("bloggerTitle"))[:90],
        "bloggerHtml": str(payload.get("bloggerHtml") or "").strip(),
        "threads": clean_threads,
        "gbpSummary": clean(payload.get("gbpSummary"))[:650],
    }


def generate_ai_copy(identity: dict, intake: dict, media_entries: list[dict], provider: str = "") -> dict[str, Any]:
    if not should_use_gemini(provider):
        return {}

    api_key = clean(os.environ.get("GEMINI_API_KEY"))
    if not api_key:
        return {"provider": "gemini", "status": "skipped", "reason": "missing GEMINI_API_KEY"}

    model = clean(os.environ.get("GEMINI_MODEL")) or DEFAULT_MODEL
    parts: list[dict[str, Any]] = [{"text": case_prompt(identity, intake)}]
    for item in media_entries[:MAX_IMAGES]:
        copied = clean(item.get("copiedTo"))
        source = clean(item.get("source"))
        raw_path = copied or source
        if not raw_path:
            continue
        path = Path(raw_path)
        if not path.is_absolute():
            path = Path(item.get("_packRoot", "")) / raw_path if item.get("_packRoot") else path
        part = image_part(path)
        if part:
            parts.append(part)

    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.42,
            "topP": 0.9,
            "responseMimeType": "application/json",
        },
    }
    request = urllib.request.Request(
        API_URL.format(model=model),
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        return {"provider": "gemini", "model": model, "status": "failed", "reason": detail[:1000]}
    except OSError as exc:
        return {"provider": "gemini", "model": model, "status": "failed", "reason": str(exc)[:1000]}

    try:
        response_payload = json.loads(raw)
        text = extract_text(response_payload)
        ai_copy = sanitize_ai_copy(parse_json_text(text))
        ai_copy["model"] = model
        ai_copy["status"] = "ok"
        return ai_copy
    except Exception as exc:  # noqa: BLE001 - preserve the original text for operator review
        return {
            "provider": "gemini",
            "model": model,
            "status": "failed",
            "reason": f"{type(exc).__name__}: {exc}",
            "raw": raw[:2000],
        }
