# Stage B — Governed Homepage Metrics Fallback

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Branch base: `15301685c7d8dcb709c253b0759c770361840a54`
Status: implemented and verified for the existing Stage B feature branch and Draft PR #1. Production promotion remains out of scope without a separate explicit instruction.

## Problem and value

The homepage source exposed four zero placeholders and four unsupported `data-target` values (`5221`, `1514`, `100`, and `24`). JavaScript later animated them into public claims, although no evidence, calculation method, reviewer, or verification date has been supplied. The same homepage also displayed `24H 全年無休` and `24H Hotline` despite the service-hours input remaining unverified.

This P0 truthfulness batch removes those unsupported homepage claims while preserving the four-card layout and a future path for publishing verified metrics.

## Scope

1. `data/business-metrics.json` remains the single source of truth and now defines a non-numeric `fallback_label` plus the generated-block contract.
2. `scripts/render-business-metrics.mjs` deterministically renders the bounded homepage block and supports `--check` drift detection.
3. Unverified metrics render only their non-numeric fallback copy. They have no `.counter`, `data-target`, numeric placeholder, or animation.
4. A future `display_status=public` metric requires a finite value and complete source, calculation, evidence, reviewer, verification, and update fields before the renderer accepts it.
5. The homepage counter runtime only animates an authored numeric value when it exactly equals the governed `data-target`; it never manufactures a number from a fallback.
6. The homepage labels `24H 全年無休` and `24H Hotline` changed to evidence-safe service-time/contact wording. The other pages containing legacy 24H wording are outside this homepage-only batch.

Out of scope: proving or publishing any metric, changing the other 39 HTML files with 24H-related wording, schema rollout, priceRange rollout, images, URLs, tracking, PR updates, Preview, or Production.

## Verification

- `npm run seo:metrics -- --check`: generated block current.
- `npm run validate:governance`: four metrics, two known warnings, zero errors.
- `npm run test:seo-foundation`: generator drift check plus four negative governance gates passed.
- `npm run validate:site`: 135 HTML, zero warnings, zero errors.
- `npm run audit:measurement`: 135 HTML, zero warnings, zero errors; click paths still do not emit `generate_lead`.
- `git diff --check`: passed.
- Browser desktop `1440×900` and mobile `390×844`: four fallback cards, zero counters, zero `data-target`, no homepage 24H claim, no horizontal overflow, no console warning/error, and one H1.
- Browser visual review confirmed the desktop four-column and mobile two-column layouts. An initial `sr-only` assumption was caught because the committed Tailwind artifact lacked the new class; a local `metric-section-title` visually-hidden rule fixed it without rebuilding the global CSS artifact.
- Analytics runtime events were not exercised. Google Analytics requests were locally intercepted; this batch makes no new Browser-verified Analytics claim.
- Pre-write production observation at `2026-07-16T17:36:01+08:00`: live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`, with 7 match / 0 drift. The immutable baseline record was not changed.

## Known warnings and deferred work

1. At the time of this batch, 131 non-pilot HTML files still contained unsupported legacy `priceRange`. The subsequent service-page schema batch reduced the current remainder to 123.
2. Washinmura remains mutable/unversioned pending owner and privacy review.
3. Thirty-nine non-homepage HTML files still contain one or more legacy 24H-related strings. They require a separate inventory and evidence/wording decision; this batch does not bulk rewrite them.
4. All four metrics remain unverified and therefore publish no numeric values.

## Rollback

Restore the previous homepage metric block and counter script, remove `scripts/render-business-metrics.mjs`, remove the package script/check, restore metrics schema version 1, and restore the previous validator rules. No URL, sitemap, Analytics, external account, or Production rollback is required because none was changed or deployed.

Commit boundary: `fix(seo): replace unsupported homepage counters with governed fallbacks`.
