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
FALLBACK_MODELS = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"]
MAX_IMAGES = 3
MAX_IMAGE_BYTES = 8 * 1024 * 1024
BANNED_REPLACEMENTS = {
    "職人": "技師",
    "火速": "快速",
    "攻克": "處理",
    "深入解析": "整理",
    "完美匹配": "完成匹配",
    "守護您的駕駛權限": "協助恢復用車",
    "魂動美學": "車輛外觀",
    "數據重構": "資料確認",
    "全台．跨區．遠征": "跨區到場",
    "在現代社會中": "",
    "隨著科技": "",
    "不可或缺": "常見",
    "至關重要": "很重要",
    "本文將": "這篇案例會",
    "以下將": "接下來會",
    "本文旨在": "這篇案例整理",
    "深入探討": "整理",
    "專業團隊": "技師",
    "專業設備": "合適工具",
    "專業處理": "到場處理",
    "專業度": "處理方式",
    "量身打造": "依車況安排",
    "值得信賴": "清楚",
    "最佳選擇": "可評估的方式",
    "頂尖": "",
    "快速有效": "有效率",
    "高效便捷": "有效率",
    "一站式解決方案": "到場處理方式",
    "全方位解決方案": "處理方式",
    "為您提供最": "提供",
    "無論是": "不論",
    "不僅如此": "另外",
    "原廠標準": "日常使用需求",
    "最短時間": "確認條件後",
    "免拖車快速解決": "先評估是否適合到場處理",
    "無論車輛停放何處": "會依車輛停放位置評估",
    "無需再為鑰匙問題煩惱": "先確認下一步處理方式",
    "功能是否靈敏": "功能是否正常",
}


SEO_DISTRIBUTION_RULES = """
內容分發規則：
- 官網文章是 canonical source，負責完整案例、在地搜尋意圖、服務脈絡與轉換 CTA。
- Blogger 不是官網全文備份，必須改寫成 40-60% 長度的獨立導流短文，主角度可放在「車主會搜尋的問題、現場判斷重點、何時該先傳照片評估」。
- Blogger 不要複製官網 sections 的句子，不要使用同一組 H2，不要堆疊關鍵字；要自然提到車款、年份、地區、服務類型，並保留官網回鏈。
- 不做 cloaking、隱藏文字、給搜尋引擎看的隱藏關鍵字、假評論、假承諾或技術細節外洩。
- SEO 目標是降低重複內容風險、提高真實搜尋者的可讀性與詢問率，而不是規避搜尋引擎規則。
- 若照片不足以判斷現場細節，不得自行補地下室、拍場、車主滿意、刪除舊鑰匙等素材沒有提供的情節。
- 對外連結只能使用 JSON 內的 officialUrl 或 carkey.com.tw 網域；不得自行發明 procore.com.tw、Google 地圖、社群網址或其他外部網站。
"""


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def remove_banned_phrases(value: str) -> str:
    text = str(value or "")
    for phrase, replacement in BANNED_REPLACEMENTS.items():
        text = text.replace(phrase, replacement)
    return clean(text)


def should_use_gemini(provider: str = "") -> bool:
    provider = clean(provider or os.environ.get("PROCORE_AI_PROVIDER")).lower()
    enabled = clean(os.environ.get("PROCORE_USE_GEMINI")).lower() in {"1", "true", "yes", "on"}
    return provider == "gemini" or enabled


def split_models(value: str) -> list[str]:
    return [clean(item).removeprefix("models/") for item in re.split(r"[,，;\s]+", value) if clean(item)]


