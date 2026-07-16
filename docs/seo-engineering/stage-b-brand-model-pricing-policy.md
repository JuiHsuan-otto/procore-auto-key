# Stage B — Brand/Model Schema and Pricing Policy Batch

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `894a8feaa2aa8da972bb1936d67150cbdfb5788c`
Status: implemented and verified; approved for feature-branch commit/push and Vercel Preview delivery. Merge, main, and production promotion remain out of scope.

## Problem and value

The business owner confirmed that CarKey uses case-by-case quotations because vehicle, key system, work scope, travel, service timing, specialist work, and material costs vary. A public `$$` tier or guessed range is therefore not merely unverified; it is incompatible with the current service model.

This P1 batch turns that operating decision into a maintainable schema-output rule and applies the next small page-type migration. It reduces quotation ambiguity and customer-service risk without changing visible prices, URLs, copy, CTAs, or Analytics.

## Scope

Public HTML allowlist:

1. `bmw-smart-key-service.html`
2. `toyota-altis-car-key.html`
3. `vw-car-key-service.html`

Governance and tooling:

- `data/business-entity.json` records `pricing_model: case_by_case_quote`, `status: not_applicable`, and `schema_output: omit` for `priceRange`.
- The schema validator covers all 14 migrated pages and recognizes the three existing JSON formatting variants while requiring full-file equality with `HEAD` after only that field is removed.
- The governance validator enforces the exact three-stage allowlist and 120-file remainder.
- `pricing-policy.md` defines the future factor-based pricing explainer and blocks fixed prices, response-time promises, and inappropriate Product/Offer schema.
- The Human Input Register no longer treats a fixed price range as required for a factor-based explainer; H20 response-time evidence remains unresolved.

Out of scope:

- No public pricing page, new URL, sitemap entry, navigation link, or fixed amount.
- No “1–3 minutes” response-time promise.
- No changes to the remaining 120 HTML files.
- No merge, main update, production promotion, or production content change is part of this batch.

## Verification

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 14 schema pages, errors 0.
- `npm run test:seo-foundation`: passed; 135-page inventory current; governance errors 0.
- `npm run validate:site`: 135 HTML files, warnings 0, errors 0.
- `npm run audit:measurement`: 135 pages, warnings 0, errors 0; Static CTA taxonomy verified.
- `git diff --check`: passed.
- Legacy `priceRange` count: 123 before this batch → 120 after this batch; overall migration 134 → 120.

### Browser verification

BMW, Toyota Altis, and VW pages were each opened in headless Chrome at 1440×900 and 390×844. All six page/viewport combinations returned HTTP 200 and had exactly one H1, exactly one typed shared business definition, zero `priceRange` properties, meaningful body content, no horizontal overflow, and no console warning/error or page error. Representative desktop and mobile screenshots were inspected with no visible regression.

### Analytics verification level

- **Static verified:** `audit:measurement` confirms phone/LINE click paths do not emit `generate_lead`.
- **Browser verified:** not exercised in this batch because tracking code is unchanged and no CTA was clicked.
- **Not verified:** no new event-name, count, parameter, or network-payload claim is made.

### Production drift observation

- Pre-write reference: `2026-07-16T18:33:20+08:00`, live remote `main` `15301685c7d8dcb709c253b0759c770361840a54`, 7 match / 0 drift.
- Final observation: `2026-07-16T18:44:43+08:00`, the same live remote `main`, all seven targets HTTP 200, 7 match / 0 drift.
- The immutable `2026-07-16T00:58:11+08:00` baseline record was not rewritten. These are point-in-time observations only.

## Risk and rollback

- Search-visible content and routes are unchanged; risk is limited to staged schema consistency.
- Before merge, rollback by reverting this batch commit on the feature branch or closing the Draft PR.
- After a future merge, revert the batch commit. No production rollback applies unless production is separately authorized later.

## Commit boundary

`fix(seo): codify case-by-case pricing and clean brand schema`

Do not combine the remaining 120-page migration or a new public pricing page with this boundary.
