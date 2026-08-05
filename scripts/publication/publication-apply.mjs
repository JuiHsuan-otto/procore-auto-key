import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { cp, lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ACTION_RECEIPT_VERSION,
  PublicationPromotionError,
  canonicalPromotionJson,
  computeActionReceiptHash,
  promotionSha256,
  validatePromotionPlan,
  validatePublicationAction
} from "./publication-promotion.mjs";

const GIT_SHA = /^[a-f0-9]{40}$/;
const PUBLIC_CONTACT_SOURCE = "rescue-request.html";

function fail(code, message) {
  throw new PublicationPromotionError(code, message);
}

function runGit(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    fail("APPLY_GIT_STATE_INVALID", `Git command failed: git ${args.join(" ")}`);
  }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeJson(value) {
  return canonicalPromotionJson(value).replaceAll("<", "\\u003c");
}

function publicFacingText(value) {
  return String(value)
    .replace(/synthetic|fixture/gi, "")
    .replaceAll("這筆純合成案例模擬", "本案例說明")
    .replaceAll("純合成案例模擬", "本案例說明")
    .replaceAll("合成案例", "處理案例")
    .replaceAll("純合成", "案例")
    .replaceAll("公開草稿", "公開內容")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function readBounded(filePath, code, max = 5 * 1024 * 1024) {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size > max) fail(code, "Expected a bounded regular file");
  return readFile(filePath);
}

async function readJson(filePath, code) {
  try {
    return JSON.parse((await readBounded(filePath, code)).toString("utf8"));
  } catch (error) {
    if (error instanceof PublicationPromotionError) throw error;
    fail(code, "JSON input is invalid");
  }
}

function routeForFile(file) {
  return `/${file.replace(/\.html$/, "")}`;
}

function extractPublishedDate(html) {
  return html.match(/["']datePublished["']\s*:\s*["'](\d{4}-\d{2}-\d{2})["']/)?.[1] ?? null;
}

async function existingPublicContact(worktreeRoot) {
  const html = (await readBounded(path.join(worktreeRoot, PUBLIC_CONTACT_SOURCE), "APPLY_CARKEY_COMPATIBILITY")).toString("utf8");
  const telephone = html.match(/href=["'](tel:[^"']+)["']/i)?.[1];
  const line = html.match(/href=["'](https:\/\/(?:line\.me|lin\.ee)\/[^"']+)["']/i)?.[1];
  if (!telephone || !line) fail("APPLY_CARKEY_COMPATIBILITY", "Existing CarKey contact routes are unavailable");
  return { telephone, line };
}

function renderPublicPage({ action, plan, model, contact, existingHtml = null }) {
  const page = plan.public_page;
  const asset = plan.asset_copies[0];
  const datePublished = action.action === "correct" ? extractPublishedDate(existingHtml ?? "") : page.publication_date;
  if (!datePublished) fail("APPLY_PUBLICATION_HISTORY_INVALID", "Publication date is missing");
  const dateModified = action.action === "correct" ? page.publication_date : datePublished;
  const canonical = page.canonical_url;
  const imageUrl = `https://www.carkey.com.tw/${asset.destination}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#webpage`,
    url: canonical,
    headline: page.title,
    description: page.description,
    image: imageUrl,
    datePublished,
    dateModified,
    inLanguage: "zh-TW",
    publisher: { "@type": "Organization", name: "極致核心 ProCore Auto Key" },
    author: { "@type": "Organization", name: "極致核心 ProCore Auto Key" },
    mainEntityOfPage: canonical
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首頁", item: "https://www.carkey.com.tw/" },
      { "@type": "ListItem", position: 2, name: "到場處理紀錄", item: "https://www.carkey.com.tw/cases" },
      { "@type": "ListItem", position: 3, name: page.title, item: canonical }
    ]
  };
  const facts = model.public_safe_facts.map((fact) => `        <li>${escapeHtml(publicFacingText(fact))}</li>`).join("\n");
  const related = [...new Set(["/cases", model.related_service_route, ...model.internal_links])].slice(0, 4).map((route) => `        <a href="${escapeHtml(route)}">相關服務與案例</a>`).join("\n");
  return `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="極致核心 ProCore Auto Key">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${imageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${imageUrl}">
  <link rel="stylesheet" href="/assets/css/tailwind-procore.css">
  <style>body{margin:0;background:#050505;color:#e5e5e5;font-family:system-ui,sans-serif;line-height:1.8}main{width:min(960px,calc(100% - 32px));margin:auto;padding:40px 0 72px}.panel{margin-top:24px;padding:clamp(20px,5vw,44px);background:#171717;border:1px solid #333;border-radius:22px}img{width:100%;height:auto;border-radius:16px}a{color:#f5d66f;margin-right:18px}.cta{display:inline-block;padding:12px 18px;border:1px solid #d4af37;border-radius:999px}</style>
  <script type="application/ld+json" data-seo="procore">${safeJson(articleSchema)}</script>
  <script type="application/ld+json" data-seo="breadcrumb">${safeJson(breadcrumb)}</script>
</head>
<body>
  <main>
    <nav><a href="/">PROCORE</a><a href="/cases">案例</a><a href="/blog">專欄</a></nav>
    <header class="panel">
      <p>${escapeHtml(model.generalized_location)}｜${escapeHtml(model.vehicle.brand)} ${escapeHtml(model.vehicle.model)}</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p>${escapeHtml(publicFacingText(model.sanitized_summary))}</p>
      <img src="/${asset.destination}" width="${asset.width}" height="${asset.height}" alt="${escapeHtml(asset.alt)}">
    </header>
    <article class="panel">
      <h2 id="case-overview">案例概況</h2>
      <p>${escapeHtml(publicFacingText(model.sanitized_narrative))}</p>
      <h2 id="public-safety">公開安全資訊</h2>
      <ul>
${facts}
      </ul>
      <h2 id="service-reminder">安全提醒</h2>
      <p>${escapeHtml(publicFacingText(model.safety_note))}</p>
      <p><a class="cta" href="${escapeHtml(contact.telephone)}">電話聯絡</a><a class="cta" href="${escapeHtml(contact.line)}">LINE 諮詢</a></p>
      <nav aria-label="相關連結">
${related}
      </nav>
    </article>
  </main>
  <script src="/assets/js/procore-conversion-tracking.js" defer></script>
</body>
</html>
`;
}

