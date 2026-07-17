# Third-party AEO script decision record

Decision: `pending_owner_privacy_review`. Current legacy use is frozen to the five-page allowlist in `data/third-party-scripts.json`; expansion is prohibited.

## Point-in-time technical observation

- Observed: `2026-07-16T01:19:08+08:00`
- Source: `https://aeo.washinmura.jp/widget/crawler-track.js`
- HTTP: 200; JavaScript; 3,506 bytes; cache max-age 3,600 seconds.
- SHA-256: `42b3ec8bc80662cf244244078b8fd17c17506e3f704543cd5502ce6f01cd3411`
- Mutable/unversioned URL; no SRI/integrity attribute.
- Destination in observed source: `https://aeo.washinmura.jp/api/v1/track`.
- Transport: `sendBeacon`, with XMLHttpRequest fallback.
- Observed payload fields: site slug, page origin/path without query/hash, title, referrer, UA-derived bot category, JSON-LD/FAQ/sitemap flags, viewport width.
- The script comments claim no cookies; this observation does not independently prove vendor retention, onward transfer, or legal compliance.

Current pages: `cases.html`, `article-emergency-akl-guide.html`, `article-honda-fit-2018-kaohsiung-akl.html`, `article-lost-key-comparison.html`, and `article-toyota-altis-2020-yuanlin-akl.html`.

Follow-up read-only observation at `2026-07-17T01:57:46+08:00`: the URL still returned HTTP 200 and 3,506 bytes. Its SHA-256 remained `42b3ec8bc80662cf244244078b8fd17c17506e3f704543cd5502ce6f01cd3411`, matching the prior body observation, although the response still has only a one-hour cache policy and the URL remains unversioned. This confirms body stability at two points in time; it does not prove future immutability, owner authorization, retention terms, or privacy compliance.

## Required owner decision

The business owner must identify authorization/contract, business purpose, controller/processor roles, retention/deletion terms, privacy disclosure, and accountable owner. Then choose one:

1. Keep with documented approval and appropriate privacy/CSP controls.
2. Pin or self-host an approved version, subject to license and update ownership.
3. Remove the five tags and then narrow CSP in a separately tested change.

No choice is made in this batch. Removing the script without owner context could destroy intended measurement; keeping or expanding it without review preserves privacy and supply-chain uncertainty.

## Rollback and verification for a future decision

- Baseline the five pages, CSP, script hash, and any expected vendor reports.
- Pilot one representative article before altering all five pages.
- Verify page rendering, console/network, GA4 isolation, CSP, validator, and source diff.
- Roll back by restoring the exact tag/CSP state from the feature-branch diff; never compensate by changing production directly.