def model_candidates() -> list[str]:
    primary = clean(os.environ.get("GEMINI_MODEL")) or DEFAULT_MODEL
    fallbacks = split_models(os.environ.get("GEMINI_FALLBACK_MODELS", ""))
    candidates = [primary, *fallbacks, *FALLBACK_MODELS]
    return list(dict.fromkeys(model for model in candidates if model))


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
        SEO_DISTRIBUTION_RULES
        + "\n"
        + "你是 ProCore 官網的真人案例編輯與在地 SEO 成交流程規劃師，不是廣告文案機器。"
        "請把技師回報、案件資訊與可能附上的現場照片，先判斷搜尋者意圖與成交阻力，再整理成可直接發布的繁體中文 SEO 案例內容。\n\n"
        "業績導向 SEO 策略：\n"
        "- 先判斷這筆素材最像哪一種搜尋需求：急救型（鑰匙全丟/車無法用）、追加備用型、感應或遙控異常型、特殊停放場域型、特定車款疑難型。\n"
        "- 文章角度要服務潛在客戶的下一步決策：他會擔心能不能到場、要不要拖車、需要準備什麼、是否安全、是否會洩漏資料、如何快速判斷報價方向。\n"
        "- 優先使用能帶來詢問的長尾字：地點 + 車款 + 問題、地點 + 汽車鑰匙、車款 + 鑰匙全丟、車款 + 智慧鑰匙新增、停放場域 + 鑰匙救援。\n"
        "- 每篇只選 1 個主要成交角度，不要什麼都寫；標題、首段、H2、CTA 要圍繞同一個搜尋意圖。\n"
        "- CTA 要自然引導讀者先傳車款、年份、所在地、鑰匙狀態與照片，讓詢問門檻降低。\n\n"
        "寫作核心：\n"
        "- 讀者是正在搜尋「地區 + 車款 + 汽車鑰匙問題」的台灣車主；內容要回答他下一步該準備什麼、怎麼判斷能否到場處理。\n"
        "- 每一段都必須有案件事實或決策價值：地點、車款年份、停放場域、鑰匙狀況、風險控管、完成結果、聯絡前準備。\n"
        "- 不要像 AI 文章。禁止開場空話、趨勢語、華麗形容詞、抽象承諾。不要寫「在現代社會中、隨著科技、不可或缺、至關重要、本文將、以下將、深入探討、專業團隊、量身打造、值得信賴、最佳選擇、快速有效、完美、頂尖」。\n"
        "- 禁止使用未確認承諾語：原廠標準、最短時間、免拖車快速解決、無論車輛停放何處、無需再為鑰匙問題煩惱。若素材沒有明確提供，只能寫「先評估是否適合到場處理」。\n"
        "- 不要寫得像教學文或技術揭密；這是案例頁，不是作業流程公開文。\n\n"
        "真實性規則：\n"
        "- 不得自行加入案件資料或照片中沒有的細節，例如車主如何找到我們、停放於室外停車場/地下室/保修廠、車主表示滿意、舊鑰匙刪除、具體功能逐項通過等。\n"
        "- 若資料沒有提供停放場域或驗收細節，請寫「會先確認停放環境」或「交車前會確認日常使用功能」，不要把它寫成已發生事實。\n"
        "- 可以根據 issueLabel 說明該類案件通常要先確認哪些資訊，但必須明確避免說成這次案例已確認的事實。\n\n"
        "SEO 規則：\n"
        "- title 格式優先使用「地點 + 年份 + 車款 + 服務意圖｜極致核心 ProCore」，60 字內，讀起來像真人標題。\n"
        "- H1 要包含地點、車款、問題類型；首段前 60 字要自然出現主關鍵字，不要堆疊。\n"
        "- metaDescription 120-150 字，必須包含地點、車款、問題、結果與聯絡前可準備的資訊。\n"
        "- secondaryKeywords 請放長尾搜尋詞，例如「台北士林 VW T6 智慧鑰匙」、「台北汽車鑰匙到場」、「VW 感應鑰匙異常」。\n"
        "- H2 請用搜尋者會問的語氣，不要用空泛詞，例如「VW T6 感應鑰匙異常，先確認哪些狀況？」。\n"
        "- 不做關鍵字堆砌；同一關鍵字在正文自然出現 1-2 次即可。\n\n"
        "安全與品牌規則：\n"
        "- 案件資料 JSON 裡的 publicLocation、publicVehicleLabel、year、issueLabel 是鎖定硬資料，不能改寫、泛化或自行推測。\n"
        "- title、H1、metaDescription、summary、primaryKeyword 都必須使用鎖定硬資料，不得把地點改成「台灣」或其他縣市。\n"
        "- 不公開車主姓名、電話、完整地址、車牌、VIN、文件細節。\n"
        "- 不揭露可複製的技術流程、設備步驟、繞過方式、PIN、EEPROM、OBD、dump 等敏感詞。\n"
        "- 只描述情境判斷、現場限制、風險控管、到場確認、完成結果與車主提醒。\n"
        "- 官網是 canonical source；Blogger 只做摘要與回鏈，不要複製整篇官網文。\n\n"
        "內容結構：\n"
        "- sections 至少 4 段，每段 120-180 字。\n"
        "- 建議段落：搜尋者遇到的問題、到場前先確認的條件、處理結果與交車確認、同車主可先準備什麼。\n"
        "- H2 應該像潛在客戶會搜尋或會問的句子，例如「雲林斗南 BMW 528 鑰匙全丟，需要先拖車嗎？」、「BMW 528 沒有備用鑰匙，聯絡前要準備什麼？」。\n"
        "- 如果照片能看出場域，只能描述可公開的環境類型，例如拍場、停車場、地下室、保修廠；不要猜完整地址或車主身份。\n\n"
        "請只回傳 JSON，格式如下：\n"
        "{\n"
        '  "title": "60字內 SEO title，含地點、車款、服務",\n'
        '  "h1": "官網 H1",\n'
        '  "metaDescription": "120-150字摘要",\n'
        '  "summary": "80-120字案例摘要",\n'
        '  "primaryKeyword": "主關鍵字",\n'
        '  "secondaryKeywords": ["關鍵字1", "關鍵字2", "關鍵字3"],\n'
        '  "searchIntent": "這篇鎖定的搜尋意圖，例如急救型鑰匙全丟",\n'
        '  "conversionAngle": "這篇主打的成交角度，例如不用先拖車，先傳車款與現場照片評估",\n'
        '  "cta": "自然行動呼籲",\n'
        '  "sections": [\n'
        '    {"heading": "搜尋者會問的 H2", "body": "120-180字"},\n'
        '    {"heading": "到場前先確認的條件", "body": "120-180字"},\n'
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
        heading = remove_banned_phrases(item.get("heading"))
        body = remove_banned_phrases(item.get("body"))
        if heading and body:
            clean_sections.append({"heading": heading[:48], "body": body[:900]})

    threads = payload.get("threads")
    if not isinstance(threads, list):
        threads = []
    clean_threads = [remove_banned_phrases(item)[:500] for item in threads if remove_banned_phrases(item)][:3]

    secondary = payload.get("secondaryKeywords")
    if not isinstance(secondary, list):
        secondary = []

    return {
        "provider": "gemini",
        "model": clean(payload.get("model")),
        "title": remove_banned_phrases(payload.get("title"))[:90],
        "h1": remove_banned_phrases(payload.get("h1"))[:90],
        "metaDescription": remove_banned_phrases(payload.get("metaDescription"))[:180],
        "summary": remove_banned_phrases(payload.get("summary"))[:180],
        "primaryKeyword": remove_banned_phrases(payload.get("primaryKeyword"))[:80],
        "secondaryKeywords": [remove_banned_phrases(item)[:60] for item in secondary if remove_banned_phrases(item)][:8],
        "searchIntent": remove_banned_phrases(payload.get("searchIntent"))[:120],
        "conversionAngle": remove_banned_phrases(payload.get("conversionAngle"))[:160],
        "cta": remove_banned_phrases(payload.get("cta"))[:160],
        "sections": clean_sections,
        "bloggerTitle": remove_banned_phrases(payload.get("bloggerTitle"))[:90],
        "bloggerHtml": remove_banned_phrases(str(payload.get("bloggerHtml") or "").strip()),
        "threads": clean_threads,
        "gbpSummary": remove_banned_phrases(payload.get("gbpSummary"))[:650],
    }