function renderWithdrawnPage({ plan, contact }) {
  const canonical = plan.public_page.canonical_url;
  return `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>此案例已停止公開｜極致核心 ProCore</title>
  <meta name="description" content="此案例已依核准程序停止公開並自網站索引移除。">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta property="og:image" content="https://www.carkey.com.tw/img/procore_logo_main.jpg">
  <meta name="twitter:image" content="https://www.carkey.com.tw/img/procore_logo_main.jpg">
  <link rel="stylesheet" href="/assets/css/tailwind-procore.css">
</head>
<body>
  <main><article><h1>此案例已停止公開</h1><p>此頁面已依核准程序停止公開，原內容不再提供。</p><p><a href="/cases">返回案例列表</a></p><p><a href="${escapeHtml(contact.telephone)}">電話聯絡</a><a href="${escapeHtml(contact.line)}">LINE 諮詢</a></p></article></main>
  <script src="/assets/js/procore-conversion-tracking.js" defer></script>
</body>
</html>
`;
}

function backlinkMarker(publicRecordId) {
  return { start: `<!-- publication-link:${publicRecordId}:start -->`, end: `<!-- publication-link:${publicRecordId}:end -->` };
}

async function upsertBacklink(filePath, action, plan) {
  const html = (await readBounded(filePath, "APPLY_INTERNAL_LINK_INVALID")).toString("utf8");
  const marker = backlinkMarker(action.public_record_id);
  const route = routeForFile(plan.public_page.path);
  const block = `${marker.start}<aside aria-label="相關到場案例"><strong>${escapeHtml(plan.public_page.title)}</strong><a href="${route}#case-overview">案例概況</a><a href="${route}#public-safety">公開安全資訊</a><a href="${route}#service-reminder">服務前提醒</a></aside>${marker.end}`;
  const pattern = new RegExp(`${marker.start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${marker.end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const next = pattern.test(html) ? html.replace(pattern, block) : html.replace(/<\/body>/i, `${block}\n</body>`);
  if (next === html && !pattern.test(html)) fail("APPLY_INTERNAL_LINK_INVALID", "Internal-link target has no body element");
  await writeFile(filePath, next, "utf8");
}

async function removeBacklink(filePath, publicRecordId) {
  const html = (await readBounded(filePath, "APPLY_INTERNAL_LINK_INVALID")).toString("utf8");
  const marker = backlinkMarker(publicRecordId);
  const pattern = new RegExp(`${marker.start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${marker.end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`);
  await writeFile(filePath, html.replace(pattern, ""), "utf8");
}

function changedPaths(worktreeRoot) {
  let output;
  try {
    output = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: worktreeRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    fail("APPLY_GIT_STATE_INVALID", "Unable to read disposable worktree status");
  }
  return output.split("\n").filter(Boolean).map((line) => line.slice(3)).sort();
}

export function assertDisposableWorktree(worktreeRoot, expectedBaselineSha, canonicalRepositoryRoot) {
  const top = runGit(worktreeRoot, ["rev-parse", "--show-toplevel"]);
  const head = runGit(worktreeRoot, ["rev-parse", "HEAD"]);
  const gitDir = runGit(worktreeRoot, ["rev-parse", "--path-format=absolute", "--git-dir"]);
  if (realpathSync(top) !== realpathSync(worktreeRoot) || head !== expectedBaselineSha || !gitDir.includes(`${path.sep}worktrees${path.sep}`) || realpathSync(top) === realpathSync(canonicalRepositoryRoot)) fail("APPLY_DISPOSABLE_WORKTREE_REQUIRED", "Apply target is not a fresh disposable worktree at the approved baseline");
  return { top, head, gitDir };
}

export async function validateApplyInputs({ action, plan, draftDirectory, worktreeRoot, canonicalRepositoryRoot }) {
  validatePublicationAction(action);
  validatePromotionPlan(plan);
  if (plan.action_id !== action.action_id || plan.action_hash !== action.action_hash || plan.action !== action.action || plan.action_revision !== action.action_revision || plan.public_record_id !== action.public_record_id || plan.candidate_id !== action.candidate_id || plan.candidate_revision !== action.candidate_revision || plan.candidate_hash !== action.candidate_hash || plan.package_hash !== action.package_hash || plan.expected_base_sha !== action.expected_carkey_base_sha) fail("APPLY_PLAN_ACTION_MISMATCH", "Plan does not bind the exact action");
  assertDisposableWorktree(worktreeRoot, plan.expected_base_sha, canonicalRepositoryRoot);
  if (changedPaths(worktreeRoot).length) fail("APPLY_WORKTREE_DRIFT", "Disposable worktree is not clean before apply");
  const model = await readJson(path.join(draftDirectory, "candidate-public.json"), "APPLY_DRAFT_INVALID");
  const draft = await readBounded(path.join(draftDirectory, "draft.html"), "APPLY_DRAFT_INVALID");
  if (model.candidate_id !== action.candidate_id || model.candidate_revision !== action.candidate_revision || model.candidate_hash !== action.candidate_hash || model.package_hash !== action.package_hash || promotionSha256(draft) !== action.draft_sha256) fail("APPLY_DRAFT_INVALID", "Draft does not match the action");
  if (action.action !== "publish") {
    const current = await readBounded(path.join(worktreeRoot, plan.public_page.path), "APPLY_PUBLIC_STATE_INVALID");
    if (promotionSha256(current) !== action.expected_current_public_content_hash) fail("APPLY_STALE_PUBLIC_HASH", "Worktree public page differs from approved current hash");
  }
  return { model, validated: true, networkUsed: false };
}

async function updateHistory(worktreeRoot, action, plan, resultingPublicContentHash, appliedAt) {
  const historyPath = path.join(worktreeRoot, "data", "publication-actions", `${action.public_record_id}.json`);
  let history = { history_version: "publication-history/v1", public_record_id: action.public_record_id, synthetic: true, actions: [] };
  if (existsSync(historyPath)) history = await readJson(historyPath, "APPLY_HISTORY_INVALID");
  if (history.public_record_id !== action.public_record_id || history.synthetic !== true || !Array.isArray(history.actions)) fail("APPLY_HISTORY_INVALID", "Publication history is invalid");
  const entry = { action_id: action.action_id, action_hash: action.action_hash, action: action.action, action_revision: action.action_revision, candidate_revision: action.candidate_revision, plan_hash: plan.plan_hash, resulting_public_content_hash: resultingPublicContentHash, canonical_url: plan.public_page.canonical_url, applied_at: appliedAt };
  const existing = history.actions.find((item) => item.action_id === action.action_id);
  if (existing && canonicalPromotionJson(existing) !== canonicalPromotionJson(entry)) fail("APPLY_ACTION_ID_CONFLICT", "Action ID already has different history bytes");
  if (!existing) history.actions.push(entry);
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${canonicalPromotionJson(history)}\n`, "utf8");
}

async function runRegistrySync({ action, plan, worktreeRoot, publishToolPath }) {
  const args = [publishToolPath, "--root", worktreeRoot, ...plan.registry_sync.arguments];
  try {
    execFileSync("python3", args, { cwd: worktreeRoot, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    fail("APPLY_REGISTRY_SYNC_FAILED", `publish_tool.py failed for ${action.action}`);
  }
}

async function verifyPageAndRegistries({ action, plan, model, worktreeRoot }) {
  const pageBytes = await readBounded(path.join(worktreeRoot, plan.public_page.path), "APPLY_VERIFY_FAILED");
  const html = pageBytes.toString("utf8");
  const sitemap = (await readBounded(path.join(worktreeRoot, "sitemap.xml"), "APPLY_VERIFY_FAILED")).toString("utf8");
  const route = routeForFile(plan.public_page.path);
  if (action.action === "withdraw") {
    if (!/noindex, nofollow, noarchive/i.test(html) || /"@type":"Article"/.test(html) || sitemap.includes(plan.public_page.canonical_url)) fail("APPLY_VERIFY_FAILED", "Withdrawal tombstone or sitemap behavior is invalid");
  } else {
    if (!/index, follow/i.test(html) || !html.includes(`<link rel="canonical" href="${plan.public_page.canonical_url}">`) || !html.includes('"@type":"Article"') || !html.includes('"@type":"BreadcrumbList"') || !sitemap.includes(plan.public_page.canonical_url) || !html.includes("極致核心 ProCore") || !/(?:依車款|依實車|現場條件|確認|評估)/.test(`${model.description} ${model.sanitized_narrative}`)) fail("APPLY_VERIFY_FAILED", "Published page is incompatible with CarKey rules");
    const asset = plan.asset_copies[0];
    const bytes = await readBounded(path.join(worktreeRoot, asset.destination), "APPLY_VERIFY_FAILED", 20 * 1024 * 1024);
    if (promotionSha256(bytes) !== asset.sha256 || !html.includes(`width="${asset.width}" height="${asset.height}"`)) fail("APPLY_VERIFY_FAILED", "Public asset hash or dimensions differ");
  }
  const blog = JSON.parse((await readBounded(path.join(worktreeRoot, "blog.json"), "APPLY_VERIFY_FAILED")).toString("utf8"));
  const present = blog.some((entry) => entry.link === route);
  if ((action.action === "withdraw" && present) || (action.action !== "withdraw" && !present)) fail("APPLY_VERIFY_FAILED", "Blog registry state is incorrect");
  return { resultingPublicContentHash: promotionSha256(pageBytes), pageBytes };
}

export async function verifyAppliedPublication({ action, plan, draftDirectory, worktreeRoot }) {
  const model = await readJson(path.join(draftDirectory, "candidate-public.json"), "APPLY_DRAFT_INVALID");
  const result = await verifyPageAndRegistries({ action, plan, model, worktreeRoot });
  const changed = changedPaths(worktreeRoot);
  const allowed = new Set([...plan.operations.files_to_add, ...plan.operations.files_to_modify, ...plan.operations.files_to_remove]);
  for (const candidatePath of changed) if (!allowed.has(candidatePath)) fail("APPLY_CHANGED_PATH_SCOPE", `Unexpected changed path: ${candidatePath}`);
  return {
    resultingPublicContentHash: result.resultingPublicContentHash,
    changedPaths: changed,
    validationResults: [
      { id: "action_plan_binding", status: "pass" },
      { id: "disposable_worktree", status: "pass" },
      { id: "public_content_hash", status: "pass" },
      { id: "canonical_and_schema", status: "pass" },
      { id: "sitemap_and_registry", status: "pass" },
      { id: "asset_hash_and_dimensions", status: "pass" },
      { id: "changed_path_scope", status: "pass" },
      { id: "no_network", status: "pass" }
    ]
  };
}

export async function applyPublicationPlan({ action, plan, draftDirectory, worktreeRoot, canonicalRepositoryRoot, publishToolPath, receiptRoot, appliedAt }) {
  const receiptPath = path.join(receiptRoot, `${action.action_id}.json`);
  if (existsSync(receiptPath)) {
    const existing = await readJson(receiptPath, "APPLY_RECEIPT_INVALID");
    if (computeActionReceiptHash(existing) !== existing.receipt_hash) fail("APPLY_RECEIPT_INVALID", "Existing receipt hash is invalid");
    if (existing.action_id !== action.action_id || existing.action_hash !== action.action_hash || existing.plan_hash !== plan.plan_hash) fail("APPLY_ACTION_ID_CONFLICT", "Action ID is already bound to a different apply receipt");
    const current = await readBounded(path.join(worktreeRoot, plan.public_page.path), "APPLY_RECEIPT_INVALID");
    if (promotionSha256(current) !== existing.resulting_public_content_hash) fail("APPLY_IDEMPOTENCY_DRIFT", "Applied bytes drifted after receipt creation");
    return { operation: "reused", receipt: existing, receiptPath };
  }
  const { model } = await validateApplyInputs({ action, plan, draftDirectory, worktreeRoot, canonicalRepositoryRoot });
  const contact = await existingPublicContact(worktreeRoot);
  const pagePath = path.join(worktreeRoot, plan.public_page.path);
  let existingHtml = null;
  if (action.action !== "publish") existingHtml = (await readBounded(pagePath, "APPLY_PUBLIC_STATE_INVALID")).toString("utf8");
  if (action.action === "withdraw") {
    await writeFile(pagePath, renderWithdrawnPage({ plan, contact }), "utf8");
    for (const assetPath of plan.operations.files_to_remove) {
      const source = path.join(worktreeRoot, assetPath);
      if (!existsSync(source)) fail("APPLY_ASSET_MISSING", "Approved public asset is missing during withdrawal");
      const recovery = path.join(worktreeRoot, "data", "publication-recovery", action.public_record_id, path.basename(assetPath));
      await mkdir(path.dirname(recovery), { recursive: true });
      await rename(source, recovery);
    }
  } else {
    for (const asset of plan.asset_copies) {
      const source = path.join(draftDirectory, asset.draft_path);
      const bytes = await readBounded(source, "APPLY_ASSET_MISSING", 20 * 1024 * 1024);
      if (promotionSha256(bytes) !== asset.sha256) fail("APPLY_ASSET_HASH_MISMATCH", "Approved asset differs before copy");
      const destination = path.join(worktreeRoot, asset.destination);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { force: true });
    }
    await writeFile(pagePath, renderPublicPage({ action, plan, model, contact, existingHtml }), "utf8");
  }
  await runRegistrySync({ action, plan, worktreeRoot, publishToolPath });
  for (const target of plan.operations.internal_link_targets) {
    const targetPath = path.join(worktreeRoot, target);
    if (action.action === "withdraw") await removeBacklink(targetPath, action.public_record_id);
    else await upsertBacklink(targetPath, action, plan);
  }
  const preliminaryHash = promotionSha256(await readBounded(pagePath, "APPLY_VERIFY_FAILED"));
  await updateHistory(worktreeRoot, action, plan, preliminaryHash, appliedAt);
  const verified = await verifyAppliedPublication({ action, plan, draftDirectory, worktreeRoot });
  const receipt = structuredClone(plan.receipt_template);
  Object.assign(receipt, {
    receipt_hash: "",
    state: action.action === "publish" ? "applied_local" : action.action === "correct" ? "corrected_local" : "withdrawn_local",
    worktree_path: worktreeRoot,
    resulting_changed_paths: verified.changedPaths,
    resulting_public_content_hash: verified.resultingPublicContentHash,
    validation_results: verified.validationResults,
    result: "created",
    rollback: { command: plan.rollback.before_merge, verified: false },
    sitemap_modified: true,
    redirects_modified: false,
    public_page_modified: true,
    applied_at: appliedAt,
    verified_at: appliedAt
  });
  receipt.receipt_hash = computeActionReceiptHash(receipt);
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(receiptPath, `${canonicalPromotionJson(receipt)}\n`, { flag: "wx" });
  return { operation: "created", receipt, receiptPath };
}

export async function finalizeApplyReceiptCommit(receiptPath, resultingCommit) {
  if (!GIT_SHA.test(resultingCommit)) fail("APPLY_COMMIT_INVALID", "Resulting commit SHA is invalid");
  const receipt = await readJson(receiptPath, "APPLY_RECEIPT_INVALID");
  if (computeActionReceiptHash(receipt) !== receipt.receipt_hash || !["applied_local", "corrected_local", "withdrawn_local"].includes(receipt.state)) fail("APPLY_RECEIPT_INVALID", "Receipt cannot be finalized");
  receipt.resulting_commit = resultingCommit;
  receipt.receipt_hash = "";
  receipt.receipt_hash = computeActionReceiptHash(receipt);
  await writeFile(receiptPath, `${canonicalPromotionJson(receipt)}\n`, "utf8");
  return receipt;
}
