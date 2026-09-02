# Inquiry recovery audit and campaign — 2026-09-02

Status: P0 release candidate. Evidence current through 2026-09-02 (Asia/Taipei).

## Executive summary

Actual inquiries are materially down even though the latest two complete GA4 days show more sessions. The strongest evidence is a funnel-quality problem, not a sitewide ranking collapse:

- 2026-08-31–09-01 versus the weekday-aligned 2026-08-24–25 window: sessions increased from 132 to 158, while observed phone plus LINE plus structured-intake starts fell from 5 to 3. The observed intent rate therefore fell from about 3.8% to 1.9%.
- Organic Search sessions fell 17.9%, organic key events fell 66.7%, and organic engagement fell from 51.3% to 36.5%. Direct and Unassigned grew sharply but carried almost no engagement, so the traffic increase is not equivalent to more qualified demand.
- Search Console 2026-08-29–30 versus 2026-08-22–23: clicks fell 22.7%, impressions fell only 3.8%, CTR fell 19.7%, and average position improved slightly. This points to click-through/query-mix weakness rather than broad ranking loss.
- The structured inquiry page intentionally omitted the shared GA4 script. Five `rescue_request_start` events were visible after the previous release, but no `/rescue-request` page views or downstream LINE/phone/form-ready events were observable. Thirteen prominent CTAs route through that page, creating both a measurement blind spot and an extra step before contact.

Recommendation: ship the reversible funnel repair now, then evaluate search and inquiry outcomes over 14 complete days. Do not make broad title, canonical, location-page, or content-volume changes from a two-day sample.

## Scope and acceptance

Priority: P0 — real inquiry and revenue risk.

In scope:

- Restore GA4 page and CTA measurement on `/rescue-request` without collecting form contents.
- Put direct LINE first, direct phone second, and the structured form third on that page.
- Record `rescue_message_ready` only when a valid, privacy-filtered message is generated; keep it diagnostic, not a key event.
- Keep `line_click` and `click_to_call` as the only current web key events. Remove the stale key-event designation from `generate_lead`; a click is not a qualified lead.
- Preserve source attribution, privacy guards, canonical URL, sitemap entry, structured data, and CasePilot message reference.

Out of scope:

- Claims of 24-hour availability, guaranteed arrival, fixed price, nationwide coverage, or response time without owner evidence.
- Sending form fields, free text, location detail, vehicle identity, or generated LINE message content to GA4.
- Treating `rescue_request_start`, `rescue_message_ready`, a LINE click, or a phone click as a qualified lead or revenue.
- Mass title rewrites, new location pages, paid-media spend, or automatic Production rollback based only on a short-window metric.

Acceptance:

1. Every indexable page except the local-only service-area checker loads exactly one shared tracking asset; 131 pages remain valid and `/rescue-request` has no form submission, storage, cookie, or user-data network path.
2. The rescue page exposes LINE and phone above the form on desktop and mobile.
3. A valid form completion produces one `rescue_message_ready`; invalid form attempts produce none; LINE and phone clicks retain their existing event names.
4. Static, runtime, intake, SEO, schema, deployment-boundary, and production-dependency gates pass.
5. Preview and Production assets match the reviewed commit; no synthetic Production CTA click is required.

Local browser verification completed on 2026-09-02: the direct LINE and phone actions rendered above the form at 1280×720 and 390×844; the mobile document had no horizontal overflow; a synthetic, non-identifying form submission generated the expected message and anonymous reference; console warnings/errors were zero. The local page loaded GA4 and may therefore create identifiable `127.0.0.1:4187/rescue-request.html` page-view/diagnostic traffic. No LINE or phone CTA was clicked and no message or call was sent.

Rollback: revert the release commit through the normal PR path and let Vercel redeploy. Roll back immediately if page views or CTA events stop, user-supplied values appear in GA4, the rescue page sends form data over the network, or live assets drift from the reviewed commit.

## Keyword and landing-page audit

The priority reflects current intent and observed landing-page evidence, not invented search volume.

