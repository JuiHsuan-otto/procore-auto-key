(function () {
  "use strict";

  var GA_MEASUREMENT_ID = "G-KW1LHLVQHL";
  var MAX_TEXT_LENGTH = 160;

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

    script = document.createElement("script");
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
      page_title: document.title
    };
  }

  function pushToDataLayer(payload) {
    ensureGtag();
    window.dataLayer.push(payload);
  }

  function pushToGtag(payload, gtagEventName) {
    if (typeof window.gtag !== "function") {
      return;
    }

    window.gtag("event", gtagEventName, {
      event_category: "conversion",
      event_label: payload.link_url,
      conversion_type: payload.conversion_type,
      link_text: payload.link_text,
      page_path: payload.page_path
    });
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
      pushToDataLayer(payload);
      pushToGtag(payload, "click_to_call");
      return;
    }

    if (isLineHref(href)) {
      payload = getBasePayload(link, "procore_line_click", "line");
      pushToDataLayer(payload);
      pushToGtag(payload, "line_click");
    }
  }

  loadGa4();
  document.addEventListener("click", trackClick, true);
})();
