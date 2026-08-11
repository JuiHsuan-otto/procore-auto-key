import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  CARKEY_REPOSITORY, HANDOFF_VERSION, PREVIEW_ENVIRONMENT, PRODUCTION_ENVIRONMENT,
  applyPreviewHandoff, assertDisposableWorktree, blankFieldHash, canonicalJson,
  changedPathsHash, createFailureReceipt, createPreviewReceipt, createProductionReceipt,
  publicationBranch, selectExactDeployment, sha256, validateHandoff,
  validatePreviewReceipt, validateProductionReceipt
} from "./publication-v2.mjs";
import { CASEPILOT_PUBLICATION_ORIGIN, assertAuthorizedMergeParents, assertMergeAuthorityFresh, assertWithinWorkerDeadline, downloadApprovedAssets, githubOidcToken, normalizeChecks, originUrl, rebuildAuthorizedAssetManifest, verifyPreviewAccess } from "./casepilot-publication-worker.mjs";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const BASE_SHA = "1".repeat(40);
const HEAD_SHA = "2".repeat(40);
const TREE_SHA = "3".repeat(40);

async function fixtureHandoff() {
  const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#126f55" } }).png().toBuffer();
  const jobId = "pub_0123456789ab";
  const claimId = "12345678-1234-4123-8123-123456789abc";
  const mediaId = "med_abcdef123456";
  const handoff = {
    schemaVersion: HANDOFF_VERSION, sourceKind: "owner_attested_real", phase: "preview", jobId, claimId,
    claimExpiresAt: "2026-08-11T12:30:00.000Z", handoffHash: "",
    repository: { fullName: CARKEY_REPOSITORY, baseBranch: "main" },
    candidateId: "cdt_123456789abc", candidateHash: "4".repeat(64), sourceHash: "5".repeat(64),
    bindingHash: "6".repeat(64), previewApprovalHash: "7".repeat(64),
    taxonomy: { vehicle: { year: 2020, brand: "Volkswagen", model: "T-Cross" }, serviceLabel: "新增備份鑰匙", region: "臺中市", relatedRoutes: ["/cases", "/rescue-request"] },
    website: {
      seoTitle: "2020 Volkswagen T-Cross 新增備份鑰匙",
      metaDescription: "臺中車主的 Volkswagen T-Cross 備份鑰匙案例，整理到場評估、匹配與功能確認流程。",
      proposedSlug: "volkswagen-t-cross-spare-key-case",
      canonicalUrl: "https://www.carkey.com.tw/volkswagen-t-cross-spare-key-case",
      heroMediaIds: [mediaId], datePublished: "2026-08-11",
      sanitizedNarrative: "本案為 Volkswagen T-Cross 備份鑰匙需求。工作人員依實車狀態評估後，進行匹配與功能確認，實際適用方式仍以現場車況與鑰匙系統為準。",
      publicSafeFacts: ["車型與年份已依車主公開授權內容整理", "完成後會核對基本功能是否正常"],
      faq: [
        { question: "備份鑰匙需要攜帶什麼？", answer: "建議先提供車型與年份，實際需求由技師現場確認。" },
        { question: "處理時間需要多久？", answer: "時間會依車況、系統與現場條件不同，請先聯繫評估。" }
      ],
      imageAlt: "Volkswagen T-Cross 備份鑰匙到場處理案例",
      suggestedInternalLinks: [{ route: "/cases", anchor: "查看更多案例" }, { route: "/rescue-request", anchor: "聯繫到場評估" }],
      breadcrumb: [{ name: "首頁", item: "/" }, { name: "案例", item: "/cases" }, { name: "T-Cross 備份鑰匙", item: "/volkswagen-t-cross-spare-key-case" }],
      schemaHeadline: "2020 Volkswagen T-Cross 備份鑰匙到場案例",
      compatibilityNotes: ["實際相容性以實車評估結果為準"]
    },
    assets: [{ mediaId, sha256: sha256(bytes), mime: "image/png", byteLength: bytes.length, width: 400, height: 300, altText: "Volkswagen T-Cross 備份鑰匙案例照片", downloadPath: `/api/publication/worker/media/${mediaId}?jobId=${jobId}&claimId=${claimId}&phase=preview` }],
    previewReceipt: null, productionAuthorization: null
  };
  handoff.handoffHash = blankFieldHash(handoff, "handoffHash");
  return { handoff, bytes };
}

