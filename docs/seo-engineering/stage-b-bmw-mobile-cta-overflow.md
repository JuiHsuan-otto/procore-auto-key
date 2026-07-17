# Stage B — BMW Case Mobile CTA Overflow Fix

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `f9ef3d46e3d547f5dfcff7137c6a32615d024fda`
Status: implemented locally; commit, push, PR update, Preview, merge, main, and production promotion remain out of scope until separately approved.

## Problem and evidence

Responsive verification of the independent BMW case schema rollout found horizontal overflow on the BMW 118 Beitun and BMW X3 Linkou pages at a requested 390×844 viewport. Both measured `scrollWidth 424` with an effective `clientWidth 375`.

DOM diagnostics identified the two CTA anchors as the only offenders. The parent used `flex justify-center`, while both anchors allowed widths up to 320 pixels and the second anchor already carried `margin-top:.75rem`. Source comparison proved the same container and overflow cause existed in `HEAD`; removal of JSON-LD `priceRange` cannot affect layout. Repository inspection found the identical two-button pattern on four BMW case pages:

1. `article-bmw-118-beitun-akl.html`
2. `article-bmw-740-yuanli-akl.html`
3. `article-bmw-gt535i-renwu-akl.html`
4. `article-bmw-x3-linkou-auction-akl.html`

## Scope

The only public HTML change is the exact container replacement:

```text
mt-12 flex justify-center
→ mt-12 flex flex-col items-center justify-center
```

The existing buttons, text, links, inline spacing, tracking, and CSS remain unchanged. `scripts/validate-schema-image-pilot.mjs` records the exact one-occurrence replacement for each page so full-HTML comparison can allow this fix without accepting any unrelated difference.

Out of scope:

- CTA wording, business-hours claims, serviceability, phone/LINE tracking, or conversion-event changes.
- Other BMW pages or other page templates.
- Schema changes beyond the separately documented BMW case rollout.
- Commit, push, Preview, merge, main, or production promotion.

## Verification contract

- All four pages must have `scrollWidth === clientWidth` at requested 390×844 and 1440×900 viewports.
- Both CTA anchors must remain visible and within the viewport.
- H1, JSON-LD, business-node, and `priceRange` assertions must continue to pass.
- Browser console warnings/errors and framework error overlays must remain zero.
- Full-HTML comparison must allow exactly one before→after class replacement per file and reject every other source difference.
- Full SEO, site, measurement, and diff gates must pass.

## Verification results

- All four pages passed requested 390×844 checks with effective `clientWidth 375` and `scrollWidth 375`; before the fix, the two initially sampled pages measured `scrollWidth 424`.
- Both CTA anchors on every page remained visible at x=28–348 with width 320 pixels.
- All four pages passed requested 1440×900 checks with effective `clientWidth 1425` and `scrollWidth 1425`; both CTA anchors remained centered at x=553–873.
- H1 count remained one, `priceRange` remained absent, framework overlays remained absent, and console warning/error count remained zero.
- A representative mobile screenshot was inspected with no visible regression.
- Schema/HTML HEAD guard, SEO foundation, 135-page site validation, measurement audit, and diff checks all passed after the UI replacement was registered.

### Analytics verification level

- **Static verified:** required before delivery; phone and LINE paths must not emit `generate_lead`.
- **Browser verified:** not planned; no CTA will be clicked.
- **Not verified:** no event-name, count, parameter, or network-payload claim will be made.

## Production observation

Final point-in-time observation: `2026-07-16T23:35:18+08:00`; live remote `main` was `15301685c7d8dcb709c253b0759c770361840a54`. All seven targets returned HTTP 200 and production body SHA-256 values matched the remote-main files: 7 match / 0 drift. The immutable baseline was not rewritten.

## Risk and rollback

- Risk is limited to desktop CTA arrangement changing from a forced row to a centered column. This matches the existing margin-top spacing and prevents overflow at all widths.
- Before commit, rollback by restoring the four HTML class values, validator allowlist, and this document from `HEAD`.
- After a future commit, revert only the proposed UI commit. Production rollback does not apply without a separately approved promotion.

## Proposed commit boundary

`fix(ui): stack BMW case CTAs to prevent mobile overflow`
