# Traffic attribution reliability — 2026-08-26

Status: released through PR #19 and verified on Production. Squash merge `2a13a44a4a499fff88cc2ff81be47105e4a62abb` reached `main` and the public tracking asset on 2026-08-26.

## Decision

Fix measurement now, keep SEO content and page structure unchanged, then observe three complete post-deployment days against the same weekdays.

The current evidence does **not** support a search-traffic incident: the latest complete Search Console window increased in both clicks and impressions, while GA4 organic sessions also increased. It does support two warnings: degraded organic engagement and unreliable session attribution.

## Evidence synthesis

| Signal | Current | Comparison | Change | Interpretation |
| --- | ---: | ---: | ---: | --- |
| GSC clicks | 109 | 95 | +14.74% | Search demand/click volume did not fall |
| GSC impressions | 2,770 | 2,612 | +6.05% | Search visibility did not fall |
| GA4 organic sessions | 103 | 91 | +13.19% | GA4 organic volume did not fall |
| GA4 organic engagement rate | 32.04% | 61.54% | -29.50 points | Landing/session quality warning |
| GA4 Unassigned sessions | 19 / 131 | — | 14.50% share | Measurement-integrity warning |
| Blank landing sessions | 14 / 131 | — | 10.69% share | Missing page-view/session context warning |

GA4 report inspection showed that the Unassigned rows were composed of `user_engagement` and `scroll` events without corresponding `session_start` or `page_view` rows in the inspected report. Google documents that a landing page can be `(not set)` when a session has no `page_view`, and that missing session source/medium is classified as Unassigned. This is an observed symptom; the exact producer of every orphaned event is not proven by the current evidence.

Sources:

- [Google Analytics: What the value (not set) means](https://support.google.com/analytics/answer/13504892?hl=en-EN)
- [Google Analytics: Traffic-source dimensions, manual tagging, and auto-tagging](https://support.google.com/analytics/answer/11242870?hl=en)
- [Google tag API reference](https://developers.google.com/tag-platform/gtagjs/reference)

## Confirmed implementation defect

The shared tracking code overrode GA4 `page_location` with origin plus pathname and discarded every query parameter. That privacy control also discarded legitimate campaign and advertising identifiers (`utm_*`, `gclid`, `gbraid`, and related fields) before GA4 could classify the session.

Google's current guidance states that UTM parameters identify manual campaign traffic and that click identifiers support advertising attribution. Removing all of them makes the measurement implementation contradict the reporting objective.

## Implemented correction

The tracking boundary is now an allowlist:

```text
Browser URL
  -> keep origin + pathname
  -> copy only approved UTM / ad click identifiers
  -> truncate each value to 160 characters
  -> discard all other query parameters and every fragment
  -> send the same page_location with page view and CTA events
```

Approved parameters:

- Manual campaign: `utm_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_source_platform`, `utm_creative_format`, `utm_marketing_tactic`
- Advertising identifiers: `gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid`

The implementation still removes arbitrary or potentially sensitive parameters such as `customer_secret`, `private`, `prefill`, URL fragments, and the local diagnostic trigger. Tracked LINE destinations remain origin plus pathname only. CTA event names and conversion semantics are unchanged.

## Monitoring decision contract

`scripts/assess-traffic-health.mjs` turns an observation JSON file into a repeatable decision:

| Condition | Threshold | Decision |
| --- | ---: | --- |
| GA4 organic sessions and GSC clicks both fall | at least 20% | Investigate a search-traffic incident |
| Unassigned sessions | at least 10% of total sessions | Fix measurement and inspect event/session context |
| Blank landing sessions | at least 5% of total sessions | Fix measurement and inspect page-view coverage |
| Organic engagement rate falls at sufficient volume | at least 25% relative; at least 50 organic sessions | Investigate landing experience |
| None of the above | — | Continue same-weekday observation |

Current observation:

```bash
npm run report:traffic-health
```

Result: `fix_measurement_and_monitor_engagement`. It does not classify the current data as a search-traffic incident.

## Design-system and SEO boundaries

- No public HTML, visual token, component, layout, CTA label, URL, canonical, sitemap, robots, or schema change.
- The repository does not use `@wix/design-system`; no new Wix Design System dependency was introduced.
- Existing Tailwind/ProCore presentation remains the visual source of truth.
- No county page launch, broad article rewrite, or rollback is justified by the current evidence.

## Verification

- `npm run test:tracking-runtime`: verifies approved campaign parameters survive while private parameters and fragments do not; phone, LINE, structured inquiry, and loopback-only diagnostic behavior remain intact.
- `npm run audit:measurement`: verifies all tracked pages use the shared asset, CTA taxonomy does not emit `generate_lead`, full browser queries cannot be copied, and GA4 config uses the allowlisted builder.
- `npm run test:traffic-health`: verifies measurement-warning and real search-incident decision branches.
- `npm run report:traffic-health`: reproduces the current classification from `reports/traffic-health-observation-2026-08-26.json`.
- Full SEO, site, governance, schema, and diff gates are run before handoff.

## Production rollout evidence

- Source commit: `f28c562795fc6b1abaef39219f2298b77ea677d6` on `fix/analytics-attribution-20260826`.
- Draft PR #19 was marked ready after local gates, then squash-merged to `main` as `2a13a44a4a499fff88cc2ff81be47105e4a62abb` at `2026-08-26T15:53:18Z`.
- Both GitHub-linked Vercel deployment contexts (`procore-auto-key` and `repo`) reported success for the merge commit. No direct CLI deployment or protection bypass was used.
- `https://www.carkey.com.tw/`, `robots.txt`, `sitemap.xml`, the tracking asset, and a representative article returned successful HTTP responses after rollout.
- Production `assets/js/procore-conversion-tracking.js` SHA-256 was `d4f451282440939c8abf13f3dd9fb691390f6fbef867727127a405ce3d77d27a`, exactly matching the file at live `origin/main`.
- The production asset contains `ATTRIBUTION_QUERY_PARAMS` and `getAttributionSafePageLocation`. No real phone/LINE click or controlled GA4 event was emitted during post-deploy verification.

## Release and observation runbook

1. Completed: local diff reviewed and explicitly approved.
2. Completed: commit, push, PR, squash merge, and Git-integrated Vercel Production rollout.
3. Completed without emitting a production Analytics test event: runtime regression plus exact Production-to-main asset hashing verified the released code. Use GA4 DebugView with a controlled URL only if later report evidence requires an end-to-end event observation.
4. After three complete days, export aligned same-weekday GA4 and GSC windows and replace the observation JSON with the new totals.
5. If search sessions and clicks both decline by at least 20%, open an SEO incident investigation. If only engagement remains weak, prioritize the highest-volume troubleshooting landing pages for UX/content experiments.

## Risk and rollback

The change is limited to Analytics payload construction and local reporting scripts; it does not change the public UI. The residual privacy risk is campaign operators placing personal data inside an approved UTM value. Campaign governance must prohibit that practice; the code also caps values at 160 characters.

Production rollback is to revert merge commit `2a13a44a4a499fff88cc2ff81be47105e4a62abb` through the governed PR path and allow Vercel Git integration to redeploy the prior tracking asset. Trigger rollback if page views or CTA events stop arriving, approved attribution remains absent, unknown/private query values appear in Analytics, or CTA event volume changes unexpectedly. Engagement or Unassigned metrics alone should first be checked against three complete days because those symptoms were present before this release.
