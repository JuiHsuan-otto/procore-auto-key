# Stage B — Guide-page Schema Rollout

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `894a8feaa2aa8da972bb1936d67150cbdfb5788c`
Status: implemented and verified; approved for feature-branch commit/push and Vercel Preview delivery. Merge, main, and production promotion remain out of scope.

## Problem and value

Twenty remaining guide pages still inherited `priceRange: "$$"`, which conflicts with the confirmed case-by-case quotation policy. This P1 page-type batch removes only that unsupported schema field while preserving every guide's visible content, URL, metadata, internal links, and other JSON-LD.

## Scope

The exact 20-file allowlist is recorded in `data/business-entity.json` and enforced by `scripts/validate-schema-image-pilot.mjs`. It covers the remaining inventory pages classified as `guide`, including troubleshooting, lost-key preparation, used-car, keyless, VAG, Porsche, Hyundai, and US-car market guides.

Pre-write audit confirmed all 20 pages were indexable, had one typed shared business definition, used only the governed compact or multiline legacy formatting, and had 2–9 primary internal inlinks. No case, location, hub, contact, language, service, brand/model, sitemap, robots, URL, copy, CTA, or Analytics code was changed.

## Verification

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 34 migrated schema pages, errors 0.
- Full-HTML comparison against `HEAD` proves the 20 guide files differ only by `priceRange` removal.
- `npm run test:seo-foundation`: passed; deterministic 135-page inventory current; governance errors 0.
- `npm run validate:site`: 135 HTML files, warnings 0, errors 0.
- `npm run audit:measurement`: 135 pages, warnings 0, errors 0; Static CTA taxonomy verified.
- `git diff --check`: passed.
- Legacy `priceRange` count: 120 before this batch → 100 after this batch; overall migration 134 → 100.

### Browser verification

- All 20 guide pages passed desktop 1440×900 checks: HTTP 200, one H1, one typed shared business definition, zero `priceRange`, meaningful content, no console warning/error, and no page error.
- Four representative templates were also checked at 390×844.
- Three mobile representatives passed all checks.
- `article-us-car-market-tech.html` retained a pre-existing horizontal overflow: current and `HEAD` both measured `scrollWidth 441` at a 390-pixel viewport. The cause is a two-button CTA row forced onto one line. This is not a schema-rollout regression; it is isolated for a separate mobile accessibility fix so the byte-guarded schema boundary remains pure.

### Analytics verification level

- **Static verified:** ordinary phone/LINE click paths do not emit `generate_lead`.
- **Browser verified:** not exercised; tracking code is unchanged and no CTA was clicked.
- **Not verified:** no new event-name, count, parameter, or network-payload claim is made.

### Production observation

The pre-write point-in-time reference was `2026-07-16T18:44:43+08:00`: live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`, with 7 match / 0 drift. Final observation at `2026-07-16T19:03:21+08:00` used the same live remote `main`; all seven targets returned HTTP 200 and reported 7 match / 0 drift. The immutable baseline record was not rewritten.

## Risk and rollback

- Schema risk is limited to consistency between migrated and remaining page types; search-visible guide content is unchanged.
- Before merge, rollback by reverting this batch commit on the feature branch or closing the Draft PR.
- After a future merge, revert the guide batch commit.
- No production rollback applies without a separately authorized production promotion.

## Commit boundary

`fix(seo): remove unsupported priceRange from guide pages`

Do not combine the remaining 100-page migration or the independent mobile CTA fix with this commit.

Subsequent status: the pre-existing overflow was resolved in the independent `stage-b-mobile-cta-overflow.md` batch. Re-verification measured no horizontal overflow at either 390×844 or 1440×900; the original schema-only boundary and findings remain unchanged.