function successfulChecks() {
  const items = [
    { name: "Static site release gates", conclusion: "success", required: true, detailsUrl: "https://github.com/checks/1" },
    { name: "Vercel", conclusion: "success", required: true, detailsUrl: "https://github.com/checks/2" }
  ];
  return { requiredStatus: "success", checksDigest: sha256(canonicalJson(items)), items };
}

function makePreviewReceipt(handoff, generated = null) {
  const changedPaths = generated?.changedPaths ?? ["blog.json", "cases.json", "img/cases/cdt_123456789abc/med_abcdef123456.webp", "sitemap.xml", "volkswagen-t-cross-spare-key-case.html"];
  const publicResult = generated
    ? { publicationPath: generated.publicationPath, canonicalUrl: generated.canonicalUrl, contentSha256: generated.contentSha256, assetManifestHash: generated.assetManifestHash, schemaTypes: generated.schemaTypes, sitemapIncluded: true, httpStatus: 200, noindexVerified: true }
    : { publicationPath: "/volkswagen-t-cross-spare-key-case", canonicalUrl: "https://www.carkey.com.tw/volkswagen-t-cross-spare-key-case", contentSha256: "8".repeat(64), assetManifestHash: "9".repeat(64), schemaTypes: ["Article", "BreadcrumbList", "FAQPage"], sitemapIncluded: true, httpStatus: 200, noindexVerified: true };
  return createPreviewReceipt({
    jobId: handoff.jobId, claimId: handoff.claimId, handoffHash: handoff.handoffHash,
    candidateHash: handoff.candidateHash, sourceHash: handoff.sourceHash, bindingHash: handoff.bindingHash,
    previewApprovalHash: handoff.previewApprovalHash,
    repository: { fullName: CARKEY_REPOSITORY, baseBranch: "main", baseSha: BASE_SHA, featureBranch: publicationBranch(handoff), headSha: HEAD_SHA, treeSha: TREE_SHA, changedPaths, changedPathsHash: changedPathsHash(changedPaths) },
    pullRequest: { number: 42, url: `https://github.com/${CARKEY_REPOSITORY}/pull/42`, state: "OPEN", draft: true, baseRef: "main", baseSha: BASE_SHA, headSha: HEAD_SHA },
    checks: successfulChecks(),
    previewDeployment: { githubDeploymentId: 5821255618, githubDeploymentStatusId: 5821255620, environment: PREVIEW_ENVIRONMENT, environmentUrl: "https://preview-procore-auto-key.vercel.app", sourceSha: HEAD_SHA, state: "success", providerDeploymentId: null, providerDeploymentIdStatus: "unavailable", accessMode: "anonymous_verified" },
    publicResult, previewVerificationHash: "", createdAt: "2026-08-11T12:01:00.000Z"
  });
}

