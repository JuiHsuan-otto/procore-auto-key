# Hermes ProCore Workflow

Hermes is the preferred writer and strategist for ProCore content. These helper
scripts connect Hermes-authored copy with the existing deterministic publishing
pipeline.

Recommended flow:

1. Create intake from Discord/mobile text.
2. Ask Hermes to write `aiCopy` using `ops/hermes_memory/PROCORE_CONTENT_PLAYBOOK.md`.
3. Generate a content pack with `--ai-copy`.
4. Validate the pack.
5. Approve/deploy only after Otto explicitly confirms.

For long `aiCopy`, Hermes should write the JSON file directly under
`drafts/intakes/` and report the path. Do not paste multi-part JSON into
Discord because split markers, reaction UI text, and copied profile text can
break the JSON.

Discord status reports should use:

```text
INTAKE=drafts/intakes/xxx-case-intake.json
AI_COPY=drafts/intakes/xxx-case-ai-copy.json
CASE_PACK=drafts/xxx
VALID=1
PUBLISH=not_requested
```

Gemini remains available as fallback through the older `--ai-provider gemini`
path, but it should not be the default writer.
