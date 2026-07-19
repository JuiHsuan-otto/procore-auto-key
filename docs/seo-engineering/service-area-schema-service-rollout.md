# Service-area schema service-page rollout

Date: 2026-07-19
Base: `main@42b99ac1a16908edbe744ff003b7c9607290b8d3`
Depends on: `service-area-schema-evidence-pilot.md`

## Outcome

After the three-page pilot passed its semantic and complete-HTML guards, the same evidence rule was applied to the eight remaining registered service-page templates:

- `all-keys-lost-service.html`
- `car-key-duplication-service.html`
- `car-key-shell-replacement-service.html`
- `chip-key-copy-by-mail-service.html`
- `key-not-detected-service.html`
- `non-chip-car-key-duplication-service.html`
- `smart-key-lost-service.html`
- `spare-car-key-service.html`

Each page removes only `areaServed` from the typed shared `https://www.carkey.com.tw/#business` node. Each page's separate `Service.areaServed` property remains unchanged. Governed shared-business debt moves from 130 files／130 nodes after the pilot to 122 files／122 nodes after this batch.

Subsequent status: the separately documented brand／model and four guide rollouts move the current governed remainder to 100 files／100 nodes and close the registered guide scope. The 122 count above remains the immutable post-service-page observation.

## Business value

Search engines should not receive business-wide coverage claims that the source of truth explicitly classifies as unverified and unpublished. Keeping the page-specific `Service` node unchanged preserves the existing page description while separating it from the broader business-identity claim.

## Out of scope

- No visible service coverage, location page, title, description, canonical, URL, CTA, navigation, image, FAQ, or service copy changes.
- No change to page-specific `Service.areaServed`.
- No claim that the current remaining 100 shared-business nodes are approved or resolved.
- No Analytics or conversion behavior change.
- No Washinmura decision.
- No commit, push, PR, Preview, or Production deployment.

## Verification

- Both validators pass `node --check`.
- Governance self-tests pass and enforce the two registered service-area stages.
- The 134-page schema comparator parses every JSON-LD block and compares complete HTML against `HEAD`.
- All eleven governed pages reject reintroduction of shared-business `areaServed`.
- For service pages with two identical coverage arrays, the comparator removes exactly the first business-node occurrence and preserves the second `Service` occurrence.
- The post-service-page remainder is 122 files／122 nodes; the later brand／model and four guide rollouts are governed separately and bring the current remainder to 100 files／100 nodes.
- Full site and measurement gates are run before handoff.

## Analytics verification level

- **Static verified:** CTA destinations and the tracking source are unchanged; the repository measurement audit is the applicable check.
- **Browser verified:** not repeated because this batch has no interactive or Analytics change.
- **Not verified:** no Production CTA click or network payload test is claimed.

## Risk and rollback

Risk is limited to reducing an optional structured-data field on eight pages. Rollback restores the exact eight shared-business properties and the matching migration/gate records. It does not require a URL, content, database, or Production data migration.

## Suggested commit boundary

`fix(seo): enforce evidence-gated business service areas`