| Keyword / intent cluster | Intent | Current landing page | Priority | Action |
|---|---|---|---|---|
| 汽車鑰匙不見 | Emergency service | `/car-key-lost-service` | P0 | Keep current canonical; ensure the rescue path offers direct LINE immediately |
| 車鑰匙遺失 | Emergency service | `/car-key-lost-service` | P0 | Same as above; no duplicate page |
| 汽車鑰匙全丟 | Emergency service | `/all-keys-lost-service` | P0 | Keep phone plus frictionless LINE path |
| 汽車鑰匙不見沒備份 | Emergency service | `/all-keys-lost-service` | P0 | Preserve intent separation from spare-key content |
| 汽車遙控器沒反應 | Troubleshooting / service | `/article-smart-key-troubleshooting` | P0 | Highest-volume observed article; restore downstream contact visibility |
| 汽車遙控器突然不能用 | Troubleshooting | `/article-smart-key-troubleshooting` | P1 | Monitor 14-day CTR and engagement before changing title |
| 汽車未偵測到鑰匙 | Troubleshooting / service | `/article-car-key-not-detected-troubleshooting` | P0 | Keep guide-to-service path; monitor lost clicks |
| Key Not Detected | Troubleshooting / service | `/key-not-detected-service` | P0 | Keep bilingual wording in title/H1; direct contact available on rescue page |
| Keyless 感應不到 | Troubleshooting / service | `/key-not-detected-service` | P0 | Do not merge into generic battery content |
| 車子無法發動 | Troubleshooting | `/article-car-wont-start-troubleshooting` | P0 | Traffic is stable but engagement weakened; preserve diagnostic framing |
| 晶片鑰匙可以複製嗎 | Commercial research | `/car-key-duplication-service` | P1 | Preserve separation from “only one key” decision intent |
| 汽車鑰匙複製 | Commercial | `/car-key-duplication-service` | P1 | Compare qualified inquiries, not clicks alone |
| 只剩一支汽車鑰匙 | Preventive service | `/spare-car-key-service` | P1 | Keep backup-risk framing and simple contact path |
| 汽車備用鑰匙 | Preventive service | `/spare-car-key-service` | P1 | No fixed-price claim without evidence |
| BMW 鑰匙感應不到 | Brand troubleshooting | `/bmw-smart-key-service` | P1 | Observe 14 days; short-window impressions also fell, so do not diagnose title alone |
| BMW 智慧鑰匙 | Brand service | `/bmw-smart-key-service` | P1 | Maintain evidence-based model guidance |
| VW 鑰匙轉不動 | Brand troubleshooting | `/article-vw-ignition-repair` | P1 | Preserve steering-lock/ignition intent and direct recovery path |
| 高雄 汽車鑰匙 | Local service | `/kaohsiung-car-key` | P1 | Keep current page; no new district pages from keywords alone |
| 台中 汽車鑰匙複製 | Local commercial | `/taichung-car-key` plus duplication service | P1 | Use internal links and Case evidence; avoid competing near-duplicate pages |
| 汽車鑰匙外殼更換 | Commercial | `/car-key-shell-replacement-service` | P1 | CTR weakened with flat impressions; review 14-day snippet before editing |

Google states that useful, concise titles and page headings help people choose results, while title links are generated from several page and link signals and may take days to weeks to update. This is why the current two-day CTR signal triggers observation and targeted review, not a sitewide rewrite.

## On-page and technical findings

| Area | Result | Decision |
|---|---|---|
| Titles, descriptions, H1, canonical | Existing deterministic gates pass; no duplicate or missing critical elements | No broad rewrite |
| Sitemap and robots | Valid and reachable in the latest Production baseline | Preserve |
| Redirect/canonical consolidation | Keyless consolidation and known legacy redirects already shipped | Preserve and monitor |
| Mobile contact path | Rescue page made contact conditional on completing or abandoning a long form | Put direct LINE/phone above the form |
| Event coverage | Rescue page was a deliberate no-tracking exception | Add fixed shared tracker; prohibit all form-data transport |
| Blank landing | 12.2% in the latest GA4 window, above the 5% investigation threshold | Continue measurement investigation; do not assign a single cause |
| Channel attribution | Direct and Unassigned increased with near-zero engagement | Keep the safe UTM/click-ID allowlist; do not restore arbitrary query capture |
| Third-party script | Existing Washinmura mutable/unversioned warning remains | No scope expansion; separate owner/privacy decision |
| Production dependencies | No production vulnerabilities | Release gate passes |

## Competitive brief

Research date: 2026-09-02. Public pages are used only to compare positioning and user flow; competitor claims are not adopted as ProCore facts.

