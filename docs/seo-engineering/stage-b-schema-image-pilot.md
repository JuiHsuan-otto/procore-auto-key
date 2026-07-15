# Stage B — Schema and Image Safety Pilot

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Branch base / HEAD: `15301685c7d8dcb709c253b0759c770361840a54`
Status: implemented and verified locally; feature-branch commit/push, draft PR, and Preview deployment were subsequently authorized. Production promotion remains out of scope without a separate explicit instruction.

## Problem and value

The 135-page static site inherited an unsupported `priceRange: "$$"` placeholder. Publishing that value implies price evidence that has not been supplied. The homepage also creates four local case images at runtime without intrinsic dimensions, so source-only image scans cannot protect their layout allocation.

This P1 pilot reduces unsupported schema claims and adds a maintainable image-dimension gate without changing URLs, visible business copy, service claims, counters, Analytics, or the other 132 HTML pages.

## Scope

Public HTML pilot:

1. `index.html` — homepage
2. `car-key-lost-service.html` — service page
3. `article-bmw-smart-key-owner-guide.html` — guide page

Changes:

- Removed only the `priceRange` property from each page's shared business JSON-LD node.
- Added actual fallback-file dimensions to the homepage's four runtime case records and emitted them as escaped `width` / `height` attributes.
- Added `scripts/validate-schema-image-pilot.mjs` to parse all pilot JSON-LD, enforce the governed `priceRange` state, compare JSON-LD semantics with `HEAD`, and verify local static/runtime image dimensions against Sharp metadata.
- Recorded the 134-file baseline, exact three-file pilot, and expected 131-file remainder in `data/business-entity.json`.
- Integrated the pilot validator and negative gates into `test:seo-foundation`.

Out of scope:

- No bulk migration of the remaining 131 pages.
- No brand, legal name, address, service-area, opening-hours, price, review, warranty, technician, or credential claims.
- No URL, sitemap, robots, CSS artifact, counter, AEO script, Analytics, CTA, or deployment changes.
- The cross-domain LINE SVG and runtime template itself are not assigned guessed intrinsic dimensions; only repository-resolvable image records are governed.

## Evidence and verification

### Repository validation

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`
  - 3 pilot pages
  - all JSON-LD parseable
  - 0 `priceRange` occurrences on pilot pages
  - JSON-LD semantic diff versus `HEAD`: removal of `priceRange` only
  - 2 static local images verified against file metadata
  - 4 runtime homepage case images verified against file metadata
  - 1 external image skipped and 1 dynamic template classified explicitly
  - 3 negative-gate checks passed
- `npm run test:seo-foundation`: passed; 135-page deterministic inventory check passed; governance errors 0.
- `npm run validate:site`: 135 HTML files, warnings 0, errors 0.
- `npm run audit:measurement`: 135 pages, warnings 0, errors 0; Static CTA taxonomy verified.
- `git diff --check`: passed.
- Changed public HTML allowlist: exactly the three pilot files.
- Legacy `priceRange` count: 134 baseline → 131 after pilot.
- Final point-in-time production comparison at `2026-07-16T01:42:04+08:00`: live remote `main` remained `15301685c7d8dcb709c253b0759c770361840a54`; 7 representative targets matched remote files and drift was 0. The immutable `00:58:11` baseline record was not rewritten.

### Browser verification

Local loopback and production comparison used the same desktop viewport:

- Homepage: one H1, zero `priceRange`, no horizontal overflow; four lazy case images loaded successfully. Declared intrinsic dimensions matched repository fallback files, while rendered cards remained 284×284, matching production.
- Service page: one H1, one parseable JSON-LD block, zero `priceRange`, no horizontal overflow.
- Guide page: one H1, three parseable JSON-LD blocks, zero `priceRange`, local picture loaded, no horizontal overflow.
- Browser console warnings/errors on all three local pages: none.
- The simple Python preview does not implement Vercel clean-URL rewrites. An initial `/car-key-lost-service` request returned the expected local-server 404; the mapped `.html` file returned 200 and passed. This is a preview-server limitation, not a production route regression.

Browser verification opened loopback pages and the production homepage for visual comparison. No phone/LINE CTA was clicked and no form/message/call was initiated. These navigations may create `page_view` traffic distinguishable by `page_location`; exclude loopback traffic from business reporting.

### Analytics verification level

- **Static verified:** `audit:measurement` proves ordinary phone/LINE click code paths do not emit `generate_lead`.
- **Browser verified:** not repeated for Analytics in this pilot because no CTA was clicked. The separate foundation-batch browser/network evidence remains the applicable prior observation.
- **Not verified in this pilot:** no new runtime Analytics event or payload claim is made.

## Known warnings

1. 131 non-pilot HTML files still contain legacy `priceRange`; rollout requires a separately approved batch.
2. Four homepage counters remain unverified and unchanged.
3. Washinmura remains mutable/unversioned pending owner and privacy review.
4. The external LINE SVG is outside repository image-metadata control.

## Risks and rollback

- Search engines may temporarily observe different business-node fields between the three pilot pages and the remaining pages. The pilot is deliberately limited so the result can be reviewed before rollout.
- Intrinsic dimensions use the checked-in fallback image dimensions. Existing WebP alternatives preserve the same aspect ratios and browser rendering was compared with production.
- Rollback: before merge, close the draft PR and remove the feature branch/Preview deployment; after merge, revert the Stage B release commit. No production rollback is needed unless a later, separately authorized production promotion occurs.

## Delivery boundary

The pilot originally proposed two reviewable boundaries:

1. `fix(seo): remove unsupported priceRange in three-page pilot`
2. `perf(html): govern homepage runtime image dimensions`

Do not combine a 131-page rollout with either boundary.

For the authorized Stage B delivery, foundation, governance, and pilot changes may use one cohesive release commit because `package.json`, governance data, and validators are cross-dependent. The remaining 131-page rollout is still excluded.
