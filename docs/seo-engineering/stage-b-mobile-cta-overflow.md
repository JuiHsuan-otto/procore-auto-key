# Stage B — US-car Guide Mobile CTA Overflow Fix

Date: 2026-07-16 (Asia/Taipei)
Branch: `seo/stage-b-foundation-20260716`
Starting HEAD: `b53e7c3052397149703ca224c68cbac4b5ba9b68`
Status: implemented and verified; approved for feature-branch commit/push and Vercel Preview delivery. Merge, main, and production promotion remain out of scope.

## Problem and evidence

Guide-page browser verification found `article-us-car-market-tech.html` horizontally overflowing at a 390-pixel viewport. The pre-fix working copy and its `HEAD` baseline both measured `scrollWidth 441`, proving the issue predated the schema rollout.

Element diagnostics showed that the CTA container used a default flex row. The 305-pixel phone button extended left to -50px and the 185-pixel LINE button extended right to 440px. This is a mobile usability/accessibility issue and can hide contact content outside the viewport.

## Change

The CTA container changed from:

`mt-12 flex justify-center`

to:

`mt-12 flex flex-col items-center justify-center`

This stacks both existing CTAs vertically and centers them. No text, link target, event code, URL, metadata, schema, image, or business claim was changed.

The full-HTML comparator retains an exact one-occurrence allowlist for this replacement. It does not permit arbitrary UI changes on the page.

## Verification

- Mobile 390×844: HTTP 200, `clientWidth=390`, `scrollWidth=390`, no overflow.
- Both CTA buttons render from x=35 to x=355 at 320px width.
- Desktop 1440×900: HTTP 200, `scrollWidth=1440`, both CTAs centered at 320px width.
- One H1, no console warning/error, and no page error at both viewports.
- Visual screenshot inspection showed no clipping or unexpected layout regression.
- Static site, schema, governance, and measurement gates passed before delivery.

Analytics runtime was not exercised because link destinations and tracking code are unchanged. Static CTA taxonomy remains the applicable verification level.

Final point-in-time production observation at `2026-07-16T19:03:21+08:00` confirmed live remote `main` `15301685c7d8dcb709c253b0759c770361840a54`, all seven targets HTTP 200, and 7 match / 0 drift. The immutable baseline record was not changed.

## Risk and rollback

Risk is limited to changing the CTA arrangement from horizontal to vertical on wider screens as well as mobile. This avoids adding an unbuilt responsive CSS variant and keeps the fix deterministic with the current Tailwind artifact.

Before merge, rollback by reverting this UI commit on the feature branch or closing the Draft PR. No production rollback applies unless this change is later merged and separately promoted.

## Commit boundary

`fix(ui): stack US-car guide CTAs to prevent mobile overflow`
