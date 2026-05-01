# ProCore Discord Bot

This bot is the phone entry point for ProCore content intake. It receives a `!procore` message, saves image attachments under `drafts/`, creates a structured case intake JSON, and generates a review-ready content pack.

Publishing is explicit:

- `!procore draft` creates a draft pack only.
- `!procore publish` creates the draft pack, validates it, writes the official website article, syncs `blog.json`, `blog.html`, `cases.html`, `cases.json`, `sitemap.xml`, and homepage `latestCases`, then commits and pushes the website files.
- `!procore approve drafts/YYYY-MM-DD-article-slug` approves an existing draft pack into the website and deploys it.

Blogger publishing is attempted only when `BLOGGER_SMTP_USER` and `BLOGGER_SMTP_APP_PASSWORD` are configured. Otherwise the bot keeps the Blogger draft and reports that Blogger is skipped.

## Setup

```bash
python -m pip install -r requirements-content-ops.txt
set DISCORD_BOT_TOKEN=your_bot_token
python scripts/discord/procore_bot.py
```

Optional channel lock:

```bash
set DISCORD_PROCORE_CHANNEL_ID=123456789012345678
```

Optional OpenAI flag:

```bash
set OPENAI_API_KEY=your_api_key
set PROCORE_USE_OPENAI=1
```

Gemini AI SEO writer:

```bash
set GEMINI_API_KEY=your_gemini_api_key
set PROCORE_AI_PROVIDER=gemini
set GEMINI_MODEL=gemini-2.5-flash
```

When OpenAI extraction is off, the bot still generates drafts from explicit fields like `品牌:` and `地點:`.

## Mobile Message Format

Quick test:

```text
!procore ping
```

Help:

```text
!procore help
```

OpenClaw-style quick case:

```text
2017 camaro 全丟 林口拍場
```

Attach the case photo to the same message. If the message looks like a vehicle case and has an image, the bot treats it as a publish request.

Case draft:

```text
!procore draft
品牌: BMW
車款: X3
年份: 2018
地點: 台中北屯
狀況: 鑰匙全丟，車輛停在地下室
結果: 完成鑰匙匹配，遙控、感應與啟動正常
```

Publish into the local website files:

```text
!procore publish
品牌: VW
車款: T6
年份: 2022
地點: 台北士林
狀況: 遙控鑰匙異常
結果: 完成鑰匙匹配，遙控、感應與啟動正常
```

Attach photos to the same Discord message. Published case photos are copied into `img/cases/`.

## Approve After Review

On the computer, approve a reviewed pack with:

```bash
python scripts/content_automation/approve_case_pack.py drafts/YYYY-MM-DD-article-slug --confirm
```

Use `--case-img img/cases/redacted-case.jpg` when you have prepared a public, redacted case image.