def generate_ai_copy(identity: dict, intake: dict, media_entries: list[dict], provider: str = "") -> dict[str, Any]:
    if not should_use_gemini(provider):
        return {}

    api_key = clean(os.environ.get("GEMINI_API_KEY"))
    if not api_key:
        return {"provider": "gemini", "status": "skipped", "reason": "missing GEMINI_API_KEY"}

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
    attempted: list[str] = []
    last_failure: dict[str, Any] = {"provider": "gemini", "status": "failed", "reason": "no model attempted"}
    for model in model_candidates():
        attempted.append(model)
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
            last_failure = {
                "provider": "gemini",
                "model": model,
                "status": "failed",
                "reason": detail[:1000],
                "attemptedModels": attempted,
            }
            if exc.code in {404, 429, 500, 502, 503, 504}:
                continue
            return last_failure
        except OSError as exc:
            last_failure = {
                "provider": "gemini",
                "model": model,
                "status": "failed",
                "reason": str(exc)[:1000],
                "attemptedModels": attempted,
            }
            continue

        try:
            response_payload = json.loads(raw)
            text = extract_text(response_payload)
            ai_copy = sanitize_ai_copy(parse_json_text(text))
            ai_copy["model"] = model
            ai_copy["status"] = "ok"
            ai_copy["attemptedModels"] = attempted
            if attempted[0] != model:
                ai_copy["fallbackFrom"] = attempted[0]
            return ai_copy
        except Exception as exc:  # noqa: BLE001 - preserve the original text for operator review
            return {
                "provider": "gemini",
                "model": model,
                "status": "failed",
                "reason": f"{type(exc).__name__}: {exc}",
                "attemptedModels": attempted,
                "raw": raw[:2000],
            }
    return last_failure
