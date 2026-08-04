# Post-PR #3 responsive image dimensions pilot

Date: 2026-08-04 (Asia/Taipei)
Status: local correction validated; not committed, pushed, deployed, or present in production

## Problem, priority, and false negative

This P1 performance/correctness pilot governs one existing hero `<picture>` on each of three article pages. The original local change added `width` and `height` only to each fallback `<img>`. The validator likewise inspected only `<img src>`, so it returned exit 0 while ignoring browser-selectable `<source srcset>` assets.

That gap produced a concrete false negative on `article-honda-fit-2018-kaohsiung-akl.html`: the fallback JPEG is 3000 × 4000, while the preferred WebP is 1600 × 2133. Applying 3000 × 4000 to the WebP would be wrong even though the two files represent the same portrait image. Each selectable file needs source-specific metadata.

## Baseline and scope

- Canonical repository: `/Users/otto/AI-Workspace/projects/business/carkey/repo`
- Branch: `seo/image-dimensions-pilot-20260720`
- Local HEAD and production baseline: `origin/main@ec780a6f4a90e2b0da5a3b132fbfe96feb59752d`
- Governed pages: exactly the three pages in the matrix below
- Changed implementation paths: the three HTML pages and `scripts/validate-schema-image-pilot.mjs`
- Evidence path: this existing pilot document
- No dedicated test file was needed; deterministic fixtures are contained in the existing validator.

Out of scope are all other HTML, shared templates, CSS, image binaries, production configuration, schema claims, copy, CTA, Analytics, the remaining image backlog, and `skills/stop-slop`. Wave 0 has not started.

## Final responsive-image matrix

All actual dimensions were read from the repository files with the existing `sharp` dependency. EXIF orientation is absent for all six assets.

| Page | Element | Candidate | Format / type | Actual dimensions | Declared dimensions | Selection relevance |
|---|---|---|---|---:|---:|---|
| `article-emergency-akl-guide.html` | `<source srcset>` | `img/procore_logo_main.webp` | WebP / `image/webp` | 960 × 960 | 960 × 960 | Preferred when WebP is supported; no media condition |
| `article-emergency-akl-guide.html` | `<img src>` | `img/procore_logo_main.jpg` | JPEG | 960 × 960 | 960 × 960 | Required fallback |
| `article-honda-fit-2018-kaohsiung-akl.html` | `<source srcset>` | `img/cases/honda-fit-20260410.webp` | WebP / `image/webp` | 1600 × 2133 | 1600 × 2133 | Preferred when WebP is supported; no media condition |
| `article-honda-fit-2018-kaohsiung-akl.html` | `<img src>` | `img/cases/honda-fit-20260410.jpg` | JPEG | 3000 × 4000 | 3000 × 4000 | Required fallback |
| `article-bmw-elv-red-lock-fix.html` | `<source srcset>` | `img/cases/bmw-elv-red-lock-fix.webp` | WebP / `image/webp` | 1108 × 1477 | 1108 × 1477 | Preferred when WebP is supported; no media condition |
| `article-bmw-elv-red-lock-fix.html` | `<img src>` | `img/cases/bmw-elv-red-lock-fix.jpg` | JPEG | 1108 × 1477 | 1108 × 1477 | Required fallback |

The pages retain their existing `alt`, `decoding="async"`, classes, source order, fallback behavior, layout markup, and absence of a `loading` attribute. This pilot adds no loading policy; the local HTML diff is limited to source-specific intrinsic dimensions.

## Validation invariant

The validator applies these fail-closed rules:

1. The responsive-dimensions allowlist is exactly the three pages above, with exact expected fallback and source paths, source count, order, MIME type, and media condition.
2. Each governed page contains exactly one `<picture>`, its `<source>` elements precede exactly one fallback `<img>`, and every browser-selectable source candidate is validated.
3. Every `<img>` and `<source>` has one, and only one, positive-integer `width` and `height` declaration. The fallback declaration must exactly equal the fallback file metadata.
4. A descriptor-free candidate is treated as `1x` and must exactly equal its source declaration. A density candidate must equal the declared dimensions multiplied by its density. A width descriptor must equal the candidate's actual pixel width and use `sizes`; all candidates must remain aspect-compatible.
5. Candidate paths are parsed individually. Malformed, mixed-kind, duplicate, missing, escaping, unreadable, unexpected, or MIME/extension-inconsistent candidates fail validation.
6. Exact candidate dimensions are never relaxed by aspect-ratio similarity. Cross-variant aspect compatibility alone permits at most half a pixel of integer-resize rounding; this narrowly admits 1600 × 2133 and 3000 × 4000 while rejecting materially different crops.
7. The validator reads actual file metadata independently. Expected dimensions are not hard-coded into the allowlist or shared between markup expectations and the metadata source.

