# Service-area schema brand／model rollout

Date: 2026-07-19
Base: `main@42b99ac1a16908edbe744ff003b7c9607290b8d3`
Depends on: `service-area-schema-evidence-pilot.md`, `service-area-schema-service-rollout.md`

## Outcome

The evidence-gated shared-business rule was extended to the three registered brand／model pages:

- `bmw-smart-key-service.html`
- `toyota-altis-car-key.html`
- `vw-car-key-service.html`

Only `areaServed` on the typed shared `https://www.carkey.com.tw/#business` node was removed. The separate `Service.areaServed` properties on the BMW and VW pages remain unchanged. The Altis page did not have a separate `Service.areaServed` property, so its only `areaServed` occurrence was the governed shared-business field. The controlled remainder moves from 122 files／122 nodes to 119 files／119 nodes.

Subsequent status: the separately documented four guide rollouts close the registered guide scope and move the current governed remainder to 100 files／100 nodes. The 119 count above remains the immutable post-brand／model observation.

## Business value

The business-entity source classifies `serviceArea` as unverified, empty, and unpublished. Removing that property from the shared business identity avoids presenting unsupported business-wide coverage to search engines while preserving page-specific service descriptions and all customer-visible content.

## Scope and exclusions

- No visible service-area copy, title, description, canonical, URL, CTA, navigation, FAQ, image, or styling changes.
- No change to BMW or VW page-specific `Service.areaServed`.
- No assertion that the current remaining 100 shared-business nodes are approved.
- No Analytics or conversion behavior change.
- No Washinmura keep／pin／remove decision.
- No commit, push, PR, Preview, or Production deployment.

## Verification

- Both validators pass `node --check`.
- Governance negative gates enforce the registered three-stage migration and exact 119-file／119-node remainder.
- The schema comparator parses all governed JSON-LD and compares complete HTML against `HEAD`.
- BMW and VW must retain their separate `Service.areaServed`; the comparator rejects any semantic difference beyond the registered shared-business deletion.
- Altis must remove exactly one registered occurrence; BMW and VW each start with two identical coverage occurrences and remove only the first business occurrence.
- Full site, SEO foundation, schema rollout, and measurement gates are run before handoff.

## Analytics verification level

- **Static verified:** tracking source, CTA destinations, and event taxonomy are unchanged; the repository measurement audit is the applicable static check.
- **Browser verified:** not repeated because this batch has no interactive or Analytics behavior change.
- **Not verified:** no Production CTA click or network-payload test is claimed.

## Point-in-time Production baseline

Captured at `2026-07-19T02:02:53+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `42b99ac1a16908edbe744ff003b7c9607290b8d3`. This is an immutable observation record, not a permanent test truth: later Production changes must be reported as drift and must not rewrite this observation or its expected values.

All seven Production responses reported `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`, and `last-modified` between `Fri, 17 Jul 2026 15:49:52 GMT` and `15:49:55 GMT`. HTML returned `content-type: text/html; charset=utf-8`; robots returned `text/plain; charset=utf-8`; sitemap returned `application/xml`; the tracking asset returned `application/javascript; charset=utf-8`. The corresponding remote-main raw files also returned HTTP 200.

| Production path | HTTP | Production body SHA-256 | Remote-main result |
| --- | ---: | --- | --- |
| `/` | 200 | `5be557c0b1a000257fe367a6018d641f4b15376d0facfe51861f3a382f0539f0` | match |
| `/robots.txt` | 200 | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | 200 | `7ed526b576cf1eb29b44fbfeb35c87bcef05be5a4465d4242eb11b6725dc60e5` | match |
| `/car-key-lost-service` | 200 | `f2cb4545bf22fb01628ae56fb2d60408bdba0eb67d70358c81bafbdaab9b8b75` | match |
| `/article-bmw-smart-key-owner-guide` | 200 | `3a9474cca91a4f77529af215998211b6e11fcc70ce0a9b05c5297af219046bbd` | match |
| `/article-audi-r8-neihu-all-keys-lost` | 200 | `1a9da3d58062e66dfbc3a0fc5146efa3b3e63346ec5e2c91942ebdcaf71ea4f9` | match |
| `/assets/js/procore-conversion-tracking.js` | 200 | `10969a911352e4a62903a93d249a932a0039f02a03371a6e7150c12a2534dd7b` | match |

Summary: 7 checked, 7 match, 0 drift. No Production mutation, click, deployment, or baseline refresh occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from three shared business nodes. Rollback restores the exact three properties and the corresponding migration, comparator, and governance records. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): enforce evidence-gated business service areas`
