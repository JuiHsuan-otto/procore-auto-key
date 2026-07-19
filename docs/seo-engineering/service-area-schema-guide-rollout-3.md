# Service-area schema guide rollout 3

Date: 2026-07-19
Base: `main@42b99ac1a16908edbe744ff003b7c9607290b8d3`
Depends on: the five earlier service-area evidence rollout records

## Outcome

The evidence-gated shared-business rule was extended to five owner-decision guides:

- `article-smart-key-troubleshooting.html`
- `article-used-car-buying-guide.html`
- `article-used-car-key-checklist.html`
- `article-used-car-security-guide.html`
- `article-why-you-need-spare-car-key.html`

Each page had exactly one typed shared `https://www.carkey.com.tw/#business` node with `areaServed` and no separate `Service.areaServed` node. Only that unsupported shared-business property was removed. The controlled remainder moves from 109 files／109 nodes to 104 files／104 nodes.

Subsequent status: the separately documented fourth guide rollout closes the registered guide scope and moves the current governed remainder to 100 files／100 nodes. The 104 count above remains the immutable post-third-guide observation.

## Business value

These pages help owners decide how to respond to smart-key problems, assess keys during a used-car purchase, and plan a spare key. Their shared business identity should not publish service coverage that the governed business source marks unverified and unpublished. Omitting the optional property improves entity-data integrity without changing the guides' content or conversion paths.

## Scope and exclusions

- No visible copy, title, description, canonical, URL, CTA, navigation, FAQ, image, or CSS changes.
- No Service node existed on these five pages, so no page-specific `Service.areaServed` was changed.
- Remaining US-market／VAG guides, case, location, language, and utility pages are outside this batch.
- No claim is made that the current remaining 100 shared-business nodes are approved.
- No Analytics behavior or conversion taxonomy change.
- No Washinmura keep／pin／remove decision.
- No commit, push, PR, Preview, or Production deployment.

## Verification

- Both validators pass `node --check`.
- Governance gates enforce six ordered stages and the exact 104-file／104-node remainder.
- The schema comparator parses all 134 governed schema pages and compares semantic JSON-LD plus complete HTML against `HEAD`.
- Each guide must remove exactly one registered source fragment; any other semantic or HTML difference fails.
- Full SEO foundation, site, schema, measurement, and diff gates are run before handoff.
- All five pages receive a local HTTP smoke test before handoff.

## Analytics verification level

- **Static verified:** the repository audit proves this batch does not change tracking source, CTA destinations, or click-event taxonomy.
- **Browser verified:** not repeated because no interactive or Analytics behavior changes.
- **Not verified:** no Production CTA click or network-payload test is claimed.

## Point-in-time Production baseline

Captured at `2026-07-19T09:57:54+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `42b99ac1a16908edbe744ff003b7c9607290b8d3`. This observation is immutable evidence, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

All seven Production responses reported `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`, and `last-modified` between `Fri, 17 Jul 2026 15:49:52 GMT` and `15:49:55 GMT`. Content types were `text/html; charset=utf-8` for HTML, `text/plain; charset=utf-8` for robots, `application/xml` for sitemap, and `application/javascript; charset=utf-8` for the tracking asset. All corresponding remote-main raw files returned HTTP 200.

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

Risk is limited to omitting an optional structured-data property from five shared business nodes. Rollback restores the exact five properties and the corresponding data, comparator, governance, and documentation records. No URL, visible content, database, or Production migration is involved.

## Suggested commit boundary

`fix(seo): enforce evidence-gated business service areas`
