#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(path.join(root, "rescue-request.html"), "utf8");
let failures = 0;
let checks = 0;

function check(label, condition) {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.error(`FAIL ${label}`);
}

for (const value of ["鑰匙全丟", "新增備份", "智慧鑰匙新增", "遙控器故障", "未偵測到鑰匙", "車門開鎖", "鑰匙損壞", "其他"]) {
  check(`service option: ${value}`, html.includes(`name="issue" value="${value}"`));
}
for (const group of ["haskey", "canstart", "parking", "photos"]) {
  check(`required radio group: ${group}`, html.includes(`name="${group}"`));
}
for (const marker of ["【汽車鑰匙詢問】", "來源頁：", "詢問識別碼：", "需求：", "目前是否有可用鑰匙：", "是否可發動：", "停放環境："]) {
  check(`message contract: ${marker}`, html.includes(marker));
}
check("official LINE message endpoint", html.includes("https://line.me/R/oaMessage/@420gknem/?"));
check("message is URI encoded", html.includes("encodeURIComponent(text)"));
check("source accepts only a local slug", html.includes("/^[a-z0-9]+(?:-[a-z0-9]+)*$/"));
check("homepage source maps to the canonical root", html.includes("sourceSlug==='home'?'/'"));
check("request reference has CKW prefix", html.includes("'CKW-'"));
check("no form action", !/<form[^>]*\saction=/i.test(html));
check("no fetch", !/\bfetch\s*\(/.test(html));
check("no storage", !/localStorage|sessionStorage|document\.cookie/.test(html));

const unsafeSource = html.match(/const unsafe=s=>(\/.*?\/i)\.test/);
const addressSource = html.match(/const fullAddress=s=>(\/.*?\/i)\.test/);
check("unsafe predicate extractable", Boolean(unsafeSource));
check("address predicate extractable", Boolean(addressSource));
if (unsafeSource && addressSource) {
  const unsafe = new RegExp(unsafeSource[1].slice(1, unsafeSource[1].lastIndexOf("/")), "i");
  const address = new RegExp(addressSource[1].slice(1, addressSource[1].lastIndexOf("/")), "i");
  for (const [label, value] of [["mobile", "0912345678"], ["VIN", "JTDBR32E720012345"], ["plate", "ABC-1234"], ["name", "車主姓名 王小明"]]) {
    check(`blocks ${label}`, unsafe.test(value));
  }
  for (const [label, value] of [["street number", "中山路 100 號"], ["floor", "民生街 5 樓"]]) {
    check(`blocks ${label}`, address.test(value));
  }
  for (const [label, value] of [["area", "台中市西屯區"], ["model", "Corolla Cross"]]) {
    check(`allows ${label}`, !unsafe.test(value) && !address.test(value));
  }
}
check("draft remains in fragment", html.includes("'#draft='"));
check("draft schema v2", html.includes("draft.v!==2"));
check("notes require explicit opt-in", html.includes("include-notes"));

console.log(`CarKey structured inquiry gates: ${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