test("Mobile DTO Preview handoff round-trips without brand text in Owner SEO title", async () => {
  const { handoff } = await fixtureHandoff();
  assert.equal(validateHandoff(handoff, NOW), handoff);
  assert.equal(publicationBranch(handoff), "publication/case-123456789abc-job-0123456789ab");
  const tampered = structuredClone(handoff);
  tampered.website.sanitizedNarrative += " 姓名：王某";
  tampered.handoffHash = blankFieldHash(tampered, "handoffHash");
  assert.throws(() => validateHandoff(tampered, NOW), { code: "PUBLICATION_PRIVATE_DATA_REJECTED" });
  const synthetic = structuredClone(handoff);
  synthetic.sourceKind = "synthetic";
  synthetic.handoffHash = blankFieldHash(synthetic, "handoffHash");
  assert.throws(() => validateHandoff(synthetic, NOW), { code: "PUBLICATION_HANDOFF_INVALID" });
  const privateFrequency = structuredClone(handoff);
  privateFrequency.website.publicSafeFacts[0] = "頻率：315 MHz";
  privateFrequency.handoffHash = blankFieldHash(privateFrequency, "handoffHash");
  assert.throws(() => validateHandoff(privateFrequency, NOW), { code: "PUBLICATION_PRIVATE_DATA_REJECTED" });
  const privateAmount = structuredClone(handoff);
  privateAmount.website.publicSafeFacts[0] = "費用：NT$ 4,500";
  privateAmount.handoffHash = blankFieldHash(privateAmount, "handoffHash");
  assert.throws(() => validateHandoff(privateAmount, NOW), { code: "PUBLICATION_PRIVATE_DATA_REJECTED" });
  const overlong = structuredClone(handoff);
  overlong.website.seoTitle = "長".repeat(70);
  overlong.handoffHash = blankFieldHash(overlong, "handoffHash");
  assert.throws(() => validateHandoff(overlong, NOW), { code: "PUBLICATION_PUBLIC_COPY_INVALID" });
  const oversizedAsset = structuredClone(handoff);
  oversizedAsset.assets[0].byteLength = 4_000_001;
  oversizedAsset.handoffHash = blankFieldHash(oversizedAsset, "handoffHash");
  assert.throws(() => validateHandoff(oversizedAsset, NOW), { code: "PUBLICATION_ASSET_INVALID" });
});

test("terminal retry uses the same job branch while a new job gets a new deterministic branch", async () => {
  const { handoff } = await fixtureHandoff();
  const same = publicationBranch(handoff);
  assert.equal(publicationBranch(structuredClone(handoff)), same);
  const next = structuredClone(handoff);
  next.jobId = "pub_fedcba987654";
  assert.notEqual(publicationBranch(next), same);
});

test("OIDC token can only be sent to the compiled CasePilot origin and is refreshed", async () => {
  assert.equal(originUrl(`${CASEPILOT_PUBLICATION_ORIGIN}/`), CASEPILOT_PUBLICATION_ORIGIN);
  assert.throws(() => originUrl("https://evil.example/"), { code: "PUBLICATION_ORIGIN_INVALID" });
  const oldUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const oldToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  process.env.ACTIONS_ID_TOKEN_REQUEST_URL = "https://token.actions.example/oidc";
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = "request-token";
  let calls = 0;
  try {
    const mock = async (url, init) => {
      calls += 1;
      assert.equal(new URL(url).searchParams.get("audience"), "casepilot-publication");
      assert.equal(init.headers.Authorization, "Bearer request-token");
      return Response.json({ value: `header.payload.signature${calls}` });
    };
    const first = await githubOidcToken(mock);
    const second = await githubOidcToken(mock);
    assert.notEqual(first, second);
    assert.equal(calls, 2);
  } finally {
    if (oldUrl === undefined) delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL; else process.env.ACTIONS_ID_TOKEN_REQUEST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN; else process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = oldToken;
  }
  assert.throws(() => assertWithinWorkerDeadline(100, 100), { code: "PUBLICATION_WORKER_DEADLINE" });
});

test("OIDC media download binds origin, claim, MIME, length and SHA", async () => {
  const { handoff, bytes } = await fixtureHandoff();
  const calls = [];
  const media = await downloadApprovedAssets({ handoff, origin: "https://preview.casepilot.example", token: "jwt", fetchImpl: async (url, init) => {
    calls.push({ url: String(url), authorization: init.headers.Authorization });
    return new Response(bytes, { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(bytes.length), "Cache-Control": "no-store" } });
  } });
  assert.deepEqual(media.get(handoff.assets[0].mediaId), bytes);
  assert.equal(calls[0].authorization, "Bearer jwt");
  assert.match(calls[0].url, /jobId=pub_0123456789ab/);
});

