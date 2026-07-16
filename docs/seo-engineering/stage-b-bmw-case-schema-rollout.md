# Stage B — BMW Case-page Schema Rollout

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `f9ef3d46e3d547f5dfcff7137c6a32615d024fda`
Status: implemented locally; commit, push, PR update, Preview, merge, main, and production promotion remain out of scope until separately approved.

## Problem and value

Twelve remaining BMW case pages still inherited `priceRange: "$$"` even though CarKey uses case-by-case quotations. The prior three-page case pilot validated both multiline case JSON-LD and the `case-*` template. This P1 brand-bounded rollout extends only the unsupported-property removal to the remaining BMW case inventory, avoiding a misleading price-tier signal while preserving visible case content and URLs.

## Scope

The exact allowlist is registered in `data/business-entity.json` and enforced by both schema and governance validators. It contains twelve indexable BMW case pages spanning all-keys-lost, auction, keyless, rescue, and battery-related cases.

Pre-write inventory confirmed:

- every page is classified as `case`;
- every page has one legacy `priceRange` and one typed shared business definition;
- JSON-LD uses only the already-supported compact or multiline legacy formats;
- primary internal inlinks range from 2 to 6;
- Article, Breadcrumb, FAQ, and Service relationships otherwise remain unchanged.

Out of scope:

- The BMW owner guide, BMW service/brand page, and BMW ELV pilot page, which were already migrated in earlier stages.
- The other 85 legacy files, including non-BMW cases, location pages, hubs, contact, and language pages.
- Visible case-claim review, photo permissions, author/technician identity, address, hours, reviews, warranty, or fixed prices.
- URL, sitemap, robots, canonical, copy, navigation, CTA, Analytics, image, or CSS changes.
- Commit, push, PR metadata, Preview, merge, main, or production changes.

## Verification contract

- Each allowlisted page must differ from `HEAD` only by removal of `priceRange` in JSON-LD and source HTML.
- All registered schema pages must contain exactly one typed shared business definition and no `priceRange`.
- Governance must enforce six ordered stages, 49 unique migrated files, and exactly 85 legacy files remaining.
- SEO foundation, 135-page site validation, measurement audit, and diff checks must pass.
- All twelve pages require desktop browser checks; representative compact, multiline, FAQ, Service, and multi-image pages require mobile checks.

## Verification results

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 49 registered schema pages, 0 errors; three negative gates passed.
- Full-HTML and JSON-LD comparison with `HEAD` proves that the twelve BMW pages differ only by the registered `priceRange` removal, except for the separately allowlisted four-page CTA fix documented in `stage-b-bmw-mobile-cta-overflow.md`.
- `npm run test:seo-foundation`: passed; deterministic inventory remains 135 pages; governance errors 0.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement`: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- `git diff --check`: passed.
- Legacy `priceRange` count: 97 before this rollout → 85 after this rollout; overall governed migration 134 → 85.

### Browser verification

- All twelve pages passed requested 1440×900 checks: one H1, one typed shared business node, parseable JSON-LD, zero `priceRange`, meaningful content, no horizontal overflow, no framework overlay, and no console warning/error.
- Five representative pages covered compact, multiline, FAQ, Service, and multi-image variants at requested 390×844.
- Initial mobile verification found pre-existing CTA overflow on the BMW 118 Beitun and BMW X3 Linkou templates (`scrollWidth 424 / clientWidth 375`). Source comparison confirmed the same pattern in `HEAD`; two additional BMW pages shared it. The independent four-page UI fix then reduced all four pages to `scrollWidth 375 / clientWidth 375` and is documented separately.
- No CTA was clicked. Browser navigation may create controlled localhost `page_view` traffic identifiable by `page_location`; exclude it from business reporting.

### Analytics verification level

- **Static verified:** required before delivery; phone and LINE click paths must not emit `generate_lead`.
- **Browser verified:** not planned because CTA and tracking code are unchanged and no CTA will be clicked.
- **Not verified:** no runtime event-name, count, parameter, or network-payload claim will be made.

## Production observation

Pre-write point-in-time reference: `2026-07-16T23:10:36+08:00`; live remote `main` was `15301685c7d8dcb709c253b0759c770361840a54`, and all seven targets returned HTTP 200 with 7 match / 0 drift. The immutable baseline was not rewritten.

Final post-write point-in-time observation: `2026-07-16T23:35:18+08:00`; live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`. All seven targets returned HTTP 200 and production body SHA-256 values matched the remote-main files: 7 match / 0 drift. The immutable baseline was not rewritten. A later production change must be reported as drift and must not cause this observation or test expectation to be rewritten.

## Risk and rollback

- Primary risk: touching visible case content or unrelated JSON-LD while editing compact one-line payloads. Semantic and full-HTML comparison with `HEAD` are hard gates.
- Secondary risk: treating schema cleanup as approval of the underlying case claims. This batch does not approve or rewrite those claims.
- Before commit, rollback by restoring the twelve HTML files plus the data, validators, governance, and batch document from `HEAD`.
- After a future commit, revert only the proposed BMW case rollout commit. Production rollback does not apply without a separately approved promotion.

## Proposed commit boundary

`fix(seo): remove unsupported priceRange from BMW case pages`
