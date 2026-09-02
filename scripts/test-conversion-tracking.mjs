import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import vm from "node:vm";

const SOURCE_FILE = new URL("../assets/js/procore-conversion-tracking.js", import.meta.url);
const TEST_EVENT_VALUE = "generate_lead_98b16f5";
const ALLOWED_ATTRIBUTION_PARAMS = new Set([
  "utm_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
]);
const source = await fsp.readFile(SOURCE_FILE, "utf8");

function runTrackingScenario(urlText, clickHref = "", documentEvent = "") {
  const url = new URL(urlText);
  const dataLayer = [];
  const storage = new Map();
  const documentHandlers = new Map();

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
      documentHandlers.set(name, handler);
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
    const clickHandler = documentHandlers.get("click");
    assert.equal(typeof clickHandler, "function", "click handler must be registered");
    clickHandler({ target: { closest: () => link } });
  }

  if (documentEvent) {
    const documentHandler = documentHandlers.get(documentEvent);
    assert.equal(typeof documentHandler, "function", `${documentEvent} handler must be registered`);
    documentHandler();
    documentHandler();
  }

  const objects = dataLayer.filter((item) => item && !Array.isArray(item) && typeof item === "object" && !(Symbol.iterator in item));
  const gtagCommands = dataLayer
    .filter((item) => item && typeof item.length === "number" && typeof item !== "string")
    .map((item) => Array.from(item));
  return { objects, gtagCommands };
}

function assertAttributionSafeLocations(result) {
  for (const item of result.objects) {
    if (!item.page_location) continue;
    assert.equal(item.page_location.includes("#"), false, "page_location must omit fragments");
    for (const name of new URL(item.page_location, "https://www.carkey.com.tw").searchParams.keys()) {
      assert.equal(ALLOWED_ATTRIBUTION_PARAMS.has(name), true, `unexpected page_location parameter: ${name}`);
    }
  }
  for (const command of result.gtagCommands) {
    const params = command[2];
    if (!params?.page_location) continue;
    assert.equal(params.page_location.includes("#"), false, "gtag page_location must omit fragments");
    for (const name of new URL(params.page_location, "https://www.carkey.com.tw").searchParams.keys()) {
      assert.equal(ALLOWED_ATTRIBUTION_PARAMS.has(name), true, `unexpected gtag page_location parameter: ${name}`);
    }
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
assertAttributionSafeLocations(productionPhone);

const productionDiagnostic = runTrackingScenario(
  `https://www.carkey.com.tw/?ga4_test=${TEST_EVENT_VALUE}`,
);
assert.equal(productionDiagnostic.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assertSanitizedConfig(productionDiagnostic, "https://www.carkey.com.tw/");
assertAttributionSafeLocations(productionDiagnostic);

const loopbackDiagnostic = runTrackingScenario(
  `http://127.0.0.1:4173/index.html?ga4_test=${TEST_EVENT_VALUE}#ignored`,
);
assert.equal(loopbackDiagnostic.objects.filter((item) => item.event === "procore_ga4_test_lead").length, 1);
assert.equal(loopbackDiagnostic.gtagCommands.filter((item) => item[0] === "event" && item[1] === "generate_lead").length, 1);
assert.equal(loopbackDiagnostic.objects[0].page_location, "http://127.0.0.1:4173/index.html");
assertSanitizedConfig(loopbackDiagnostic, "http://127.0.0.1:4173/index.html");
assertAttributionSafeLocations(loopbackDiagnostic);

const productionLine = runTrackingScenario(
  "https://www.carkey.com.tw/article?utm_source=newsletter&utm_medium=email&utm_campaign=summer&utm_content=hero&gclid=test-click-id&customer_secret=must-not-leak#section",
  "https://line.me/R/ti/p/@420gknem?prefill=customer_secret#ignored",
);
assert.equal(productionLine.objects.filter((item) => item.event === "procore_line_click").length, 1);
assert.equal(productionLine.gtagCommands.filter((item) => item[0] === "event" && item[1] === "line_click").length, 1);
assert.equal(productionLine.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assert.equal(productionLine.objects[0].link_url, "https://line.me/R/ti/p/@420gknem");
assert.equal(productionLine.gtagCommands.find((item) => item[0] === "event" && item[1] === "line_click")[2].link_url, "https://line.me/R/ti/p/@420gknem");
const expectedCampaignLocation = "https://www.carkey.com.tw/article?utm_source=newsletter&utm_medium=email&utm_campaign=summer&utm_content=hero&gclid=test-click-id";
assert.equal(productionLine.objects[0].page_location, expectedCampaignLocation);
assertSanitizedConfig(productionLine, expectedCampaignLocation);
assert.equal(productionLine.objects[0].page_location.includes("customer_secret"), false);
assertAttributionSafeLocations(productionLine);

const boundedAttribution = runTrackingScenario(
  `https://www.carkey.com.tw/article?utm_campaign=${"x".repeat(220)}&fbclid=not-allowlisted`,
);
const boundedConfigLocation = boundedAttribution.gtagCommands.find((item) => item[0] === "config")[2].page_location;
assert.equal(new URL(boundedConfigLocation).searchParams.get("utm_campaign").length, 160);
assert.equal(new URL(boundedConfigLocation).searchParams.has("fbclid"), false);
assertAttributionSafeLocations(boundedAttribution);

const structuredInquiry = runTrackingScenario(
  "https://www.carkey.com.tw/article-smart-key-troubleshooting?private=ignored",
  "/rescue-request?source=article-smart-key-troubleshooting",
);
assert.equal(structuredInquiry.objects.filter((item) => item.event === "procore_rescue_request_start").length, 1);
assert.equal(structuredInquiry.gtagCommands.filter((item) => item[0] === "event" && item[1] === "rescue_request_start").length, 1);
assert.equal(structuredInquiry.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assert.equal(structuredInquiry.objects[0].link_url, "/rescue-request");
assertAttributionSafeLocations(structuredInquiry);

const rescueMessageReady = runTrackingScenario(
  "https://www.carkey.com.tw/rescue-request?source=article-smart-key-troubleshooting",
  "",
  "procore:rescue-message-ready",
);
assert.equal(rescueMessageReady.objects.filter((item) => item.event === "procore_rescue_message_ready").length, 1);
assert.equal(rescueMessageReady.gtagCommands.filter((item) => item[0] === "event" && item[1] === "rescue_message_ready").length, 1);
assert.equal(rescueMessageReady.gtagCommands.some((item) => item[1] === "generate_lead"), false);
assert.equal(rescueMessageReady.objects[0].page_location, "https://www.carkey.com.tw/rescue-request");
assertAttributionSafeLocations(rescueMessageReady);

console.log("Conversion tracking runtime tests passed: attribution-safe page views/events, click-only phone/LINE/structured-intake events, privacy-safe rescue message readiness, loopback-only diagnostic lead");
