# Stage B priceRange closure

Status: committed and pushed to Draft PR #1; not merged or deployed to production.

## Objective and business value

CarKey uses case-by-case quotations. A generic `priceRange: "$$"` cannot be tied to a fixed, consistently applicable, owner-approved price policy and can mislead both customers and search systems. This batch closes the legacy structured-data debt without publishing a price table, changing visible service copy, or inventing business facts.

## Pre-write production observation

- Captured: `2026-07-17T01:55:06+08:00`
- Live remote main: `15301685c7d8dcb709c253b0759c770361840a54`
- Seven representative production resources returned HTTP 200.
- Production body SHA-256 values matched the files at that exact remote-main SHA: 7 match / 0 drift.
- This is a point-in-time observation. It does not update or replace the immutable baseline, and later production changes must be reported as drift.

## Controlled scope

The remaining baseline was 85 files and 86 exact `priceRange: "$$"` occurrences. The files were registered in seven bounded stages:

1. Remaining article/case batch 1: 15 files.
2. Remaining article/case batch 2: 15 files.
3. Remaining article/case batch 3: 15 files.
4. Remaining article/case batch 4: 13 files.
5. Location-page batch 1: 11 files.
6. Location-page batch 2: 11 files.
7. Utility/language batch: 5 files.

Together with the six earlier stages, `data/business-entity.json` now records 13 stages and exactly 134 unique files from the original Stage A baseline. The expected remainder is 0 and the migration status is `price_range_closed`.

Each affected HTML file changes only by removing the unsupported JSON-LD field. The visible copy, title, description, canonical, URL, CTA destinations, analytics code, image markup, business names, address placeholders, service areas, and all other schema fields remain unchanged.

## Guardrails and verification

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test` compares all 134 governed pages with `HEAD`, removes `priceRange` from the baseline in memory, and requires the remaining JSON-LD and full HTML bytes to match. Result: 134 schema pages, 0 errors.
- `node scripts/validate-seo-governance.mjs --self-test` requires 134 unique registered files, zero remaining `priceRange` files, the confirmed case-by-case quotation policy, and `schema_output: omit`. Result: 0 errors; the only warning is the separately governed Washinmura script.
- `git diff --check`: passed.
- `npm run test:seo-foundation`: passed; deterministic 135-page inventory current.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement`: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified and click paths do not emit `generate_lead`.
- Local HTTP smoke at `2026-07-17T01:59:33+08:00`: eight representative article, case, location, utility, and Vietnamese-language pages returned HTTP 200; each had one H1, parseable JSON-LD, and no `priceRange`.
- Browser visual/runtime verification is **Not verified** in this batch because the preferred `agent-browser` CLI is unavailable and the Vercel Preview HTML remains behind SSO. The full-HTML HEAD comparator proves no visible HTML bytes changed beyond deleting the JSON-LD field, but that static evidence is not mislabeled as a browser test.

## Analytics classification

This is a structured-data-only change. Static verification proves CTA code paths remain present and do not emit `generate_lead`. No CTA is clicked in this batch, so browser event and GA network-payload verification are **Not verified** for this batch; prior foundation evidence is not restated as a new runtime test.

## Out of scope

- No fixed prices, starting prices, ranges, `Offer`, `AggregateOffer`, or `Product` schema.
- No public pricing explainer page.
- No URL, sitemap, navigation, page deletion, framework, or production change.
- No Washinmura keep/pin/remove decision.
- No merge to main or production deployment.

## Rollback

Before commit, restore the 85 HTML files, `data/business-entity.json`, and the two validators from `HEAD`. After a future commit, revert that isolated commit. Do not change production or fabricate a replacement `priceRange` to make validation pass.

## Post-write production observation

- Captured: `2026-07-17T02:00:08+08:00`
- Live remote main remained `15301685c7d8dcb709c253b0759c770361840a54`.
- All seven representative resources returned HTTP 200 and matched the files at that SHA: 7 match / 0 drift.
- The original baseline was not rewritten, and production was not modified.

## Publication boundary

- Commit: `e0814e6122653eed3df2808c98f20fff6d555cc2`
- Boundary: `fix(seo): close legacy priceRange schema debt`
- Branch: `seo/stage-b-foundation-20260716`
- Draft PR: #1, open / draft / mergeable at publication observation.
- Vercel Preview: `dpl_Dp4TRvdBsbauFHbuiJwpVUsGHfmf`, READY, target=`null` (not production).
- No merge to main and no production deployment were performed.
