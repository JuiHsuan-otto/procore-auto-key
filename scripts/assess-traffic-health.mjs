import assert from "node:assert/strict";
import fsp from "node:fs/promises";

const THRESHOLDS = Object.freeze({
  searchDeclinePercent: -20,
  engagementRateDeclinePercent: -25,
  unassignedSharePercent: 10,
  blankLandingSharePercent: 5,
  minimumOrganicSessions: 50,
});

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function share(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return (part / whole) * 100;
}

function round(value) {
  return value === null ? null : Number(value.toFixed(2));
}

function validatePeriod(period, label, requireMeasurementContext = false) {
  const required = ["totalSessions", "organicSessions", "organicEngagedSessions", "gscClicks", "gscImpressions"];
  if (requireMeasurementContext) required.push("unassignedSessions", "blankLandingSessions");

  for (const field of required) {
    if (!Number.isFinite(period[field]) || period[field] < 0) {
      throw new Error(`${label}.${field} must be a non-negative number`);
    }
  }

  if (period.organicSessions > period.totalSessions) {
    throw new Error(`${label}.organicSessions cannot exceed totalSessions`);
  }
  if (period.organicEngagedSessions > period.organicSessions) {
    throw new Error(`${label}.organicEngagedSessions cannot exceed organicSessions`);
  }
}

function assess(input) {
  validatePeriod(input.current, "current", true);
  validatePeriod(input.previous, "previous");

  const currentEngagementRate = share(input.current.organicEngagedSessions, input.current.organicSessions);
  const previousEngagementRate = share(input.previous.organicEngagedSessions, input.previous.organicSessions);
  const metrics = {
    organicSessionsChangePercent: round(percentChange(input.current.organicSessions, input.previous.organicSessions)),
    gscClicksChangePercent: round(percentChange(input.current.gscClicks, input.previous.gscClicks)),
    gscImpressionsChangePercent: round(percentChange(input.current.gscImpressions, input.previous.gscImpressions)),
    currentOrganicEngagementRatePercent: round(currentEngagementRate),
    previousOrganicEngagementRatePercent: round(previousEngagementRate),
    organicEngagementRateChangePercent: round(percentChange(currentEngagementRate, previousEngagementRate)),
    organicEngagementRatePointChange: round(currentEngagementRate - previousEngagementRate),
    unassignedSessionSharePercent: round(share(input.current.unassignedSessions, input.current.totalSessions)),
    blankLandingSessionSharePercent: round(share(input.current.blankLandingSessions, input.current.totalSessions)),
  };

  const signals = [];
  const enoughOrganicVolume = input.current.organicSessions >= THRESHOLDS.minimumOrganicSessions;
  const searchTrafficIncident = enoughOrganicVolume
    && metrics.organicSessionsChangePercent <= THRESHOLDS.searchDeclinePercent
    && metrics.gscClicksChangePercent <= THRESHOLDS.searchDeclinePercent;
  const measurementIntegrityWarning = metrics.unassignedSessionSharePercent >= THRESHOLDS.unassignedSharePercent
    || metrics.blankLandingSessionSharePercent >= THRESHOLDS.blankLandingSharePercent;
  const engagementQualityWarning = enoughOrganicVolume
    && metrics.organicEngagementRateChangePercent <= THRESHOLDS.engagementRateDeclinePercent;

  if (searchTrafficIncident) {
    signals.push({
      code: "search_traffic_incident",
      severity: "incident",
      message: "GA4 organic sessions and GSC clicks both crossed the decline threshold.",
    });
  }
  if (measurementIntegrityWarning) {
    signals.push({
      code: "measurement_integrity_warning",
      severity: "warning",
      message: "Unassigned or blank-landing share crossed the measurement-integrity threshold.",
    });
  }
  if (engagementQualityWarning) {
    signals.push({
      code: "engagement_quality_warning",
      severity: "warning",
      message: "Organic engagement rate declined materially at sufficient session volume.",
    });
  }
  if (!signals.length) {
    signals.push({
      code: "observe",
      severity: "info",
      message: "No incident threshold crossed; continue same-weekday observation.",
    });
  }

  let decision = "observe";
  if (searchTrafficIncident) decision = "investigate_search_traffic";
  else if (measurementIntegrityWarning) decision = "fix_measurement_and_monitor_engagement";
  else if (engagementQualityWarning) decision = "investigate_landing_experience";

  return {
    schemaVersion: 1,
    observedAt: input.observedAt || null,
    periods: input.periods || null,
    thresholds: THRESHOLDS,
    metrics,
    decision,
    signals,
  };
}

function runSelfTest() {
  const measurementCase = assess({
    current: { totalSessions: 131, organicSessions: 103, organicEngagedSessions: 33, unassignedSessions: 19, blankLandingSessions: 14, gscClicks: 109, gscImpressions: 2770 },
    previous: { totalSessions: 103, organicSessions: 91, organicEngagedSessions: 56, gscClicks: 95, gscImpressions: 2612 },
  });
  assert.equal(measurementCase.decision, "fix_measurement_and_monitor_engagement");
  assert.equal(measurementCase.signals.some((signal) => signal.code === "search_traffic_incident"), false);
  assert.equal(measurementCase.signals.some((signal) => signal.code === "measurement_integrity_warning"), true);
  assert.equal(measurementCase.signals.some((signal) => signal.code === "engagement_quality_warning"), true);

  const incidentCase = assess({
    current: { totalSessions: 80, organicSessions: 60, organicEngagedSessions: 30, unassignedSessions: 1, blankLandingSessions: 1, gscClicks: 60, gscImpressions: 900 },
    previous: { totalSessions: 120, organicSessions: 100, organicEngagedSessions: 55, gscClicks: 100, gscImpressions: 1500 },
  });
  assert.equal(incidentCase.decision, "investigate_search_traffic");

  console.log("Traffic health assessment self-test passed");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const inputPath = getArg("--input");
  if (!inputPath) {
    console.error("Usage: node scripts/assess-traffic-health.mjs --input <observation.json> [--json]");
    process.exit(1);
  }

  const input = JSON.parse(await fsp.readFile(inputPath, "utf8"));
  const result = assess(input);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("CarKey traffic health assessment");
    console.log(`Decision: ${result.decision}`);
    console.table(result.metrics);
    console.table(result.signals);
  }
}
