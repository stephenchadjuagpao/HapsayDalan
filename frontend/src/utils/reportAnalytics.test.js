import { analyticsCSV, analyticsWindow, buildReportAnalytics, philippineDay } from "./reportAnalytics";

const now = Date.parse("2026-10-23T04:00:00Z");
const report = (id, date, status = "Pending", extra = {}) => ({
  id, reference_id: `SUP-${id}`, date_reported: date, status, violation_type: "Obstruction",
  location: "Surigao City", latitude: 9.7843, longitude: 125.4888, ...extra,
});

test("calendar dates and custom boundaries use Philippine time", () => {
  expect(philippineDay("2026-10-22T18:00:00Z")).toBe("2026-10-23");
  const window = analyticsWindow("custom", now, "2026-10-22", "2026-10-22");
  const data = buildReportAnalytics([
    report(1, "2026-10-21T16:00:00Z"), report(2, "2026-10-22T15:59:59Z"), report(3, "2026-10-22T16:00:00Z"),
  ], window, now);
  expect(data.total).toBe(2);
  expect(data.buckets[0].key).toBe("2026-10-22");
  expect(data.buckets[0].count).toBe(2);
});

test("status totals include rejected and unknown statuses without losing reports", () => {
  const data = buildReportAnalytics([
    report(1, "2026-10-20", "Pending"), report(2, "2026-10-20", "Validated"),
    report(3, "2026-10-20", "Under Review"), report(4, "2026-10-20", "Assigned"),
    report(5, "2026-10-20", "In Progress"), report(6, "2026-10-20", "Resolved"),
    report(7, "2026-10-20", "Rejected"), report(8, "2026-10-20", "Unexpected"),
  ], analyticsWindow("30", now), now);
  expect(Object.values(data.counts).reduce((sum, count) => sum + count, 0)).toBe(8);
  expect(data.counts.reviewing).toBe(2);
  expect(data.counts.rejected).toBe(1);
  expect(data.resolutionRate).toBe(12.5);
  expect(data.open).toBe(6);
});

test("backlog aging excludes resolved and rejected and counts only the selected cohort", () => {
  const data = buildReportAnalytics([
    report(1, "2026-10-10"), report(2, "2026-10-10", "Resolved"), report(3, "2026-10-10", "Rejected"),
    report(4, "2026-10-22", "Assigned", { assigned_officer: "Officer" }), report(5, "2026-08-01"),
  ], analyticsWindow("30", now), now);
  expect(data.total).toBe(4);
  expect(data.aged).toBe(1);
  expect(data.unassigned).toBe(1);
});

test("comparison uses an equal duration and handles zero previous reports", () => {
  const window = analyticsWindow("7", now);
  const rows = [report(1, "2026-10-20"), report(2, "2026-10-21"), report(3, "2026-10-12")];
  const data = buildReportAnalytics(rows, window, now);
  expect(data.previousCount).toBe(1);
  expect(data.change).toBe(100);
  expect(buildReportAnalytics([], window, now).change).toBeNull();
  expect(buildReportAnalytics(rows, analyticsWindow("all", now), now).previousCount).toBeNull();
});

test("missing, invalid, and future submission dates do not appear as today's reports", () => {
  const data = buildReportAnalytics([report(1, null), report(2, "invalid"), report(3, "2030-01-01")], analyticsWindow("30", now), now);
  expect(data.total).toBe(0);
  expect(data.invalidDates).toBe(3);
  expect(data.resolutionRate).toBeNull();
  expect(data.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(0);
});

test("violation types preserve the full denominator and nearby pins are grouped separately from device location", () => {
  const rows = [report(1, "2026-10-20"), report(2, "2026-10-20", "Pending", {
    violation_type: "  obstruction ", latitude: 9.78431, longitude: 125.48881,
    reporter_latitude: 20, reporter_longitude: 30,
  })];
  const data = buildReportAnalytics(rows, analyticsWindow("30", now), now);
  expect(data.types).toHaveLength(1);
  expect(data.types[0].count).toBe(2);
  expect(data.locations).toHaveLength(1);
  expect(data.locations[0].count).toBe(2);
});

test("invalid custom date ranges are rejected", () => {
  expect(analyticsWindow("custom", now, "", "2026-10-23").error).toBeTruthy();
  expect(analyticsWindow("custom", now, "2026-10-23", "2026-10-20").error).toBeTruthy();
  expect(analyticsWindow("custom", now, "2030-01-01", "2030-01-03").error).toBeTruthy();
});

test("CSV contains totals, escapes quotes and neutralizes spreadsheet formulas", () => {
  const data = buildReportAnalytics([report(1, "2026-10-20", "Pending", { violation_type: '=HYPERLINK("bad")' })], analyticsWindow("30", now), now);
  const csv = analyticsCSV(data, "Last 30 days");
  expect(csv).toContain('"Submitted reports","1"');
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  expect(csv).toContain('"Rejected","0"');
});