test("approved media is rejected before an unbounded or mismatched body can be buffered", async () => {
  const { handoff, bytes } = await fixtureHandoff();
  let missingLengthBodyRead = false;
  const missingLengthResponse = {
    ok: true,
    status: 200,
    headers: new Headers({ "Content-Type": "image/png" }),
    get body() {
      missingLengthBodyRead = true;
      throw new Error("body must not be requested without Content-Length");
    }
  };
  await assert.rejects(
    downloadApprovedAssets({ handoff, origin: "https://preview.casepilot.example", token: "jwt", fetchImpl: async () => missingLengthResponse }),
    { code: "PUBLICATION_MEDIA_LENGTH_REQUIRED" }
  );
  assert.equal(missingLengthBodyRead, false);

  let cancelled = false;
  let pulls = 0;
  await assert.rejects(
    downloadApprovedAssets({ handoff, origin: "https://preview.casepilot.example", token: "jwt", fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue(pulls === 1 ? bytes : new Uint8Array([0]));
      },
      cancel() { cancelled = true; }
    }), { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(bytes.length) } }) }),
    { code: "PUBLICATION_MEDIA_TOO_LARGE" }
  );
  assert.equal(cancelled, true);
});

test("exact deployment selection ignores Preview – repo", () => {
  const deployments = [{ id: 10, environment: "Preview – repo", sha: HEAD_SHA }, { id: 11, environment: PREVIEW_ENVIRONMENT, sha: HEAD_SHA }];
  const statuses = new Map([[11, [{ id: 12, state: "success", environment_url: "https://preview-procore-auto-key.vercel.app" }]]]);
  assert.equal(selectExactDeployment(deployments, statuses, { environment: PREVIEW_ENVIRONMENT, sourceSha: HEAD_SHA }).githubDeploymentId, 11);
  const hostileStatuses = new Map([[11, [{ id: 12, state: "success", environment_url: "https://evil.example" }]]]);
  assert.throws(() => selectExactDeployment(deployments, hostileStatuses, { environment: PREVIEW_ENVIRONMENT, sourceSha: HEAD_SHA }), { code: "PUBLICATION_DEPLOYMENT_NOT_READY" });
});

test("Production merge parentage preserves the exact Owner-authorized base and head", () => {
  const mergeSha = "4".repeat(40);
  assert.doesNotThrow(() => assertAuthorizedMergeParents({
    mergeSha,
    parentLine: `${mergeSha} ${BASE_SHA} ${HEAD_SHA}`,
    authorizedBaseSha: BASE_SHA,
    authorizedHeadSha: HEAD_SHA
  }));

  const advancedBase = "5".repeat(40);
  assert.throws(() => assertAuthorizedMergeParents({
    mergeSha,
    parentLine: `${mergeSha} ${advancedBase} ${HEAD_SHA}`,
    authorizedBaseSha: BASE_SHA,
    authorizedHeadSha: HEAD_SHA
  }), { code: "PUBLICATION_MERGE_PARENT_MISMATCH" });

  assert.throws(() => assertAuthorizedMergeParents({
    mergeSha,
    parentLine: `${mergeSha} ${BASE_SHA} ${"6".repeat(40)}`,
    authorizedBaseSha: BASE_SHA,
    authorizedHeadSha: HEAD_SHA
  }), { code: "PUBLICATION_MERGE_PARENT_MISMATCH" });

  assert.throws(() => assertAuthorizedMergeParents({
    mergeSha,
    parentLine: `${mergeSha} ${BASE_SHA}`,
    authorizedBaseSha: BASE_SHA,
    authorizedHeadSha: HEAD_SHA
  }), { code: "PUBLICATION_MERGE_PARENT_MISMATCH" });
});

