# Reviewed Draft Publication PR orchestration

Wave 3 turns one verified synthetic publish apply into a reviewable Draft PR. It does not authorize merge, deployment, or publication.

## Separated workflow

1. `prepare` verifies the action package, promotion plan, apply receipt, fresh disposable worktree, exact changed paths, base SHA, and collision-free publication branch.
2. `stage` creates the publication branch inside that worktree and stages only the plan paths with explicit `git add -- <paths>`.
3. `commit` requires the exact staged set and creates one synthetic review commit whose parent is the approved main SHA.
4. `push` pushes only the publication branch and confirms the remote ref resolves to the same commit.
5. `create-draft-pr` creates a Draft PR against `main`, verifies title/body digests, base/head, and changed-file scope.
6. `verify-pr` requires terminal successful checks, a READY Preview tied to the PR head, and an HTTP 200 Preview.
7. `emit-receipt` performs no network call. It creates the hashed Publication PR Receipt v1 package from sanitized evidence.

The source-tool branch and the synthetic publication branch are deliberately separate. The source PR contains the orchestrator, contract, tests, and this document. The synthetic publication PR contains only the public paths from its promotion plan.

## Commands

Run `npm run publication:pr-orchestrator -- --mode <mode>` with the mode-specific paths documented by `scripts/publication/orchestrate-publication-pr.mjs`. Outputs and receipts must remain outside the public deployment root or under a deploy-excluded local evidence directory.

The generated PR body must identify the demonstration as synthetic in audit metadata while the proposed public page itself must not expose fixture/internal wording. It must include the action/candidate IDs, contract versions, plan hash, exact changed paths, validation and privacy results, carkey.com.tw alignment, Preview status, rollback, and the warning: do not merge without separate Owner publication approval.

## Fail-closed conditions

The orchestrator rejects canonical checkout use, wrong baseline, worktree drift, branch collisions, extra or missing staged paths, multiple/unbound commits, remote-ref drift, non-Draft/closed/merged PRs, wrong base/head, changed-file drift, pending/failed checks, Preview SHA/state drift, evidence/package tampering, and private fields.

## Rollback and review boundary

Before merge, close the Draft PR and remove the publication branch only through a separately approved cleanup. The disposable worktree is kept until receipt and CasePilot import verification finish, then may be removed only if it is owned by the run and clean. After merge or Production, use normal reviewed revert/deployment governance; Wave 3 does not automate either action.
