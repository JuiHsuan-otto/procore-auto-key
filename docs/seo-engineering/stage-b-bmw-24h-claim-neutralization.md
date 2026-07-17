# Stage B: BMW availability-claim neutralization

Status: implemented locally; not committed, pushed, published, or deployed.

## Problem and evidence

Human input H07 has no staffing or on-call evidence supporting public `24H`, `24小時`, `全年無休`, or `全天候` claims. A deterministic pre-change inventory at feature-branch HEAD `f9ef3d46e3d547f5dfcff7137c6a32615d024fda` found 39 HTML files and 60 exact claim occurrences.

This batch removes only nine occurrences from six BMW case pages:

- `article-bmw-118-beitun-akl.html`
- `article-bmw-220i-2015-yunlin-akl.html`
- `article-bmw-740-yuanli-akl.html`
- `article-bmw-elv-red-lock-fix.html`
- `article-bmw-gseries-keyless-rescue.html`
- `article-bmw-x5-battery-fix.html`

The replacement copy names a phone contact or rescue consultation without promising hours, response time, or geographic availability. Existing informational references to night-time or emergency scenarios remain out of scope.

## Controlled remainder

- Baseline: 39 files / 60 occurrences.
- Removed in this batch: 6 files / 9 occurrences.
- Expected remainder: 33 files / 51 occurrences.
- `openingHours` remains `value: null`, `status: unverified`, and `publish: false`.
- No schema hours, address, service area, price, response-time, or business identity fact was added.

The remainder is a recorded migration backlog, not an accepted business claim. Any later batch needs its own page-type scope and review; verified H07 evidence would instead require an owner-approved operating-hours decision.

## Validation and rollback

Repository validators enforce both the exact remainder and zero matching claims in this six-page cohort. Completed checks:

- `node scripts/validate-schema-image-pilot.mjs --compare-head --self-test`: 49 schema pages, 0 errors.
- `npm run test:seo-foundation`: passed; governance reported 33 files / 51 remaining occurrences, 3 known warnings, 0 errors.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement`: 135 HTML files, 0 warnings, 0 errors; click paths do not emit `generate_lead`.
- `git diff --check`: passed.
- Browser, six pages at mobile and desktop viewport: one H1 each, zero target claims, zero horizontal overflow, and zero console warnings/errors.

Analytics classification is **Static verified**. Browser layout was verified, but this batch did not click phone or LINE CTAs; browser event and network payload verification is therefore **Not verified**.

## Final production observation

This is a new point-in-time observation, not an update to the immutable baseline:

- Captured: `2026-07-16T23:57:30+08:00` (Asia/Taipei).
- Live remote `main`: `15301685c7d8dcb709c253b0759c770361840a54`.
- Result: 7 checked / 7 match / 0 drift.
- Common production headers: `cache-control: public, max-age=0, must-revalidate`; `server: Vercel`; all responses were HTTP 200 and `x-vercel-cache: HIT`.

| Path | Content-Type | Content-Length | ETag | Last-Modified | X-Vercel-ID | Production body SHA-256 | Remote body SHA-256 | Result |
|---|---|---:|---|---|---|---|---|---|
| `/` | `text/html; charset=utf-8` | not sent | `W/"7cb29ecd687800e67e61ce0da5e2d0d8"` | `Mon, 13 Jul 2026 00:46:01 GMT` | `hkg1::d2hdr-1784217450969-2f1aedc459f3` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | same | match |
| `/robots.txt` | `text/plain; charset=utf-8` | `255` | `"e9691db856777cb142289fba85913a2a"` | `Thu, 16 Jul 2026 09:36:02 GMT` | `hkg1::9mkbh-1784217451311-e3d3c036fa96` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | same | match |
| `/sitemap.xml` | `application/xml` | not sent | `W/"111fe7a1153ff9c94534fb35284b473c"` | `Thu, 16 Jul 2026 12:53:30 GMT` | `hkg1::59tlg-1784217451612-da52fac6f232` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | same | match |
| `/car-key-lost-service` | `text/html; charset=utf-8` | not sent | `W/"e6e4da663a13d22b86f9b7acc38ac1f0"` | `Wed, 15 Jul 2026 16:58:13 GMT` | `hkg1::tkfc6-1784217452101-4d02b911daa1` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | same | match |
| `/article-bmw-smart-key-owner-guide` | `text/html; charset=utf-8` | not sent | `W/"84b86e53aa6ddf9f3e58149ede58fe6a"` | `Wed, 15 Jul 2026 03:05:36 GMT` | `hkg1::59tlg-1784217452514-67e0720c516e` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | same | match |
| `/article-audi-r8-neihu-all-keys-lost` | `text/html; charset=utf-8` | not sent | `W/"f566345faf5e75320a73ea2c27a566c0"` | `Wed, 15 Jul 2026 16:21:33 GMT` | `hkg1::26tcx-1784217452821-738e1706fe53` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | same | match |
| `/assets/js/procore-conversion-tracking.js` | `application/javascript; charset=utf-8` | not sent | `W/"814dc9cc755fbc0b5896292d0baeb2c9"` | `Mon, 13 Jul 2026 00:08:21 GMT` | `hkg1::26tcx-1784217453233-832a17098bdd` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | same | match |

The remote comparison for every row returned HTTP 200 and the listed production hash matched the file at that exact live remote-main SHA. If production later changes, the result must be reported as drift; neither this observation nor the saved baseline may be rewritten to make a test pass.

Rollback is the inverse of the nine exact text replacements plus removal of this migration record and its validator rules. It must not be performed merely to restore an unsupported public promise.

Suggested future commit boundary: `fix(content): remove unverified 24H claims from BMW pages`.
