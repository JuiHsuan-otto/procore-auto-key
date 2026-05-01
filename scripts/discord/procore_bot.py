#!/usr/bin/env python3
"""Discord entry point for the ProCore mobile content workflow."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

try:
    import discord
except ImportError as exc:  # pragma: no cover - operator setup guard
    raise SystemExit(
        "Missing dependency: discord.py. Run `python -m pip install -r requirements-content-ops.txt`."
    ) from exc


ROOT = Path(__file__).resolve().parents[2]
COMMAND_PREFIX = os.environ.get("PROCORE_DISCORD_PREFIX", "!procore")
CHANNEL_ID = os.environ.get("DISCORD_PROCORE_CHANNEL_ID", "").strip()
USE_OPENAI = os.environ.get("PROCORE_USE_OPENAI", "").strip().lower() in {"1", "true", "yes", "on"}
AI_PROVIDER = os.environ.get("PROCORE_AI_PROVIDER", "").strip().lower()
USE_GEMINI = AI_PROVIDER == "gemini" or os.environ.get("PROCORE_USE_GEMINI", "").strip().lower() in {"1", "true", "yes", "on"}
AUTO_CASE_MESSAGES = os.environ.get("PROCORE_DISCORD_AUTO_CASE", "1").strip().lower() not in {"0", "false", "no", "off"}
AUTO_DEPLOY = os.environ.get("PROCORE_DISCORD_AUTO_DEPLOY", "1").strip().lower() not in {"0", "false", "no", "off"}
AUTO_BLOGGER = os.environ.get("PROCORE_DISCORD_AUTO_BLOGGER", "1").strip().lower() not in {"0", "false", "no", "off"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
SHORT_COMMANDS = {"ping", "status", "hi", "hello", "help", "說明"}
PUBLISH_WORDS = ("publish", "發布", "發佈", "full", "完整")
DRAFT_WORDS = ("draft", "草稿")
APPROVE_WORDS = ("approve", "核准", "套用")
PHOTO_PUBLIC_WORDS = ("照片可公開", "圖片可公開", "可公開照片", "照片已去識別", "圖片已去識別")
CASE_KEYWORDS = (
    "全丟",
    "遙控",
    "感應",
    "鑰匙",
    "智慧鑰匙",
    "反鎖",
    "拍場",
    "救援",
    "新增",
    "匹配",
    "啟動",
    "camaro",
    "benz",
    "bmw",
    "vw",
    "audi",
)


def allowed_channel(message: discord.Message) -> bool:
    if not CHANNEL_ID:
        return True
    return str(message.channel.id) == CHANNEL_ID


def is_dm(message: discord.Message) -> bool:
    return message.guild is None


def help_text() -> str:
    return (
        "ProCore bot 已在線上。\n\n"
        "測試：`!procore ping`\n\n"
        "最快用法：直接丟案件文字 + 照片，例如：\n"
        "```text\n"
        "2017 camaro 全丟 林口拍場\n"
        "```\n"
        "Bot 會產生文章、同步官網、commit/push，並在 Discord 回報完成狀態。\n\n"
        "只產草稿包：\n"
        "```text\n"
        "!procore draft\n"
        "品牌: BMW\n"
        "車款: X3\n"
        "年份: 2018\n"
        "地點: 台中北屯\n"
        "狀況: 鑰匙全丟，車輛停在地下室\n"
        "結果: 完成鑰匙匹配，遙控、感應與啟動正常\n"
        "```\n"
        "完整發布到官網：\n"
        "```text\n"
        "!procore publish\n"
        "品牌: VW\n"
        "車款: T6\n"
        "年份: 2022\n"
        "地點: 台北士林\n"
        "狀況: 遙控鑰匙異常\n"
        "結果: 完成鑰匙匹配，遙控、感應與啟動正常\n"
        "```\n"
        "核准既有草稿：`!procore approve drafts/YYYY-MM-DD-article-slug`\n\n"
        "附照片會存入 `img/cases/` 並用於官網案例。"
    )


def consume_word(body: str, words: tuple[str, ...]) -> tuple[bool, str]:
    stripped = body.lstrip()
    lowered = stripped.lower()
    for word in words:
        probe = word.lower()
        if lowered == probe:
            return True, ""
        if lowered.startswith(probe) and stripped[len(word) : len(word) + 1] in {"", " ", "\n", "\r", "\t"}:
            return True, stripped[len(word) :].strip()
    return False, body.strip()


def parse_mode(body: str) -> tuple[str, str]:
    matched, rest = consume_word(body, APPROVE_WORDS)
    if matched:
        return "approve", rest
    matched, rest = consume_word(body, PUBLISH_WORDS)
    if matched:
        return "publish", rest
    matched, rest = consume_word(body, DRAFT_WORDS)
    if matched:
        return "draft", rest
    return "draft", body.strip()


def is_photo_public(text: str) -> bool:
    return any(word in text for word in PHOTO_PUBLIC_WORDS)


def looks_like_case_message(text: str, has_attachments: bool) -> bool:
    if not has_attachments:
        return False
    lowered = text.lower()
    has_year = re.search(r"\b(19\d{2}|20\d{2})\b", text) is not None
    has_keyword = any(keyword.lower() in lowered for keyword in CASE_KEYWORDS)
    return has_year and has_keyword


def truncate_output(output: str, limit: int = 1600) -> str:
    output = output.strip()
    if len(output) <= limit:
        return output
    return output[-limit:]


async def save_attachments(message: discord.Message) -> list[str]:
    if not message.attachments:
        return []
    target_dir = ROOT / "drafts" / "discord_uploads" / str(message.id)
    target_dir.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    for index, attachment in enumerate(message.attachments, 1):
        suffix = Path(attachment.filename).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES:
            continue
        target = target_dir / f"attachment-{index}{suffix}"
        await attachment.save(target)
        saved.append(str(target))
    return saved


def run_command(command: list[str]) -> tuple[int, str]:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    return result.returncode, output


def extract_case_pack(output: str) -> str:
    match = re.search(r"^CASE_PACK=(.+)$", output, flags=re.M)
    return match.group(1).strip() if match else ""


def run_intake(message_text: str, photo_paths: list[str], message_id: int) -> tuple[int, str, str]:
    out_path = ROOT / "drafts" / "intakes" / f"discord-{message_id}-case-intake.json"
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "procore_mobile_intake.py"),
        "--message",
        message_text,
        "--out",
        str(out_path),
        "--pack",
    ]
    if USE_OPENAI:
        command.append("--use-openai")
    if USE_GEMINI:
        command.extend(["--ai-provider", "gemini"])
    for photo in photo_paths:
        command.extend(["--photo", photo])
    code, output = run_command(command)
    return code, output, extract_case_pack(output)


def run_validate(pack: str) -> tuple[int, str]:
    return run_command(
        [
            sys.executable,
            str(ROOT / "scripts" / "content_automation" / "validate_content_pack.py"),
            pack,
        ]
    )


def run_approve(pack: str, publish_text: str, has_photos: bool) -> tuple[int, str]:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "approve_case_pack.py"),
        pack,
        "--confirm",
        "--allow-overwrite",
    ]
    if has_photos:
        command.extend(["--copy-first-media", "--redaction-confirmed"])
    return run_command(command)


def run_deploy(pack: str) -> tuple[int, str]:
    command = [
        sys.executable,
        str(ROOT / "scripts" / "content_automation" / "deploy_case_pack.py"),
        pack,
    ]
    if AUTO_BLOGGER:
        command.append("--blogger")
    return run_command(command)


def format_draft_reply(output: str, validation: str = "") -> str:
    body = output
    if validation:
        body = f"{body}\n\n{validation}"
    return "ProCore 草稿包已建立。\n" f"```text\n{truncate_output(body)}\n```"


def format_publish_reply(pack_output: str, approve_output: str) -> str:
    body = f"{pack_output}\n\n{approve_output}"
    return (
        "ProCore 官網本機檔案已同步。\n"
        "已更新文章 HTML、blog/cases/index/sitemap。\n"
        f"```text\n{truncate_output(body)}\n```"
    )


def find_line(output: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}=(.+)$", output, flags=re.M)
    return match.group(1).strip() if match else ""


def format_completed_reply(source_text: str, pack_output: str, approve_output: str, deploy_output: str) -> str:
    url = find_line(deploy_output, "URL") or find_line(approve_output, "URL")
    article = find_line(approve_output, "ARTICLE")
    commit = find_line(deploy_output, "COMMIT")
    pushed = find_line(deploy_output, "PUSHED")
    blogger = find_line(deploy_output, "BLOGGER")
    files = find_line(deploy_output, "FILES")

    title_hint = source_text.strip().splitlines()[0][:80] if source_text.strip() else "ProCore 案件"
    blogger_text = "Blogger 已自動發布。" if blogger == "published" else "Blogger 未發布，已保留草稿或等待環境變數設定。"
    push_text = "Git 已完成 commit 與 push。" if pushed == "1" else "Git 已建立 commit，但尚未 push。"

    details = [
        f"來源：{title_hint}",
        "",
        "1. Blogger / SEO 分發",
        f"- {blogger_text}",
        "- 官網文章為 canonical source，外部內容只做摘要與回鏈。",
        "",
        "2. 官網同步更新",
        f"- 專屬案例頁：{article or '(已建立)'}",
        f"- 正式網址：{url or '(待確認)'}",
        "- 已同步 blog.json、blog.html、cases.html、cases.json、sitemap.xml 與首頁最新實績。",
        "",
        "3. 圖片與部署",
        "- 現場照片已存入 img/cases/ 並套用到案例頁。" if "img/cases/" in files else "- 本次使用預設 ProCore 圖片。",
        f"- {push_text}",
    ]
    if commit:
        details.append(f"- Commit：{commit}")
    details.append("")
    details.append("案件流程已完成。")
    return "\n".join(details)


class ProCoreClient(discord.Client):
    async def on_ready(self) -> None:
        print(f"PROCORE_DISCORD_READY={self.user}")

    async def on_message(self, message: discord.Message) -> None:
        if message.author.bot or not allowed_channel(message):
            return

        raw = message.content.strip()
        lower = raw.lower()

        auto_case = False
        if not raw.startswith(COMMAND_PREFIX):
            mentioned = self.user is not None and self.user in message.mentions
            if is_dm(message) and lower in SHORT_COMMANDS:
                await message.reply(help_text())
                return
            elif mentioned and any(word in lower for word in SHORT_COMMANDS):
                await message.reply(help_text())
                return
            if AUTO_CASE_MESSAGES and looks_like_case_message(raw, bool(message.attachments)):
                auto_case = True
                body = raw
            else:
                return
        else:
            body = raw[len(COMMAND_PREFIX) :].strip()

        if not body or body.lower() in SHORT_COMMANDS:
            await message.reply(help_text())
            return

        mode, payload = ("publish", body) if auto_case else parse_mode(body)
        if mode != "approve" and not payload:
            await message.reply(help_text())
            return

        photos = await save_attachments(message)

        if mode == "approve":
            await message.add_reaction("🚀")
            pack = payload.split()[0] if payload else ""
            if not pack:
                await message.reply("請提供草稿包路徑，例如：`!procore approve drafts/2026-05-01-article-slug`")
                return
            code, output = run_approve(pack, payload, bool(photos))
            if code == 0 and AUTO_DEPLOY:
                deploy_code, deploy_output = run_deploy(pack)
                if deploy_code == 0:
                    await message.reply(format_completed_reply(payload, f"CASE_PACK={pack}", output, deploy_output))
                else:
                    await message.reply(
                        "ProCore 官網已同步，但 git/Blogger 部署失敗。\n"
                        f"```text\n{truncate_output(output + chr(10) + deploy_output)}\n```"
                    )
            elif code == 0:
                await message.reply(format_publish_reply(f"CASE_PACK={pack}", output))
            else:
                await message.reply("ProCore 官網同步失敗。\n" f"```text\n{truncate_output(output)}\n```")
            return

        await message.add_reaction("🚀" if mode == "publish" else "📝")
        code, output, pack = run_intake(payload, photos, message.id)
        if code != 0:
            await message.reply("ProCore 草稿包建立失敗，請回電腦查看錯誤。\n" f"```text\n{truncate_output(output)}\n```")
            return

        validation_output = ""
        if pack:
            validate_code, validation_output = run_validate(pack)
            if validate_code != 0:
                await message.reply(
                    "ProCore 草稿包已建立，但驗證未通過，暫不發布。\n"
                    f"```text\n{truncate_output(output + chr(10) + validation_output)}\n```"
                )
                return

        if mode == "draft":
            await message.reply(format_draft_reply(output, validation_output))
            return

        if not pack:
            await message.reply("ProCore 草稿包已建立，但找不到 CASE_PACK 路徑，暫不發布。\n" f"```text\n{truncate_output(output)}\n```")
            return

        approve_code, approve_output = run_approve(pack, payload, bool(photos))
        if approve_code == 0 and AUTO_DEPLOY:
            deploy_code, deploy_output = run_deploy(pack)
            if deploy_code == 0:
                await message.reply(format_completed_reply(payload, output, approve_output, deploy_output))
                return
            await message.reply(
                "ProCore 官網已同步，但 git/Blogger 部署失敗。\n"
                f"```text\n{truncate_output(output + chr(10) + approve_output + chr(10) + deploy_output)}\n```"
            )
            return

        if approve_code == 0:
            await message.reply(format_publish_reply(output, approve_output))
            return

        await message.reply("ProCore 官網同步失敗。\n" f"```text\n{truncate_output(output + chr(10) + approve_output)}\n```")


def main() -> None:
    token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("Missing DISCORD_BOT_TOKEN.")
    intents = discord.Intents.default()
    intents.message_content = True
    client = ProCoreClient(intents=intents)
    client.run(token)


if __name__ == "__main__":
    main()
