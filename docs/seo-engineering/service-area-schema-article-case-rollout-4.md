# Service-area schema article-case rollout 4

Date: 2026-07-19
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished. One central-Taiwan rescue article and four Honda／Hyundai／Infiniti case pages still attach regional coverage to the typed shared `#business` node. Page location copy and individual case locations do not prove business-wide coverage. Omitting that optional shared property reduces unsupported entity claims without altering visible evidence or contact paths.

This is P0 schema-integrity work. It continues the evidence-gated, reversible rollout and keeps every accumulated local page delta protected by an exact HEAD comparator.

## Scope

The `article-case-page-batch-4` stage contains:

1. `article-car-key-lost-rescue-central-taiwan.html`
2. `article-honda-hrv-2020-all-lost-changhua.html`
3. `article-honda-hrv-2022-akl-longjing.html`
4. `article-hyundai-tucson-hemei-akl.html`
5. `article-infiniti-fx35-shetou-rescue.html`

Only `areaServed` on the typed shared node with `@id=https://www.carkey.com.tw/#business` is removed. Source inspection found no page-specific `Service.areaServed` on these five pages.

The central-Taiwan article also contains an earlier standalone legacy `LocalBusiness` object without the governed shared `@id`. Its separate `areaServed` array remains byte-for-byte unchanged and is counted independently in HTTP verification. This batch does not claim that the legacy node is verified, compliant, or authorized for removal; it only prevents accidental conflation with the typed shared node.

The governance register changes the local candidate remainder from 72 files／72 nodes to 67 files／67 nodes. Since earlier local batches remain uncommitted against the same HEAD, the current HEAD-delta comparator intentionally contains all 33 local HTML deltas.

## Out of scope

- No standalone legacy LocalBusiness cleanup is authorized in this batch.
- No unregistered case, location, language, hub, or utility page is authorized.
- No visible copy, URL, canonical, sitemap, robots, title, description, H1, breadcrumb, FAQ, image, navigation, CTA, CSS, price, availability claim, or Analytics behavior changes.
- No page-specific location copy is removed, generalized, or promoted to business evidence.
- No service-area claim is verified by this deletion.
- No commit, push, PR, merge, Vercel change, or Production deployment.

## Verification contract

- The five HTML files may differ from `HEAD` only by their exact registered typed shared-business `areaServed` removal.
- The central-Taiwan article's separate legacy LocalBusiness `areaServed` must remain present once.
- The preceding twenty-eight local HTML deltas must retain the same exact-delta protection.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Governance must report 67 files／67 typed shared-business nodes remaining and reject reintroduction on every governed page.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and local HTTP smoke on these five pages must pass.

## Analytics verification level

- **Static verified:** the existing measurement audit must prove CTA click paths do not emit `generate_lead`.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior are not repeated because no interactive or Analytics code changes; no runtime claim is made.

## Verification results

- `npm run validate:schema-rollout -- --self-test --compare-head` passed: 134 schema pages, 0 errors; all 33 local HTML deltas are exact registered typed shared-business removals from the same HEAD.
- `npm run validate:governance` passed: 67 files／67 typed shared-business nodes remaining, 2 known warnings, 0 errors.
- `npm run test:seo-foundation` passed, including conversion runtime tests, inventory drift checks, governance negative gates, public deployment boundary checks, and schema self-tests.
- `npm run validate:site` passed: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement` passed: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- Local HTTP smoke passed on all five `.html` files: HTTP 200, one H1, parseable JSON-LD, one typed shared business node, zero typed shared-business `areaServed`, and no page-specific `Service.areaServed`. The central-Taiwan article retained exactly one non-shared legacy LocalBusiness node with `areaServed`; the other four pages retained none.
- `git diff --check` passed. The temporary preview was bound only to `127.0.0.1` and stopped after validation.

## Point-in-time Production baseline

Captured at `2026-07-19T17:49:56+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

All seven Production responses returned HTTP 200. Headers reported `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`, and `last-modified` between `Sun, 19 Jul 2026 02:33:22 GMT` and `02:33:26 GMT`. Content types were appropriate for HTML, robots, sitemap, and JavaScript. All corresponding remote-main raw files returned HTTP 200.

| Production path | HTTP | Production body SHA-256 | Remote-main result |
|---|---:|---|---|
| `/` | 200 | `480164c97664202491c9fedda58f2c503f0cc8d677cdeda6e41d04de1b98e1ee` | match |
| `/robots.txt` | 200 | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | 200 | `7ed526b576cf1eb29b44fbfeb35c87bcef05be5a4465d4242eb11b6725dc60e5` | match |
| `/car-key-lost-service` | 200 | `759ff137c2ef24b9598dfc08a10a64200c4d02f399fe90aea7e08255ff326b51` | match |
| `/article-bmw-smart-key-owner-guide` | 200 | `cd18cd05c9d3dab113e6d912ab72f687e0d6259d2ee54b8068d605f9ec5ec401` | match |
| `/article-audi-r8-neihu-all-keys-lost` | 200 | `1a9da3d58062e66dfbc3a0fc5146efa3b3e63346ec5e2c91942ebdcaf71ea4f9` | match |
| `/assets/js/procore-conversion-tracking.js` | 200 | `10969a911352e4a62903a93d249a932a0039f02a03371a6e7150c12a2534dd7b` | match |

Summary: 7 checked, 7 match, 0 drift. No Production mutation, click, deployment, or rewrite of an earlier baseline occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from five typed shared business nodes and registering the exact local delta. The central-Taiwan article still has separate legacy LocalBusiness debt, explicitly preserved and reported rather than hidden. Rollback is the exact inverse of the five JSON-LD deletions plus removal of this stage from the migration source, comparator, governance, and documentation. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): continue evidence-gated service areas on case pages`
