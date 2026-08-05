# Reviewed publication lifecycle

Wave 2 accepts only a deterministic, public-safe, Owner-approved CasePilot action package. CarKey remains the final authority and separates `plan`, `validate`, `apply`, and `verify`.

## Workflow

1. `publication:prepare-branch` verifies the action package, imports the candidate into deploy-excluded draft storage, checks the current baseline/public state/prior receipt, and writes a hashed promotion plan.
2. `publication:lifecycle --mode validate` proves the plan/action/draft/worktree bindings without mutation.
3. `publication:lifecycle --mode apply` writes only the reviewed change set inside a clean disposable worktree.
4. `publication:lifecycle --mode verify` rechecks page, canonical, schema, sitemap, registries, assets, changed-path allowlist, and no-network boundary.
5. An optional E2E-only local commit can be recorded with `--mode finalize`; normal apply does not commit, push, merge, deploy, or publish.

## Disposable-worktree requirement

The apply target must be a separate Git worktree whose Git directory is under the canonical repository's `.git/worktrees/`, whose `HEAD` exactly equals the approved baseline, whose top level equals the supplied target, and whose status is clean. The canonical checkout and dirty or drifted worktrees are rejected.

```bash
npm run publication:create-worktree -- --base-sha <approved-sha> --output-root <owned-temp-root>
```

Only a worktree created for the current run may be removed automatically. Its path and baseline are recorded even when validation fails.

## Publish

CarKey validates the final clean slug and collision state, renders a ProCore case page, copies exact approved 1200×630 assets, creates Article/Breadcrumb schema, adds canonical/OG/Twitter metadata, preserves conditional language and approved CTA routes, calls `publish_tool.py --root <worktree>` for all registries/sitemap, and adds three reviewable internal backlinks.

## Correct

Correction requires the exact current public-content hash and latest receipt. The existing canonical URL and `datePublished` remain unchanged; `dateModified` and the approved narrative/assets may change. A newer candidate revision is required. The tool updates the same page and registry record, does not create a second case, and rejects slug change, brand/CTA boundary violations, stale hashes, or changed prior action.

## Withdraw

Wave 2 uses the most conservative reversible policy: retain a minimal `noindex, nofollow, noarchive` tombstone at the original canonical URL, remove Article structured data, remove the entry from sitemap/blog/cases and internal backlinks, move public assets into deploy-excluded `data/publication-recovery/`, and append source-only history. It does not delete audit evidence or deploy automatically.

Replacement redirects are contract-representable only when the target already exists on the canonical host. This delivery does not modify external Vercel settings or deploy a redirect.

## Receipts, idempotency, and rollback

The apply receipt binds action hash, plan hash, baseline, worktree path, changed paths, resulting page hash, validators, result, rollback command, timestamps, canonical URL, local result commit when explicitly finalized, and no-network evidence. Exact replay returns `reused`; the same action ID with different bytes is a typed conflict.

Before merge, restore tracked paths from the exact baseline and clean only the explicitly listed new paths. After merge, use a normal reviewed revert/corrective commit; never rewrite `main`. Production rollback requires separate Owner authority.

## Human review checklist

- Action, consent, authorization, prior receipt, hashes, and baseline are exact.
- Public text and assets are safe, conditional, and ProCore-aligned.
- Canonical, dates, schema, sitemap, redirects, and internal links are coherent.
- Changed paths match the plan; recovery paths and rollback are acceptable.
- PR remains Draft; no merge, Production deployment, or public publication occurred.
