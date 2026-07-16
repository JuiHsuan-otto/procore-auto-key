# Stage B — Service-page Schema Rollout

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `5b9a7118f5a849be9b633ea46fe2d05eb3da5f8b`
Status: implemented and verified; approved for feature-branch commit/push and Vercel Preview delivery. Merge, main, and production promotion remain out of scope.

## Problem and value

Eight remaining service pages inherited `priceRange: "$$"` in their business JSON-LD even though no governed pricing evidence has been supplied. Removing that unsupported field avoids publishing an implied price tier while preserving the useful, evidence-backed parts of each schema graph.

This is a P1, page-type-bounded rollout. It changes no URL, visible copy, service claim, CTA, Analytics behavior, sitemap entry, robots directive, or production asset.

## Scope

The exact public HTML allowlist is:

1. `all-keys-lost-service.html`
2. `car-key-duplication-service.html`
3. `car-key-shell-replacement-service.html`
4. `chip-key-copy-by-mail-service.html`
5. `key-not-detected-service.html`
6. `non-chip-car-key-duplication-service.html`
7. `smart-key-lost-service.html`
8. `spare-car-key-service.html`

Implementation and governance changes:

- Removed only the `priceRange` property from the eight allowlisted pages.
- Recorded the completed three-page pilot and this eight-page service stage in `data/business-entity.json`.
- Extended `scripts/validate-schema-image-pilot.mjs` to validate all 11 migrated schema pages while retaining image checks only for the original three-page pilot.
- Added both semantic JSON-LD comparison and full-HTML byte comparison against `HEAD`; the latter permits only the two known `priceRange` formatting variants.
- Extended `scripts/validate-seo-governance.mjs` to enforce exact stage order, scope, uniqueness, and the 123-file remainder.
- Added `validate:schema-rollout` while retaining `validate:seo-pilot` as a compatibility alias.

Out of scope:

- The remaining 123 HTML files were not rewritten.
- No price, legal identity, address, hours, review, warranty, technician, credential, or service-volume data was created.
- No CTA was clicked and no Analytics runtime payload claim is made by this batch.
- No merge, main update, production promotion, or production content change is part of this batch.

## Verification

### Static and schema verification

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 11 schema pages, 3 image-pilot pages, errors 0, three negative gates passed.
- Exact full-file comparison with `HEAD` confirms that each of the eight public HTML files differs only by removal of `priceRange`.
- `npm run test:seo-foundation`: passed; inventory remains 135 pages; governance errors 0.
- `npm run validate:site`: 135 HTML files, warnings 0, errors 0.
- `npm run audit:measurement`: 135 pages, warnings 0, errors 0.
- `git diff --check`: passed.
- Legacy `priceRange` count: 131 before this batch → 123 after this batch; overall governed migration is 134 → 123.

### Browser verification

All eight local service files were opened in headless Chrome at 1440×900. Each returned HTTP 200 and had:

- exactly one H1;
- exactly one typed business definition using `https://www.carkey.com.tw/#business`;
- zero `priceRange` properties across all parsed JSON-LD objects;
- meaningful body content and no horizontal overflow;
- no console warning/error and no page error.

Representative mobile checks at 390×844 passed for `all-keys-lost-service.html` and `chip-key-copy-by-mail-service.html`, with no horizontal overflow or console/page error. Desktop and mobile screenshots were inspected and showed no visible regression.

The first browser assertion counted schema references to the shared business `@id` as duplicate definitions. Page results were otherwise clean. The assertion was corrected to count only typed entity definitions, after which all eight pages passed. This was a test-harness false positive, not a page defect.

### Analytics verification level

- **Static verified:** `audit:measurement` confirms that phone/LINE click code paths do not emit `generate_lead`.
- **Browser verified:** not exercised in this batch because no CTA was clicked and tracking code was unchanged.
- **Not verified:** no new runtime event-name, event-count, or network-payload claim is made.

### Production drift observation

- Pre-write observation: `2026-07-16T18:04:49+08:00`, live remote `main` `15301685c7d8dcb709c253b0759c770361840a54`, 7 match / 0 drift.
- Final observation: `2026-07-16T18:13:54+08:00`, the same live remote `main`, 7 match / 0 drift; all targets returned HTTP 200 and production body SHA-256 values matched their remote-main files.
- The immutable `2026-07-16T00:58:11+08:00` baseline record was not rewritten. These are point-in-time observations only.

## Known warnings

1. 123 HTML files still contain legacy `priceRange`; they require separately approved page-type batches.
2. Washinmura remains mutable/unversioned pending owner and privacy review.
3. Non-home `24H` claims remain outside this batch and require evidence/content review.
4. Governed homepage metrics remain non-numeric until source evidence is supplied.

## Risks and rollback

- Risk is limited to schema-field consistency across migrated and unmigrated page types. Search-visible copy and routes are unchanged.
- Before merge, rollback by reverting this batch commit on the feature branch or closing the Draft PR. No production rollback applies because production promotion is not authorized.
- After a future merge, revert the batch commit. Production promotion and its rollback require a later, separately authorized release decision.

## Commit boundary

One cohesive commit:

`fix(seo): remove unsupported priceRange from service pages`

This boundary includes the eight HTML removals, staged source-of-truth data, validators, package alias, and documentation. Do not combine the remaining 123-page rollout with it.

Subsequent status: the business owner confirmed a case-by-case quotation model, so `priceRange` is now governed as `omit`, not as a pending required price tier. The separately bounded three-page brand/model batch is documented in `stage-b-brand-model-pricing-policy.md`; the current legacy remainder is 120.