This follows the HTML model in which `<picture>` sources participate in selection, `srcset` is a candidate list, and `width`/`height` may be specified on `<source>` under `<picture>`: [WHATWG HTML](https://html.spec.whatwg.org/multipage/embedded-content.html#the-source-element), [MDN `<source>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/source), [MDN `<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture), and [MDN `<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img).

## Validator architecture and behavior

`scripts/validate-schema-image-pilot.mjs` now uses a small quote-aware tag tokenizer and stateful attribute parser for `<picture>`, `<source>`, and `<img>`. It preserves duplicate attributes for rejection, parses every `srcset` candidate and descriptor, resolves each local path inside the repository, and asks `sharp` for width, height, and format. The immutable-baseline comparator separately registers only the three approved source and fallback dimension insertions.

The existing schema/image rollout checks remain intact. Fixture metadata is injected only for self-tests, keeping malformed-input tests deterministic without writing files. Production validation always uses real repository image metadata.

## Positive validation

The responsive self-test executed and passed four positive structures:

1. A single candidate without a descriptor (`1x`).
2. Multiple candidates with width descriptors and `sizes`.
3. Multiple candidates with density descriptors.
4. Source-specific dimensions with the Honda integer-resize rounding relationship.

The real-page run verified all three fallback files and all three preferred WebP candidates with zero errors. Existing governance self-tests also passed 11 checks.

## Negative test matrix

Every case below was actually executed through the responsive validator and required a matching explicit error; any unexpected pass makes the self-test process fail nonzero.

| # | Injected defect | Expected gate |
|---:|---|---|
| 1 | `<img>` missing width | Missing width error |
| 2 | `<img>` missing height | Missing height error |
| 3 | `<img>` wrong width | Fallback actual-dimension mismatch |
| 4 | `<img>` wrong height | Fallback actual-dimension mismatch |
| 5 | Non-numeric dimension | Positive-integer error |
| 6 | Zero dimension | Positive-integer error |
| 7 | Negative dimension | Positive-integer error |
| 8 | Duplicate width | Duplicate-attribute error |
| 9 | Duplicate height | Duplicate-attribute error |
| 10 | `<source>` omitted from validation contract | Missing source width error proves source is visited |
| 11 | `<source>` wrong dimensions | Density/actual mismatch |
| 12 | `<source>` file missing | Metadata resolution error |
| 13 | Malformed multi-candidate `srcset` | Malformed-candidate error |
| 14 | Width descriptor disagrees with actual width | Width-descriptor mismatch |
| 15 | Density descriptor disagrees with actual dimensions | Density mismatch |
| 16 | Correct fallback, wrong preferred source | Preferred-source mismatch |
| 17 | Correct preferred source, wrong fallback | Fallback mismatch |
| 18 | Source and fallback use incompatible ratios | Aspect-conflict error |
| 19 | Page outside allowlist | Allowlist error |
| 20 | MIME/extension mapping disagrees with actual format | Format-mapping error |

## Verification boundary

The correction gate uses read-only, no-build repository checks. It does not install dependencies or produce `.next`, `dist`, `coverage`, generated inventory, or rendered output. The final correction report records exact commands, timestamps, exit codes, stdout/stderr summaries, before/after hashes, and side-effect checks.

No claim is made that field CLS improved or that this pilot is online. Production remains the unmodified `origin/main@ec780a6f4a90e2b0da5a3b132fbfe96feb59752d`; these local changes have not been committed, pushed, opened as a PR, or deployed. Wave 0 remains blocked from starting.

## Risk and rollback

Risk is limited to responsive-image metadata and validator strictness. The markup preserves the same source paths and selection order, while candidate dimensions are proven from actual files. The main residual compatibility risk is future introduction of a more complex `srcset` form outside the documented invariant; the validator will fail closed so it can be reviewed deliberately.

Before commit, rollback is removal of the three `<source>` and three `<img>` dimension insertions, the corresponding immutable-comparator registrations and responsive validator/self-tests, and this document update. After a future merge, use a normal revert PR; do not rewrite `main` history.

Owner next step, only after the correction report is accepted: review the five-path local diff and explicitly authorize a commit. Do not push, deploy, or begin Wave 0 without separate authorization.
