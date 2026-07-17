import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import vm from "node:vm";

const SOURCE_FILE = new URL("../assets/js/procore-conversion-tracking.js", import.meta.url);
const TEST_EVENT_VALUE = "generate_lead_98b16f5";
const source = await fsp.readFile(SOURCE_FILE, "utf8");

function runTrackingScenario(urlText, clickHref = "") {
  const url = new URL(urlText);
  const dataLayer = [];
  const storage = new Map();
  let clickHandler = null;

  const window = {
    dataLayer,
    location: {
      href: url.href,
      hostname: url.hostname,
      pathname: url.pathname,
      search: url.search,
    },
    sessionStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };
  const document = {
    title: "Tracking runtime test",
    head: { appendChild() {} },
    createElement() {
      return {};
    },
    getElementById() {
      return null;
    },
    addEventListener(name, handler) {
      if (name === "click") clickHandler = handler;
    },
  };

  vm.runInNewContext(source, { window, document, URL, URLSearchParams }, { filename: "procore-conversion-tracking.js" });

  if (clickHref) {
    const link = {
      getAttribute(name) {
        return name === "href" ? clickHref : "";
      },
      textContent: clickHref.startsWith("tel:") ? "電話諮詢" : "LINE 諮詢",
    };
    assert.equal(typeof clickHandler, "function", "click handler must be registered");
    clickHandler({ target: { closest: () => link } });
  }

  const objects = dataLayer.filter((item) => item && !Array.isArray(item) && typeof item === "object" && !(Symbol.iterator in item));
  const gtagCommands = dataLayer
    .filter((item) => item && typeof item.length === "number" && typeof item !== "string")
    .map((item) => Array.from(item));
  return { objects, gtagCommands };
}

function assertNoSensitiveUrlParts(result) {
  for (const item of result.objects) {
    if (!item.page_location) continue;
    assert.equal(item.page_location.includes("?"), false, "page_location must omit query strings");
    assert.equal(item.page_location.includes("#"), false, "page_location must omit fragments");
  }
  for (const command of result.gtagCommands) {
    const params = command[2];
    if (!params?.page_location) continue;
    assert.equal(params.page_location.includes("?"), false, "gtag page_location must omit query strings");
    assert.equal(params.page_location.includes("#"), false, "gtag page_location must omit fragments");
  }
}

function assertSanitizedConfig(result, expectedLocation) {
  const configCommands = result.gtagCommands.filter((item) => item[0] === "config" && item[1] === "G-KW1LHLVQHL");
  assert.equal(configCommands.length, 1, "GA4 must be configured exactly once");
  assert.equal(configCommands[0][2].page_location, expectedLocation, "GA4 config page_location must be sanitized");
  assert.equal(configCommands[0][2].page_path.includes("?"), false, "GA4 config page_path must omit query strings");
  assert.equal(configCommands[0][2].page_path.includes("#"), false, "GA4 config page_path must omit fragments");
}

const productionPhone = runTrackingScenario(
  `https://www.carkey.com.tw/rescue?customer_secret=abc#fragment_secret`,
  "tel:0909277670",
);
assert.equal(productionPhone.objects.filter((item) => item.event === "procore_phone_click").length, 1);
assert.equal(productionPhone.gtagCommands.filter((item) => item[0] === "event" && item[1] === "click_to_call").length, 1);
assert.equal(productionPhone.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assert.equal(productionPhone.objects[0].page_location, "https://www.carkey.com.tw/rescue");
assertSanitizedConfig(productionPhone, "https://www.carkey.com.tw/rescue");
assertNoSensitiveUrlParts(productionPhone);

const productionDiagnostic = runTrackingScenario(
  `https://www.carkey.com.tw/?ga4_test=${TEST_EVENT_VALUE}`,
);
assert.equal(productionDiagnostic.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assertSanitizedConfig(productionDiagnostic, "https://www.carkey.com.tw/");
assertNoSensitiveUrlParts(productionDiagnostic);

const loopbackDiagnostic = runTrackingScenario(
  `http://127.0.0.1:4173/index.html?ga4_test=${TEST_EVENT_VALUE}#ignored`,
);
assert.equal(loopbackDiagnostic.objects.filter((item) => item.event === "procore_ga4_test_lead").length, 1);
assert.equal(loopbackDiagnostic.gtagCommands.filter((item) => item[0] === "event" && item[1] === "generate_lead").length, 1);
assert.equal(loopbackDiagnostic.objects[0].page_location, "http://127.0.0.1:4173/index.html");
assertSanitizedConfig(loopbackDiagnostic, "http://127.0.0.1:4173/index.html");
assertNoSensitiveUrlParts(loopbackDiagnostic);

const productionLine = runTrackingScenario(
  "https://www.carkey.com.tw/article?utm_source=test#section",
  "https://line.me/R/ti/p/@420gknem?prefill=customer_secret#ignored",
);
assert.equal(productionLine.objects.filter((item) => item.event === "procore_line_click").length, 1);
assert.equal(productionLine.gtagCommands.filter((item) => item[0] === "event" && item[1] === "line_click").length, 1);
assert.equal(productionLine.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assert.equal(productionLine.objects[0].link_url, "https://line.me/R/ti/p/@420gknem");
assert.equal(productionLine.gtagCommands.find((item) => item[0] === "event" && item[1] === "line_click")[2].link_url, "https://line.me/R/ti/p/@420gknem");
assertSanitizedConfig(productionLine, "https://www.carkey.com.tw/article");
assertNoSensitiveUrlParts(productionLine);

console.log("Conversion tracking runtime tests passed: sanitized page views/events, click-only production events, loopback-only diagnostic lead");
