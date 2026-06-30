(function () {
  "use strict";

  var GA_MEASUREMENT_ID = "G-KW1LHLVQHL";
  var GA_SCRIPT_ID = "procore-ga4-loader";
  var LEAD_EVENT_NAME = "generate_lead";
  var MAX_TEXT_LENGTH = 160;
  var TEST_EVENT_PARAM = "ga4_test";
  var TEST_EVENT_VALUE = "generate_lead_98b16f5";
  var TEST_EVENT_STORAGE_KEY = "procore_ga4_test_" + TEST_EVENT_VALUE;

  function hasGaMeasurementId() {
    return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];

    if (typeof window.gtag !== "function") {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
  }

  function loadGa4() {
    var script;

    ensureGtag();

    if (!hasGaMeasurementId()) {
      return;
    }

    if (document.getElementById(GA_SCRIPT_ID)) {
      return;
    }

    script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID);
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  }

  function getLink(target) {
    if (!target || typeof target.closest !== "function") {
      return null;
    }

    return target.closest("a[href]");
  }

  function normalizePhone(href) {
    return (href || "").replace(/^tel:/i, "").replace(/[^\d+]/g, "");
  }

  function isLineHref(href) {
    return /(^https?:)?\/\/(line\.me|lin\.ee)\//i.test(href || "");
  }

  function getBasePayload(link, eventName, conversionType) {
    var href = link.getAttribute("href") || "";

    return {
      event: eventName,
      conversion_type: conversionType,
      link_url: href,
      link_text: cleanText(link.textContent),
      page_path: window.location.pathname,
      page_location: window.location.href,
      page_title: document.title
    };
  }

  function clonePayload(payload) {
    var key;
    var output = {};

    for (key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        output[key] = payload[key];
      }
    }

    return output;
  }

  function pushToDataLayer(payload, eventName) {
    var nextPayload = clonePayload(payload);

    if (eventName) {
      nextPayload.event = eventName;
    }

    ensureGtag();
    window.dataLayer.push(nextPayload);
  }

  function getGtagEventParams(payload) {
    var params = {
      event_category: "conversion",
      event_label: payload.link_url,
      conversion_type: payload.conversion_type,
      lead_source: payload.conversion_type,
      method: payload.conversion_type,
      link_text: payload.link_text,
      link_url: payload.link_url,
      page_path: payload.page_path,
      page_location: payload.page_location,
      transport_type: "beacon"
    };

    if (payload.debug_mode === true) {
      params.debug_mode = true;
    }

    return params;
  }

  function pushToGtag(payload, gtagEventName) {
    if (typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", gtagEventName, getGtagEventParams(payload));
  }

  function pushLeadEvents(payload, gtagEventName) {
    pushToDataLayer(payload);
    pushToDataLayer(payload, LEAD_EVENT_NAME);
    pushToGtag(payload, LEAD_EVENT_NAME);

    if (gtagEventName !== LEAD_EVENT_NAME) {
      pushToDataLayer(payload, gtagEventName);
      pushToGtag(payload, gtagEventName);
    }
  }

  function getSearchParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return "";
    }
  }

  function hasSessionFlag(key) {
    try {
      return window.sessionStorage && window.sessionStorage.getItem(key) === "1";
    } catch (error) {
      return false;
    }
  }

  function setSessionFlag(key) {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, "1");
      }
    } catch (error) {
      // Ignore storage failures; the test URL is still intentionally hard to guess.
    }
  }

  function runGa4TestIfRequested() {
    var requested = getSearchParam(TEST_EVENT_PARAM);
    var payload;

    if (requested !== TEST_EVENT_VALUE || hasSessionFlag(TEST_EVENT_STORAGE_KEY)) {
      return;
    }

    setSessionFlag(TEST_EVENT_STORAGE_KEY);
    payload = {
      event: "procore_ga4_test_lead",
      conversion_type: "diagnostic",
      link_url: "ga4_test:" + requested,
      link_text: "GA4 generate_lead diagnostic",
      page_path: window.location.pathname,
      page_location: window.location.href,
      page_title: document.title,
      debug_mode: true
    };

    pushLeadEvents(payload, LEAD_EVENT_NAME);
  }

  function trackClick(event) {
    var link = getLink(event.target);
    var href = link ? link.getAttribute("href") || "" : "";
    var payload;

    if (!href) {
      return;
    }

    if (/^tel:/i.test(href)) {
      payload = getBasePayload(link, "procore_phone_click", "phone");
      payload.phone_number = normalizePhone(href);
      pushLeadEvents(payload, "click_to_call");
      return;
    }

    if (isLineHref(href)) {
      payload = getBasePayload(link, "procore_line_click", "line");
      pushLeadEvents(payload, "line_click");
    }
  }

  loadGa4();
  runGa4TestIfRequested();
  document.addEventListener("click", trackClick, true);
})();
