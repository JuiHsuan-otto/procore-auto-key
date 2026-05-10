# Content Automation Scripts

These scripts create and validate review-ready drafts for website, Blogger, Threads, and Google Business Profile.

They do not publish public content.

Writing style and SEO rules are defined in `PROCORE_STYLE_SOP.md`. Generated copy must avoid generic AI phrasing and keep every paragraph tied to vehicle, location, service intent, case context, or owner decision value.

## Mobile / Discord Case Pack

Create a local intake file from the template:

```bash
copy case_intake.example.json content_queue.local.json
```

Edit `content_queue.local.json` with the phone or Discord message details, then generate a draft pack:

```bash
python scripts/content_automation/procore_case_pack.py --intake content_queue.local.json
```

The generated folder contains:

- `website-article.html` - website article draft only
- `blogger.html` - Blogger draft with official backlink
- `threads.txt` - short social drafts
- `google-business-profile.json` - Google Business Profile local post payload
- `publish-tool-args.json` - arguments for the existing `publish_tool.py` flow
- `website-checklist.md` - manual review checklist

Validate the pack before any publish step:

```bash
python scripts/content_automation/validate_content_pack.py drafts/YYYY-MM-DD-article-slug
```

Publishing remains a separate approval step. External channels must be approved per platform.

Approve a reviewed pack into the static website:

```bash
python scripts/content_automation/approve_case_pack.py drafts/YYYY-MM-DD-article-slug
```

The first run is a dry run. After reviewing the plan, write the website files:

```bash
python scripts/content_automation/approve_case_pack.py drafts/YYYY-MM-DD-article-slug --confirm
```

This writes the root `article-*.html` file and updates `blog.json`, `blog.html`, `cases.html`, `cases.json`, `sitemap.xml`, and homepage `latestCases`.

By default, the case image is `img/procore_logo_main.jpg`. To use an already-redacted public image:

```bash
python scripts/content_automation/approve_case_pack.py drafts/YYYY-MM-DD-article-slug --case-img img/cases/redacted-case.jpg --confirm
```

For quick mobile-style text, generate the intake first:

```bash
python scripts/content_automation/procore_mobile_intake.py --message "品牌: BMW
車款: X3
年份: 2018
地點: 台中北屯
狀況: 鑰匙全丟，車輛停在地下室
結果: 完成鑰匙匹配，遙控、感應與啟動正常" --pack
```

This is the command the Discord bot calls after saving message attachments.

To enable Gemini-generated deep SEO copy:

```bash
set GEMINI_API_KEY=your_gemini_api_key
set PROCORE_AI_PROVIDER=gemini
set GEMINI_MODEL=gemini-2.5-flash
```

Hermes is the preferred writer for the current workflow. To use Hermes-authored
copy without spending Gemini/API writing tokens, create an `aiCopy` JSON file and
pass it into the pack generator:

```bash
python scripts/hermes/procore_case_controller.py brief --intake drafts/intakes/case-intake.json --out drafts/intakes/case-brief.json
# Ask Hermes to write drafts/intakes/case-ai-copy.json from that brief.
python scripts/hermes/procore_case_controller.py pack --intake drafts/intakes/case-intake.json --ai-copy drafts/intakes/case-ai-copy.json
```

In this mode ProCore scripts only render, validate, sync indexes, and deploy.
Hermes owns the commercial angle, SEO copy, and anti-AI-tone review.

Discord can also approve a pack into the local website files:

```text
!procore publish
品牌: BMW
車款: X3
年份: 2018
地點: 台中北屯
狀況: 鑰匙全丟，車輛停在地下室
結果: 完成鑰匙匹配，遙控、感應與啟動正常
```

That command generates the pack, validates it, runs `approve_case_pack.py --confirm`, updates the local static website files, then runs `deploy_case_pack.py` to commit and push the website changes.

OpenClaw-style Discord messages with an attached image are also supported:

```text
2017 camaro 全丟 林口拍場
```

The bot infers the vehicle, issue type, and public location, then returns a completion summary in Discord.

## Generate

```bash
python scripts/content_automation/generate_content_pack.py --source latest
```

Specific official article:

```bash
python scripts/content_automation/generate_content_pack.py --link /article-lost-key-rescue-guide
```

## Validate

```bash
python scripts/content_automation/validate_content_pack.py drafts/YYYY-MM-DD-article-slug
```

## Publish Boundary

Publishing to Blogger, Threads, or Google Business Profile requires explicit approval and platform credentials. Draft generation and validation are safe to run on a schedule.

## Daily Case Intake

When Meico provides today's vehicle photos, location, and whether the key was all-lost, follow `AI_CONTENT_AUTOMATION_SOP.md` section 3.

Use `case_intake.example.json` as the field reference when structured input is helpful. Public copy must be de-identified and must describe outcomes without exposing repeatable technical procedures.
