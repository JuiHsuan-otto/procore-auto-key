# Stage B: general rescue-copy availability-claim neutralization

Status: implemented and verified locally; not committed, pushed, published, or deployed.

## Problem, priority, and scope

Human input H07 still lacks staffing or on-call evidence supporting public `24H`, `24小時`, `全年無休`, or `全天候` promises. This P0 batch removes five remaining general-purpose time claims from visible headings, phone CTAs, and one WebPage structured-data name:

- `case-hyundai-venue-smartkey-lost.html`
- `case-shetou-mazda-cx30-rescue.html`
- `article-lost-key-comparison.html`
- `article-car-key-lost-rescue-central-taiwan.html`
- `cases.html`

The underlying rescue/service meaning remains. Phone and LINE destinations, case facts, URLs, prices, layout classes, and unrelated schema fields remain unchanged. In `cases.html`, only the WebPage `name` loses `全台 24H`; its headline and description are unchanged.

## Controlled migration

- Original baseline: 39 files / 60 occurrences.
- Prior six stages: removed 28 files / 46 occurrences.
- This general rescue-copy batch: removed 5 files / 5 occurrences.
- Expected remainder: 6 files / 9 occurrences.
- `openingHours` remains null, unverified, and unpublished.

The governance validator records this as the seventh migration stage. Every file has one exact before/after pair in the HEAD comparator, including the complete JSON string for `cases.html`.

## Pre-write production baseline

This is a point-in-time observation, not a permanent test truth:

- Captured: `2026-07-17T01:20:05+08:00` (Asia/Taipei).
- Live remote `main`: `15301685c7d8dcb709c253b0759c770361840a54`.
- Result: 7 checked / 7 match / 0 drift.
- Production and remote responses were HTTP 200 for every target.
- Common production headers: `cache-control: public, max-age=0, must-revalidate`; `server: Vercel`; `x-vercel-cache: HIT`.

| Path | Content-Type | ETag | Last-Modified | Production body SHA-256 | Result |
|---|---|---|---|---|---|
| `/` | `text/html; charset=utf-8` | `W/"7cb29ecd687800e67e61ce0da5e2d0d8"` | `Mon, 13 Jul 2026 00:46:01 GMT` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | match |
| `/robots.txt` | `text/plain; charset=utf-8` | `"e9691db856777cb142289fba85913a2a"` | `Thu, 16 Jul 2026 09:36:02 GMT` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | `application/xml` | `W/"111fe7a1153ff9c94534fb35284b473c"` | `Wed, 15 Jul 2026 17:42:05 GMT` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | match |
| `/car-key-lost-service` | `text/html; charset=utf-8` | `W/"e6e4da663a13d22b86f9b7acc38ac1f0"` | `Wed, 15 Jul 2026 16:58:13 GMT` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | match |
| `/article-bmw-smart-key-owner-guide` | `text/html; charset=utf-8` | `W/"84b86e53aa6ddf9f3e58149ede58fe6a"` | `Wed, 15 Jul 2026 03:05:36 GMT` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | match |
| `/article-audi-r8-neihu-all-keys-lost` | `text/html; charset=utf-8` | `W/"f566345faf5e75320a73ea2c27a566c0"` | `Wed, 15 Jul 2026 16:21:33 GMT` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | match |
| `/assets/js/procore-conversion-tracking.js` | `application/javascript; charset=utf-8` | `W/"814dc9cc755fbc0b5896292d0baeb2c9"` | `Mon, 13 Jul 2026 00:08:21 GMT` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | match |

The complete observation also recorded final URLs, content lengths where sent, `x-vercel-id`, and identical remote-file SHA-256 values. Later production changes must be reported as drift; this baseline must not be rewritten.

## Validation and rollback

Completed acceptance:

- `node scripts/validate-seo-governance.mjs --compare-head --self-test`: exact 6-file / 9-occurrence remainder, four negative gates, 0 errors.
- `npm run test:seo-foundation`: 135-page inventory, metric drift check, 49-page schema guard, and all foundation checks passed.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors; JSON-LD parsed successfully.
- `npm run audit:measurement`: 135 HTML files, 0 warnings, 0 errors; click paths do not emit `generate_lead`.
- `git diff --check`: passed.
- Browser, all five pages at 1440×900 and 390×844 viewport overrides: one H1, zero HTML/visible target claims, zero horizontal overflow, zero console warnings/errors, and zero JSON-LD parse errors. `cases.html` rendered WebPage name is `到場案例 | 極致核心 ProCore | 汽車鑰匙救援紀錄`.

Analytics classification is **Static verified**. This batch did not click CTAs, so browser event and network payload verification are **Not verified**.

## Final production drift observation

- Captured: `2026-07-17T01:22:46+08:00` (Asia/Taipei).
- Live remote `main`: unchanged at `15301685c7d8dcb709c253b0759c770361840a54`.
- Result: 7 checked / 7 match / 0 drift.

This observation did not update the pre-write baseline or modify production.

Rollback is the inverse of the five registered text replacements plus removal of the seventh migration stage, validator registrations, and this evidence document. It must not be used merely to restore an unsupported availability promise.

Suggested future commit boundary: `fix(content): neutralize unsupported general 24H rescue copy`.
