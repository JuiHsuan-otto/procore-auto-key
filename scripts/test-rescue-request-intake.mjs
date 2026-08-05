#!/usr/bin/env node
/**
 * Structured service-inquiry regression gates for /rescue-request.
 *
 * The page is deliberately dependency-free static HTML with an inline script, so
 * this harness verifies it the same way: read the file, assert the contract that
 * matters, and execute the two privacy predicates directly.
 *
 * What is being protected here is not layout — it is the guarantee that a plate,
 * a phone number, a VIN or a street address can never reach the LINE deep-link
 * query string or the shareable draft fragment.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "rescue-request.html");

let failures = 0;
let checks = 0;

function check(label, condition) {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`FAIL ${label}`);
}

const html = await readFile(FILE, "utf8");

// --- Required inquiry fields -----------------------------------------------

const SERVICE_TYPES = [
  "鑰匙全丟",
  "新增備份",
  "智慧鑰匙新增",
  "遙控器故障",
  "未偵測到鑰匙",
  "車門開鎖",
  "鑰匙損壞",
  "其他"
];
for (const value of SERVICE_TYPES) {
  check(`service type option: ${value}`, html.includes(`name="issue" value="${value}"`));
}

for (const id of ["brand", "model", "year", "location", "notes"]) {
  check(`field present: ${id}`, html.includes(`id="${id}"`));
}

for (const group of ["haskey", "canstart", "parking", "photos"]) {
  check(`radio group present: ${group}`, html.includes(`name="${group}"`));
}

// --- Generated LINE message contract ---------------------------------------

const MESSAGE_LINES = [
  "【汽車鑰匙詢問】",
  "需求：",
  "車輛：",
  "年份：",
  "地區：",
  "目前是否有可用鑰匙：",
  "是否可發動：",
  "停放環境：",
  "補充說明："
];
for (const line of MESSAGE_LINES) {
  check(`message line: ${line}`, html.includes(line));
}

check(
  "LINE deep link uses the official OA message endpoint",
  html.includes("https://line.me/R/oaMessage/@420gknem/?")
);
check("message is URI-encoded before it enters the query string", html.includes("encodeURIComponent(text)"));

// --- No server submission ---------------------------------------------------

check("no fetch() call", !/\bfetch\s*\(/.test(html));
check("no XMLHttpRequest", !/XMLHttpRequest/.test(html));
check("no form action attribute", !/<form[^>]*\saction=/i.test(html));
check("form uses novalidate + JS handler only", html.includes("<form id=\"request-form\" novalidate>"));

// --- Branding and SEO must not regress --------------------------------------

check(
  "canonical unchanged",
  html.includes('<link rel="canonical" href="https://www.carkey.com.tw/rescue-request">')
);
check("WebPage schema retained", html.includes('"@type":"WebPage"'));
check("BreadcrumbList schema retained", html.includes('"@type":"BreadcrumbList"'));
check("ProCore branding retained", html.includes("極致核心 ProCore Auto Key"));
check("phone CTA retained", html.includes("tel:0909277670"));
check("privacy notice retained", html.includes("請保護個資"));

// --- Privacy predicates, executed ------------------------------------------

const unsafeSource = html.match(/const unsafe=s=>(\/.*?\/i)\.test/);
const addressSource = html.match(/const fullAddress=s=>(\/.*?\/i)\.test/);
check("unsafe predicate is extractable", Boolean(unsafeSource));
check("fullAddress predicate is extractable", Boolean(addressSource));

if (unsafeSource && addressSource) {
  const unsafeRe = new RegExp(
    unsafeSource[1].slice(1, unsafeSource[1].lastIndexOf("/")),
    "i"
  );
  const addressRe = new RegExp(
    addressSource[1].slice(1, addressSource[1].lastIndexOf("/")),
    "i"
  );
  const unsafe = (value) => unsafeRe.test(value);
  const fullAddress = (value) => addressRe.test(value);

  const mustBlock = [
    ["mobile number", "0912345678"],
    ["VIN", "JTDBR32E720012345"],
    ["plate", "ABC-1234"],
    ["plate without dash", "AB 1234"],
    ["explicit label 車牌", "車牌 1234"],
    ["name label", "車主姓名 王小明"],
    ["LINE id label", "line id abc123"]
  ];
  for (const [label, value] of mustBlock) {
    check(`blocks ${label}`, unsafe(value));
  }

  const mustBlockAddress = [
    ["house number", "中山路 100 號"],
    ["floor", "民生街 5 樓"],
    ["lane", "光復巷 12"]
  ];
  for (const [label, value] of mustBlockAddress) {
    check(`blocks address: ${label}`, fullAddress(value));
  }

  const mustAllow = [
    ["county only", "台中市西屯區"],
    ["county", "彰化縣"],
    ["brand", "Toyota"],
    ["model", "Corolla Cross"],
    ["plain note", "遙控器按了沒反應，插鑰匙可以發動"]
  ];
  for (const [label, value] of mustAllow) {
    check(`allows ${label}`, !unsafe(value) && !fullAddress(value));
  }
}

// --- Draft fragment ----------------------------------------------------------

check("draft stays in the URL fragment", html.includes("'#draft='"));
check("draft schema version bumped for the new fields", html.includes("d.v!==2"));
check(
  "notes are excluded from the draft unless explicitly opted in",
  html.includes("include-notes")
);

console.log(`CarKey structured inquiry gates: ${checks - failures}/${checks} passed`);
if (failures > 0) {
  console.error(`Errors: ${failures}`);
  process.exit(1);
}