test("Production claim and second Owner authorization are fresh at the merge sink", () => {
  const handoff = {
    claimExpiresAt: "2026-08-11T12:30:00.000Z",
    productionAuthorization: { authorizedAt: "2026-08-11T12:00:00.000Z", expiresAt: "2026-08-11T12:30:00.000Z", revoked: false }
  };
  assert.doesNotThrow(() => assertMergeAuthorityFresh(handoff, new Date("2026-08-11T12:29:59.999Z")));
  assert.throws(() => assertMergeAuthorityFresh(handoff, new Date("2026-08-11T12:30:00.000Z")), { code: "PUBLICATION_MERGE_AUTHORITY_EXPIRED" });
  const futureAuthorization = structuredClone(handoff);
  futureAuthorization.productionAuthorization.authorizedAt = "2026-08-11T12:31:00.000Z";
  assert.throws(() => assertMergeAuthorityFresh(futureAuthorization, NOW), { code: "PUBLICATION_MERGE_AUTHORITY_EXPIRED" });
});

test("Vercel SSO Preview is recorded as protected without accepting the login page as content", async () => {
  const result = await verifyPreviewAccess({
    deploymentUrl: "https://preview-procore-auto-key.vercel.app",
    generated: { publicationPath: "/case", canonicalUrl: "https://www.carkey.com.tw/case", contentSha256: "1".repeat(64), assetManifestHash: "2".repeat(64), schemaTypes: ["Article", "BreadcrumbList", "FAQPage"], assetManifest: [] },
    fetchImpl: async () => new Response(null, { status: 302, headers: { Location: "https://vercel.com/sso-api?url=preview", "x-vercel-id": "hkg1::test" } })
  });
  assert.equal(result.accessMode, "vercel_sso_protected");
  assert.equal(result.publicResult.httpStatus, 302);
  assert.equal(result.publicResult.noindexVerified, false);
});

test("Preview and Production receipts bind exact GitHub deployment evidence", async () => {
  const { handoff } = await fixtureHandoff();
  const preview = makePreviewReceipt(handoff);
  assert.equal(validatePreviewReceipt(preview).previewDeployment.providerDeploymentId, null);
  const publicResult = { publicationPath: preview.publicResult.publicationPath, canonicalUrl: preview.publicResult.canonicalUrl, contentSha256: preview.publicResult.contentSha256, assetManifestHash: preview.publicResult.assetManifestHash, schemaTypes: preview.publicResult.schemaTypes, sitemapIncluded: true, httpStatus: 200 };
  const production = createProductionReceipt({
    jobId: handoff.jobId, claimId: handoff.claimId, handoffHash: handoff.handoffHash,
    candidateHash: handoff.candidateHash, sourceHash: handoff.sourceHash, bindingHash: handoff.bindingHash,
    previewReceiptHash: preview.receiptHash, authorizationHash: "a".repeat(64),
    repository: { fullName: CARKEY_REPOSITORY, baseBranch: "main", mainBeforeSha: BASE_SHA, authorizedHeadSha: HEAD_SHA, mergeSha: "b".repeat(40), mainAfterSha: "b".repeat(40) },
    pullRequest: { number: 42, url: `https://github.com/${CARKEY_REPOSITORY}/pull/42`, mergedAt: "2026-08-11T12:10:00.000Z", mergeMethod: "merge" },
    productionDeployment: { githubDeploymentId: 600, githubDeploymentStatusId: 601, environment: PRODUCTION_ENVIRONMENT, environmentUrl: "https://production-procore-auto-key.vercel.app", sourceSha: "b".repeat(40), state: "success", providerDeploymentId: null, providerDeploymentIdStatus: "unavailable", accessMode: "vercel_sso_protected" },
    publicResult, productionVerificationHash: "", rollback: { mode: "revert_pr", automaticRollbackPerformed: false, previousGithubDeploymentId: 599 }, createdAt: "2026-08-11T12:11:00.000Z"
  });
  assert.equal(validateProductionReceipt(production).productionDeployment.environment, PRODUCTION_ENVIRONMENT);
  const wrong = structuredClone(production);
  wrong.productionDeployment.environment = "Production – repo";
  wrong.productionVerificationHash = sha256(canonicalJson({ repository: wrong.repository, pullRequest: wrong.pullRequest, productionDeployment: wrong.productionDeployment, publicResult: wrong.publicResult, rollback: wrong.rollback }));
  wrong.receiptHash = blankFieldHash(wrong, "receiptHash");
  assert.throws(() => validateProductionReceipt(wrong), { code: "PUBLICATION_PRODUCTION_DEPLOYMENT_INVALID" });
  const unknownProviderStatus = structuredClone(production);
  unknownProviderStatus.productionDeployment.providerDeploymentIdStatus = "unknown";
  unknownProviderStatus.productionVerificationHash = sha256(canonicalJson({ repository: unknownProviderStatus.repository, pullRequest: unknownProviderStatus.pullRequest, productionDeployment: unknownProviderStatus.productionDeployment, publicResult: unknownProviderStatus.publicResult, rollback: unknownProviderStatus.rollback }));
  unknownProviderStatus.receiptHash = blankFieldHash(unknownProviderStatus, "receiptHash");
  assert.throws(() => validateProductionReceipt(unknownProviderStatus), { code: "PUBLICATION_PRODUCTION_DEPLOYMENT_INVALID" });
  const unsortedPaths = structuredClone(preview);
  unsortedPaths.repository.changedPaths.reverse();
  unsortedPaths.previewVerificationHash = sha256(canonicalJson({ repository: unsortedPaths.repository, pullRequest: unsortedPaths.pullRequest, checks: unsortedPaths.checks, previewDeployment: unsortedPaths.previewDeployment, publicResult: unsortedPaths.publicResult }));
  unsortedPaths.receiptHash = blankFieldHash(unsortedPaths, "receiptHash");
  assert.throws(() => validatePreviewReceipt(unsortedPaths), { code: "PUBLICATION_PREVIEW_RECEIPT_INVALID" });
});