| Provider | Public positioning | Contact/funnel pattern | ProCore implication |
|---|---|---|---|
| [KeyMaster 鴻旻鎖店](https://keymastertw.com/) | Taichung store, chip/smart-key duplication and all-keys-lost assistance; asks for model, year, location, and power status | Direct LINE is prominent before detailed intake; service conditions and fee discussion are explained | Match the low-friction first contact while keeping ProCore's privacy boundary and evidence-based claims |
| [大連汽車晶片](https://www.dlkeyshop.com/) | Broad locksmith and automotive chip-key coverage in Taichung | Phone and LINE are presented as immediate inquiry routes | ProCore should not hide its direct contact behind an intake step |
| [全方位汽車晶片](https://www.lostkeys95.com/about/1.htm) | Emergency/lost-key and on-site positioning | Strong urgency and direct contact messaging | Compete on clarity and safe triage, not unverified 24H or speed promises |
| [BMW Taiwan](https://www.bmw.com.tw/zh/digital-services/bmw-digital-key.html) | Official Digital Key setup and supported-use information | Product/self-service education, then official support | Keep owner troubleshooting pages factual and clearly separate Digital Key setup from locksmith service |

Market gap ProCore can own: “先直接聯絡；需要時再安全整理資料”, backed by source attribution, privacy-safe intake, real case evidence, and no exaggerated service promise.

## Brand and content review

The release copy is clear, consistent, and professionally cautious:

- Primary CTA: `直接加 LINE 詢問`.
- Secondary CTA: `直接撥電話`.
- Optional workflow: complete the structured form only when the customer wants help organizing vehicle context.
- Trust copy: the form remains local to the page and explicitly forbids plate, VIN, full address, name, phone, and technical-operation details.
- No new operating-hours, arrival-time, price, rating, nationwide-coverage, or outcome claim.

Required consistency rule after release: content/service pages may continue to label the routed CTA “整理資料後傳 LINE”, but the destination must visibly offer direct LINE before the form so the label does not become a gate.

## Fourteen-day recovery campaign

Objective: restore observable, real inquiry opportunities without buying low-quality traffic or confusing clicks with leads.

Audience:

- Urgent: all keys lost, key not detected, car will not start, key will not turn.
- Preventive: only one key, used-car handover, backup/duplication.
- Brand/local: BMW/VW troubleshooting and current evidence-backed service areas.

Message hierarchy:

1. Direct LINE inquiry is available without completing a form.
2. Send model, year, approximate area, visible dashboard/key condition, and photos when convenient.
3. Service feasibility and price depend on the actual vehicle and conditions; no guaranteed outcome.

Channels and calendar:

| Timing | Owned-site / search action | Measurement action |
|---|---|---|
| Day 0 | Release the rescue funnel repair | Verify live asset hashes, page view availability, and GA4 event definitions without synthetic CTA clicks |
| Days 1–3 | No title churn; confirm site and contact paths remain healthy | Daily check `line_click`, `click_to_call`, `rescue_request_start`, `rescue_message_ready`, blank landing, and channel quality |
| Days 4–7 | Review the top three troubleshooting landings and lost-key service page | Compare complete days with weekday-aligned baseline; annotate internal/diagnostic traffic |
| Days 8–14 | Draft at most one snippet/hero experiment only if CTR weakness persists with stable position | Compare GSC clicks/CTR and CasePilot actual inquiries/outcomes by landing page |
| Day 15 | Decide keep, revise, or revert | Report click-to-real-inquiry gap; do not optimize to clicks alone |

KPIs and guardrails:

- Primary business KPI: owner-confirmed real inquiries and qualified inquiries by day/source.
- Funnel KPIs: `line_click`, `click_to_call`, `rescue_request_start`, `rescue_message_ready`, plus their rates per eligible session.
- Search KPIs: clicks, CTR, average position, and organic sessions over complete comparable windows.
- Investigation guardrails: blank landing at or above 5%, Unassigned at or above 10%, or organic engagement relative decline at or above 25%.
- Search incident threshold: GA4 organic sessions and GSC clicks both decline at least 20% in comparable complete windows.

Budget: no paid-media spend is assumed or authorized. The campaign uses owned pages, Search Console observation, GA4, and CasePilot/manual outcome evidence.

## GA4 event policy after release

| Event | Meaning | Key event? |
|---|---|---|
| `click_to_call` | Phone contact intent | Yes |
| `line_click` | LINE contact intent | Yes |
| `rescue_request_start` | Entered the structured composer | No, diagnostic |
| `rescue_message_ready` | Valid local message generated | No, diagnostic |
| `generate_lead` | No supported production sender / stale definition | No; remove key-event designation |

GA4 records a key event only when the underlying event is collected. The application therefore verifies collection and business meaning separately from the Admin toggle. Actual inquiry confirmation still comes from LINE/phone handling and CasePilot/manual outcome evidence.

## Sources

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google title link guidance](https://developers.google.com/search/docs/advanced/appearance/good-titles-snippets)
- [Google helpful content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Analytics key events](https://support.google.com/analytics/answer/9355848)
- [KeyMaster 鴻旻鎖店](https://keymastertw.com/)
- [大連汽車晶片](https://www.dlkeyshop.com/)
- [全方位汽車晶片](https://www.lostkeys95.com/about/1.htm)
- [BMW Taiwan Digital Key](https://www.bmw.com.tw/zh/digital-services/bmw-digital-key.html)
