# Stage B governance batch

Status: implemented and verified locally on `seo/stage-b-foundation-20260716`; feature-branch commit/push, draft PR, and Preview deployment were subsequently authorized. Production promotion remains out of scope without a separate explicit instruction.

At final verification `2026-07-16T01:26:54+08:00`, live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`; the original seven production targets still reported `7 match / 0 drift`. The saved baseline observation was not rewritten.

## Outcome

This second batch adds source-of-truth and evidence gates without changing any public HTML, URL, counter, schema, content, or production setting.

- `data/business-entity.json`: one shared business schema identity and 15 field-level verification/publication records. Legal name and canonical public brand remain null; `priceRange` remains null/unpublished.
- `data/business-metrics.json`: four legacy homepage metrics registered as hidden, with null values, non-numeric crawler fallback text, required evidence fields, and the currently observed unverified `data-target` values recorded as debt.
- `data/third-party-scripts.json`: five-page Washinmura allowlist, point-in-time headers/hash/data-flow observation, expansion freeze, and pending owner/privacy inputs.
- `scripts/validate-seo-governance.mjs`: validates entity evidence, metric publication gates, counter drift, third-party page allowlist/CSP, source-only deployment boundaries, required governance documents, and legacy debt counts.
- Governance documents define Case/Guide/entity-page DoD, content relationships, human inputs, and the GSC-dependent location-page decision framework.
- `.vercelignore` excludes `/data/` and `/scripts/`; public HTML is rejected if it references either source-only path.

## Third-party AEO decision

Current decision is `pending_owner_privacy_review`, not approval or removal. The mutable script observed at `2026-07-16T01:19:08+08:00` had SHA-256 `42b3ec8bc80662cf244244078b8fd17c17506e3f704543cd5502ce6f01cd3411` and POSTed page path, title, referrer, UA-derived bot label, structure flags, and viewport width to Washinmura. New-page expansion is blocked until owner, purpose, contract, retention, role, privacy disclosure, and keep/pin/remove decisions are supplied.

## Deliberately unresolved debt

The validator reports, but does not fabricate a fix for:

1. Four homepage counters with source `0` and unverified legacy `data-target` values.
2. One mutable/unversioned Washinmura script without integrity pinning.
3. Unsupported `priceRange: "$$"` in 134 HTML files.

These are warnings because this batch is governance-only. Counter HTML needs evidence or a separately approved non-numeric fallback change; AEO needs an owner/privacy decision; priceRange needs a representative schema pilot before rollout.

Subsequent status: the representative three-page schema/image pilot is documented in `stage-b-schema-image-pilot.md`. It reduced the legacy `priceRange` count from 134 to 131; it did not authorize a bulk rollout.

Further subsequent status: the homepage counter fallback batch is documented in `stage-b-metrics-fallback.md`. It removed the four public zero placeholders, legacy `data-target` values, and homepage 24H wording; the current governance validator therefore reports two known warnings instead of three. All four numeric metrics remain unverified and unpublished.

The next staged schema batch is documented in `stage-b-service-schema-rollout.md`. It extends the reviewed `priceRange` deletion to the eight remaining service pages only, reducing the legacy remainder from 131 to 123 without changing visible content or other page types.

## Verification

- `npm run test:seo-foundation`: passed; 135-page deterministic inventory plus three negative-gate tests.
- `npm run validate:governance`: 15 business fields, four metrics, one governed script, three known warnings, zero errors.
- `npm run validate:site`: 135 HTML, zero warnings, zero errors.
- `npm run audit:measurement`: 135 HTML, zero warnings, zero errors; CTA click paths still do not emit `generate_lead`.
- `git diff --check`: passed.
- Public HTML changed by this batch: zero files.

## Suggested future commit boundary

One governance-only commit: `chore(seo): add entity, metrics, and third-party evidence gates`. It should exclude first-batch sitemap and analytics hunks when commits are eventually prepared.

## Rollback

Remove the three new `data/*.json` sources, governance validator, five governance documents, package script entry, and the `/data/` and `/scripts/` `.vercelignore` lines. No public HTML or production rollback is required because none was changed or deployed.