test("Production handoff binds second authorization to exact Preview", async () => {
  const { handoff: previewHandoff } = await fixtureHandoff();
  const receipt = makePreviewReceipt(previewHandoff);
  const authorization = { authorizationHash: "", idempotencyKey: "prod-auth-123", authorizedAt: "2026-08-11T12:02:00.000Z", expiresAt: "2026-08-11T12:30:00.000Z", candidateHash: previewHandoff.candidateHash, bindingHash: previewHandoff.bindingHash, previewReceiptHash: receipt.receiptHash, prNumber: 42, headSha: HEAD_SHA, baseSha: BASE_SHA, previewGithubDeploymentId: receipt.previewDeployment.githubDeploymentId, previewUrl: receipt.previewDeployment.environmentUrl, revoked: false };
  authorization.authorizationHash = blankFieldHash(authorization, "authorizationHash");
  const handoff = { ...structuredClone(previewHandoff), phase: "production", claimId: "87654321-4321-4321-8321-cba987654321", previewReceipt: receipt, productionAuthorization: authorization };
  handoff.assets[0].downloadPath = `/api/publication/worker/media/${handoff.assets[0].mediaId}?jobId=${handoff.jobId}&claimId=${handoff.claimId}&phase=production`;
  handoff.handoffHash = "";
  handoff.handoffHash = blankFieldHash(handoff, "handoffHash");
  assert.equal(validateHandoff(handoff, NOW).productionAuthorization.baseSha, BASE_SHA);
});

