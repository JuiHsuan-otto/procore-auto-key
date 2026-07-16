# Stage B — Case-page Schema Pilot

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `150bb2d22a737140d5fd0044273add6eedeed9be`
Status: implemented and verified; approved for feature-branch commit/push and Vercel Preview delivery. Merge, main, and production promotion remain out of scope.

## Problem and value

The remaining case pages still inherit `priceRange: "$$"` even though CarKey uses case-by-case quotations and has no fixed, consistently applicable price tier. This P1 pilot removes only that unsupported schema property from three representative case pages. It avoids a misleading pricing signal without changing visible claims, URLs, metadata, links, CTA behavior, or case details.

## Scope

The exact pilot allowlist is:

1. `article-audi-r8-neihu-all-keys-lost.html` — Article, Breadcrumb, FAQ, and shared LocalBusiness graph; three primary internal inlinks.
2. `article-bmw-elv-red-lock-fix.html` — technical repair Article and shared LocalBusiness graph; two primary internal inlinks.
3. `case-shetou-mazda-cx30-rescue.html` — `case-*` template Article and shared LocalBusiness graph; four primary internal inlinks.

All three pages are indexable, have one H1, one typed shared business definition, and one legacy `priceRange`. The Audi page is also part of the production observation set. The implementation changes one schema line per page and registers an exact case-pilot stage in the existing data and validation gates.

Out of scope:

- The other 97 legacy files, including all location pages, hubs, contact, and language pages.
- Visible copy review, business claim approval, case evidence or photo-permission review.
- Price tables, fixed ranges, Product, Offer, Review, or AggregateRating schema.
- URL, sitemap, robots, canonical, Analytics, CTA, navigation, or image changes.
- Merge, main, production configuration, or production promotion.

## Verification contract

- The schema validator must parse all registered pages and find exactly one typed shared business node with no `priceRange`.
- JSON-LD comparison with `HEAD` must prove that the only semantic change on the three pilot pages is removal of `priceRange`.
- Full-HTML comparison with `HEAD` must prove that the only source change on those pages is the governed removal.
- Governance must enforce five ordered migration stages, 37 unique migrated files, and exactly 97 legacy files remaining.
- Full site, measurement, diff, desktop, and mobile checks must pass before this batch is proposed for commit.

## Verification results

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 37 registered schema pages, 0 errors; three negative gates passed.
- `npm run test:seo-foundation`: passed; deterministic inventory remains 135 pages; governance errors 0.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement`: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- `git diff --check`: passed.
- Legacy `priceRange` count: 100 before this pilot → 97 after this pilot; overall governed migration 134 → 97.

### Browser verification

The preferred `agent-browser` CLI was not installed, so the available Codex in-app browser was used as the documented fallback against a temporary server bound only to `127.0.0.1`.

- All three pages passed desktop checks with a requested 1440×900 viewport: HTTP content rendered, one H1, one typed shared business node, parseable JSON-LD, zero `priceRange`, meaningful body content, no horizontal overflow, no framework error overlay, and no console warning/error.
- All three pages passed mobile checks with a requested 390×844 viewport; the effective document client width was 375 pixels and each page's `scrollWidth` was also 375 pixels.
- Representative desktop and mobile screenshots of the `case-*` template were inspected with no visible regression.
- No phone or LINE CTA was clicked. Browser navigation may create controlled localhost `page_view` traffic identifiable by `page_location`; exclude it from business reporting.

### Analytics verification level

- **Static verified:** required before delivery; phone and LINE click paths must not emit `generate_lead`.
- **Browser verified:** not planned because CTA and tracking code are unchanged and no CTA will be clicked.
- **Not verified:** no runtime event-name, count, parameter, or network-payload claim will be made.

## Production observation

Pre-write point-in-time observation: `2026-07-16T20:53:29+08:00`; live remote `main` was `15301685c7d8dcb709c253b0759c770361840a54`, and all seven targets returned HTTP 200 with 7 match / 0 drift. This observation is not a permanent test truth and was not rewritten.

Final post-write point-in-time observation: `2026-07-16T21:19:30+08:00`; live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`. All seven targets returned HTTP 200 and their production body SHA-256 values matched the remote-main files: 7 match / 0 drift. The immutable baseline was not rewritten. A later production change must be reported as drift and must not cause this record or test expectation to be rewritten.

## Risk and rollback

- Primary risk: accidentally changing schema or visible content beyond the unsupported property. Semantic and full-file HEAD comparison are hard gates.
- Secondary risk: treating this pilot as evidence that all remaining case or location pages are content-quality approved. It is not; this batch validates only schema-field removal.
- Before merge, rollback by reverting the case-pilot commit on the feature branch or closing the Draft PR and removing its Preview.
- After a future merge, revert only the case-pilot commit. Production rollback does not apply without a separately approved promotion.

## Proposed commit boundary

`fix(seo): pilot unsupported priceRange removal on case pages`
