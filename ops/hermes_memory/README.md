# ProCore Hermes Memory

This folder is the operating memory for the Hermes-led ProCore content workflow.
It is intentionally stored in the repo so future agents can read the same rules
before producing or publishing case content.

Hermes owns:

- commercial angle and lead-generation strategy
- case article outline, title, meta copy, and section writing
- anti-AI-tone review and quality gate
- learning notes from Otto feedback and published case results

The Python automation owns:

- intake JSON normalization
- draft pack generation
- website template rendering
- `blog.json`, `cases.json`, `sitemap.xml`, and homepage sync
- commit/push after explicit approval

Gemini or other API writers should be treated as fallback only. The default
direction is Hermes-authored `aiCopy` plus deterministic ProCore publishing
scripts.