test("real apply generates exact page, schema, sitemap and metadata-stripped asset", async () => {
  const { handoff, bytes } = await fixtureHandoff();
  const source = await mkdtemp(path.join(os.tmpdir(), "carkey-v2-source-"));
  const worktree = await mkdtemp(path.join(os.tmpdir(), "carkey-v2-worktree-"));
  try {
    await writeFile(path.join(source, "publish_tool.py"), await readFile(path.resolve("publish_tool.py")));
    await writeFile(path.join(source, "rescue-request.html"), '<body><a href="tel:+886000000000">電話</a><a href="https://line.me/R/ti/p/example">LINE</a></body>');
    await writeFile(path.join(source, "index.html"), "<body>index</body>");
    await writeFile(path.join(source, "cases.html"), "<body>cases</body>");
    await writeFile(path.join(source, "blog.html"), "<body>blog</body>");
    await writeFile(path.join(source, "blog.json"), "[]\n");
    await writeFile(path.join(source, "cases.json"), "[]\n");
    await writeFile(path.join(source, "sitemap.xml"), '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: source });
    execFileSync("git", ["add", "."], { cwd: source });
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: source });
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
    await rm(worktree, { recursive: true, force: true });
    execFileSync("git", ["worktree", "add", "--detach", worktree, base], { cwd: source, stdio: "ignore" });
    assertDisposableWorktree(worktree, source, base);
    const generated = await applyPreviewHandoff({ handoff, worktreeRoot: worktree, mediaById: new Map([[handoff.assets[0].mediaId, bytes]]), now: NOW });
    assert.equal(generated.assetManifest.length, 1);
    const rebuiltManifest = await rebuildAuthorizedAssetManifest({
      handoff,
      changedPaths: generated.changedPaths,
      readAssetBytes: (assetPath) => readFile(path.join(worktree, assetPath))
    });
    assert.equal(sha256(canonicalJson(rebuiltManifest)), generated.assetManifestHash);
    const html = await readFile(path.join(worktree, "volkswagen-t-cross-spare-key-case.html"), "utf8");
    assert.match(html, /2020 Volkswagen T-Cross/);
    assert.match(html, /極致核心 ProCore/);
    assert.doesNotMatch(html, /CasePilot/i);
  } finally {
    try { execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: source, stdio: "ignore" }); } catch {}
    await rm(source, { recursive: true, force: true });
    await rm(worktree, { recursive: true, force: true });
  }
});

test("worker source has no admin bypass, direct main push or Vercel production command", async () => {
  const source = await readFile(new URL("./casepilot-publication-worker.mjs", import.meta.url), "utf8");
  const workflow = await readFile(new URL("../../.github/workflows/casepilot-publication.yml", import.meta.url), "utf8");
  assert.doesNotMatch(source, /--admin/);
  assert.doesNotMatch(source, /vercel\s+(?:deploy|promote|--prod)/i);
  assert.doesNotMatch(source, /HEAD:refs\/heads\/main/);
  assert.match(source, /--match-head-commit/);
  assert.match(source, /"revert", "-m", "1", "--no-edit"/);
  assert.match(source, /PUBLICATION_ROLLBACK_VERIFY_FAILED/);
  assert.match(source, /assertMergeAuthorityFresh\(handoff\);[\s\S]*?gh[\s\S]*?"pr", "merge"/);
  assert.doesNotMatch(source, /if \(cause\?\.code === "PUBLICATION_RECEIPT_POST_FAILED"\) throw cause/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4/);
  assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4/);
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+\b/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.doesNotMatch(workflow.match(/env:\n([\s\S]*?)\n\n    steps:/)?.[1] ?? "", /GH_TOKEN/);
  const failure = createFailureReceipt({ phase: "production", handoff: (await fixtureHandoff()).handoff, code: "PUBLICATION_BASE_DRIFT", retryable: false, detail: "main changed", createdAt: "2026-08-11T12:10:00.000Z" });
  assert.equal(failure.failure.code, "PUBLICATION_BASE_DRIFT");
  assert.equal(failure.failure.stage, "pre_merge");
  assert.equal(failure.rollback.status, "not_required");
});

test("PR check normalization requires Static site release gates", () => {
  assert.equal(normalizeChecks([{ __typename: "CheckRun", name: "Static site release gates", status: "COMPLETED", conclusion: "SUCCESS", detailsUrl: null }, { __typename: "StatusContext", context: "Vercel", state: "SUCCESS", targetUrl: null }]).requiredStatus, "success");
  assert.throws(() => normalizeChecks([{ __typename: "StatusContext", context: "Vercel", state: "SUCCESS", targetUrl: null }]), { code: "PUBLICATION_REQUIRED_CHECK_MISSING" });
});
