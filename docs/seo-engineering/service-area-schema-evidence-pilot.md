# Service-area schema evidence pilot

Date: 2026-07-18
Base: `main@42b99ac1a16908edbe744ff003b7c9607290b8d3`
Priority: P0 data-integrity follow-up

## Problem and business value

`data/business-entity.json` marks `serviceArea` as unverified, empty, and unpublished. A deterministic JSON-LD inventory of the current Production source nevertheless found 133 HTML files whose typed shared `https://www.carkey.com.tw/#business` node published `areaServed`.

This mismatch makes the evidence source advisory rather than enforceable and risks representing unsupported service coverage to search engines. The pilot reduces that risk without changing customer-facing copy, URLs, navigation, contact paths, page-specific service descriptions, or the existing location-page set.

## Scope

The pilot is limited to three established representative templates:

- `index.html`
- `car-key-lost-service.html`
- `article-bmw-smart-key-owner-guide.html`

Only `areaServed` on the typed shared business node is removed. On `car-key-lost-service.html`, the separate `Service.areaServed` property remains unchanged and is explicitly outside this pilot.

The business-entity source now records the immutable 133-file／133-node baseline, the three-page stage, and the expected 130-file／130-node remainder. Governance validation rejects count drift and any reintroduction on the three pilot pages.

Subsequent status: the separately documented service-page, brand／model, and four guide rollouts removed the same shared-business field from thirty additional templates. The registered guide scope is closed and the current governed site-wide remainder is 100 files／100 nodes; the 130 count above remains the immutable post-pilot observation, not the current backlog.

## Out of scope

- No visible service-area statement or location page is edited or removed.
- No URL, canonical, sitemap, robots, title, description, H1, CTA, Analytics, CSS, image, or navigation change.
- No claim is made that the remaining 130 shared-business nodes are approved.
- No legal name, brand canonicalization, address, opening hours, GBP, review, price, or fixed response-time data is added.
- No Washinmura keep／pin／remove decision is made.
- No commit, push, PR, Preview, or Production deployment is part of this working-tree batch.

## Verification

- `node --check` passes for both changed validators.
- Governance negative gates reject a missing service-area migration record.
- The schema comparator parses all 134 governed schema pages and compares their JSON-LD and complete HTML against `HEAD`.
- For the three pilot pages, the only accepted semantic difference is deletion of `areaServed` from the typed shared business node.
- The service-page comparator preserves its separate `Service.areaServed` node.
- Remaining unverified shared-business debt is reported as 130 files／130 nodes; it is a warning, not a completed rollout.

## Analytics verification level

- **Static verified:** the batch does not alter tracking source, CTA destinations, or event taxonomy; the measurement audit remains the applicable static check.
- **Browser verified:** not repeated because no interactive or Analytics behavior changes.
- **Not verified:** no Production CTA click or network payload test is claimed by this batch.

## Risk and rollback

Risk is limited to reducing structured-data coverage on three pages. Search engines do not require `areaServed` on a LocalBusiness node, and omitting an unverified optional property is safer than publishing an unsupported value.

Rollback is the exact inverse of the three registered JSON-LD deletions plus removal of the service-area migration record and validator rules. No URL or Production data migration is involved.

## Suggested commit boundary

`fix(seo): pilot evidence-gated business service areas`
