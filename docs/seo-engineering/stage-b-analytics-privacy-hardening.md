# Stage B analytics privacy hardening

Status: implemented and verified locally on `seo/stage-b-foundation-20260716`; not committed, pushed, merged, or deployed.

## Problem, priority, and value

This P0 batch closes three release-readiness defects in the shared conversion script:

1. CTA and diagnostic payloads used `window.location.href` for `page_location`, so URL query parameters and fragments could enter Analytics. That conflicts with ADR-010 and the SEO governance privacy boundary.
2. The bare GA4 `config` command allowed the automatic `page_view` to use the browser's full URL. The first controlled browser observation confirmed that a query value appeared in the real GA request `dl` parameter even after custom CTA payloads had been sanitized.
3. The public `generate_lead` diagnostic query was protected only by a visible token. It could therefore be invoked on the production hostname and pollute lead reporting.

The business value is cleaner attribution and lower privacy/reporting risk. This does not create a new conversion, increase event volume, or change the public contact experience.

## Production observation before writing

- Observed at: `2026-07-17T09:01:52+08:00` (Asia/Taipei).
- Live remote `main`: `15301685c7d8dcb709c253b0759c770361840a54`.
- Seven representative production resources returned successful HTTP responses and all seven response-body SHA-256 values matched the corresponding files at live remote `main`.
- Result: `7 match / 0 content drift`.
- Response-header observation: some `last-modified` values had refreshed since earlier observations, but response-body hashes were unchanged. Header freshness was not treated as content drift.

This is a point-in-time observation, not a mutable golden value. A later production difference must be reported as drift; it must not cause the saved observation or test expectations to be rewritten.

The post-write read-only observation at `2026-07-17T09:33:38+08:00` independently re-read live remote `main` (still `15301685c7d8dcb709c253b0759c770361840a54`) and production. All seven targets returned HTTP 200 with Vercel response headers; all seven production body SHA-256 values still matched the corresponding remote-main files (`7 match / 0 drift`). This later observation did not overwrite the pre-write record.

Common response-header summary: `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, and `x-vercel-cache: HIT` for all seven targets. `x-vercel-id` was present and request-specific. Exact content observations:

| URL | Status | Content-Type | ETag | Last-Modified | Production body SHA-256 | Remote-main result |
| --- | ---: | --- | --- | --- | --- | --- |
| `/` | 200 | `text/html; charset=utf-8` | `W/"7cb29ecd687800e67e61ce0da5e2d0d8"` | `Fri, 17 Jul 2026 01:00:05 GMT` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | match |
| `/robots.txt` | 200 | `text/plain; charset=utf-8` | `"e9691db856777cb142289fba85913a2a"` | `Fri, 17 Jul 2026 01:01:52 GMT` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | 200 | `application/xml` | `W/"111fe7a1153ff9c94534fb35284b473c"` | `Fri, 17 Jul 2026 01:01:53 GMT` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | match |
| `/car-key-lost-service` | 200 | `text/html; charset=utf-8` | `W/"e6e4da663a13d22b86f9b7acc38ac1f0"` | `Fri, 17 Jul 2026 01:01:53 GMT` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | match |
| `/article-bmw-smart-key-owner-guide` | 200 | `text/html; charset=utf-8` | `W/"84b86e53aa6ddf9f3e58149ede58fe6a"` | `Fri, 17 Jul 2026 01:01:54 GMT` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | match |
| `/article-audi-r8-neihu-all-keys-lost` | 200 | `text/html; charset=utf-8` | `W/"f566345faf5e75320a73ea2c27a566c0"` | `Fri, 17 Jul 2026 01:01:54 GMT` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | match |
| `/assets/js/procore-conversion-tracking.js` | 200 | `application/javascript; charset=utf-8` | `W/"814dc9cc755fbc0b5896292d0baeb2c9"` | `Thu, 16 Jul 2026 21:53:45 GMT` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | match |

## Scope

- Sanitize Analytics `page_location` to origin plus pathname; query and fragment are omitted.
- Sanitize tracked HTTP(S) contact destinations before using them as `link_url` or `event_label`; telephone destinations remain unchanged.
- Configure GA4 automatic page views with the same sanitized `page_location` and pathname-only `page_path`.
- Restrict the explicit `generate_lead` diagnostic path to `localhost`, `127.0.0.1`, or IPv6 loopback.
- Add a Node VM runtime regression test that executes the actual public tracking script with mocked browser primitives.
- Extend the static measurement audit so the unsafe full-URL assignment and missing loopback gate fail validation.
- Include the runtime regression in `npm run test:seo-foundation`.

Out of scope:

- No public HTML, URL, canonical, sitemap, robots, schema, CTA text, phone number, or LINE destination changes.
- No GA4/GTM account configuration and no change to the measurement ID.
- No actual phone call, LINE message, production event, merge, or deployment.

## Verification

- **Static verified:** `npm run audit:measurement` inspected 135 HTML files and the shared tracking source: 0 warnings, 0 errors. CTA click paths do not emit `generate_lead`; full `window.location.href` and a bare GA4 config are rejected; automatic page views and custom events require sanitized locations; the diagnostic path requires a loopback-host gate.
- **Node VM runtime verified:** `npm run test:tracking-runtime` executed the actual tracking asset. A production-host phone click emitted one `procore_phone_click` data-layer object and one `click_to_call` gtag command; a LINE click emitted one `procore_line_click` object and one `line_click` command. Neither emitted `generate_lead`. GA config and event `page_location` values omitted query and fragment, and a deliberately query-bearing LINE URL was reduced to origin plus pathname before tracking. A production-host diagnostic query emitted no `generate_lead`; the same query on `127.0.0.1` emitted exactly one diagnostic lead.
- **Browser verified:** a temporary loopback harness loaded the real shared tracking asset and GA4 library. Its page URL and LINE destination deliberately contained query/fragment test secrets. After the final fix, the actual GA requests contained one `page_view`, one `click_to_call`, one `line_click`, zero `generate_lead`, and zero occurrences of the test secrets. Phone payload classification was `conversion_type=phone`, `lead_source=phone`, `method=phone`; LINE used the corresponding `line` values. Both requests used pathname-only `dp`, sanitized loopback `dl`, and a LINE `link_url`/`event_label` reduced to `https://line.me/R/ti/p/@420gknem`. The harness prevented link navigation, so no call or LINE message occurred, and was deleted after testing.
- **Controlled Analytics traffic:** the browser verification sent localhost test traffic to GA4 around `2026-07-17 09:28–09:36 +08:00`. It is identifiable by `dl=http://127.0.0.1:4173/local/tracking-browser-harness.html` and title `CarKey tracking browser harness` and should be excluded from commercial reporting. The first observation demonstrated the pre-fix page-view query leak; subsequent page-view and click requests demonstrated the corrected page and destination payloads.

Full acceptance commands:

```bash
npm run test:tracking-runtime
npm run audit:measurement
npm run test:seo-foundation
npm run validate:site
npm run validate:governance
npm run validate:schema-rollout
git diff --check
```

## Risk and rollback

Risk is low and limited to shared Analytics payload construction. The visible site and navigation are unchanged. The main residual risk is future changes bypassing the shared script, mitigated by the static and VM regression gates plus the recorded browser/network evidence.

Before commit, rollback is `git restore` for the four tracked repository files and deletion of the new runtime test and this evidence file. After a future commit, revert that single commit. No production rollback is currently applicable because this batch has not been deployed.

## Suggested commit boundary

`fix(analytics): sanitize page locations and gate diagnostic leads`
