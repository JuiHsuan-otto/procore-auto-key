# Content Automation Scripts

These scripts create and validate review-ready drafts for website, Blogger, Threads, and Google Business Profile.

They do not publish public content.

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
