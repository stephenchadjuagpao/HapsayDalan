const DAY = 86400000;
const PH_OFFSET = 8 * 3600000;

export const STATUS_LABELS = {
  pending: "Pending Verification", reviewing: "Validated", assigned: "Assigned",
  inProgress: "In Progress", resolved: "Resolved", rejected: "Rejected", other: "Other status",
};

export function philippineDay(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + PH_OFFSET).toISOString().slice(0, 10) : "";
}

export function reportStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ({ pending: "pending", submitted: "pending", validated: "reviewing", "under review": "reviewing",
    assigned: "assigned", "in progress": "inProgress", resolved: "resolved", rejected: "rejected" })[status] || "other";
}

export function analyticsWindow(range, now, startDate, endDate) {
  const end = new Date(now).getTime();
  if (range === "custom") {
    const start = new Date(`${startDate}T00:00:00+08:00`).getTime();
    const selectedEnd = new Date(`${endDate}T00:00:00+08:00`).getTime() + DAY;
    if (!Number.isFinite(start) || !Number.isFinite(selectedEnd) || start >= selectedEnd || start > end) {
      return { error: "Choose a valid start and end date. The start date cannot be in the future." };
    }
    return { start, end: Math.min(selectedEnd, end + 1) };
  }
  return { start: range === "all" ? null : end - Number(range) * DAY, end: end + 1 };
}

function rankCounts(rows, getKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const [key, label] = getKey(row);
    const group = groups.get(key) || { key, label, count: 0 };
    group.count += 1;
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildReportAnalytics(reports, window, now) {
  const nowTime = new Date(now).getTime();
  let invalidDates = 0;
  const valid = reports.flatMap((report) => {
    const timestamp = report.date_reported ? new Date(report.date_reported).getTime() : NaN;
    if (!Number.isFinite(timestamp) || timestamp > nowTime) { invalidDates += 1; return []; }
    return [{ ...report, timestamp, statusKey: reportStatus(report.status) }];
  });
  const rows = valid.filter((report) => (window.start === null || report.timestamp >= window.start) && report.timestamp < window.end);
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((key) => [key, 0]));
  rows.forEach((report) => { counts[report.statusKey] += 1; });
  const open = rows.filter((report) => !["resolved", "rejected"].includes(report.statusKey));
  const aged = open.filter((report) => nowTime - report.timestamp >= 7 * DAY);
  const types = rankCounts(rows, (report) => {
    const label = String(report.violation_type || "Other").trim().replace(/\s+/g, " ") || "Other";
    return [label.toLowerCase(), label];
  });
  const locations = rankCounts(rows, (report) => {
    const latitude = report.latitude == null || report.latitude === "" ? NaN : Number(report.latitude);
    const longitude = report.longitude == null || report.longitude === "" ? NaN : Number(report.longitude);
    const label = String(report.location || "Location not recorded").trim().replace(/\s+/g, " ");
    return [Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude.toFixed(3)},${longitude.toFixed(3)}` : `address:${label.toLowerCase()}`, label];
  });
  const firstTime = window.start ?? rows.reduce((earliest, report) => Math.min(earliest, report.timestamp), nowTime);
  const days = Math.max(1, Math.ceil((window.end - firstTime) / DAY));
  // Keep long ranges readable by grouping into weeks or months.
  const bucketDays = days <= 31 ? 1 : days <= 180 ? 7 : 30;
  const firstDay = new Date(`${philippineDay(firstTime)}T00:00:00+08:00`).getTime();
  const buckets = [];
  for (let start = firstDay; start < window.end; start += bucketDays * DAY) {
    buckets.push({ key: philippineDay(start), start, end: Math.min(start + bucketDays * DAY, window.end), count: 0 });
  }
  rows.forEach((report) => {
    const index = Math.floor((report.timestamp - firstDay) / (bucketDays * DAY));
    if (buckets[index]) buckets[index].count += 1;
  });
  let previousCount = null;
  let change = null;
  if (window.start !== null) {
    const previousStart = window.start - (window.end - window.start);
    previousCount = valid.filter((report) => report.timestamp >= previousStart && report.timestamp < window.start).length;
    if (previousCount > 0) change = ((rows.length - previousCount) / previousCount) * 100;
  }
  return {
    rows, counts, types, locations, buckets, bucketDays, open: open.length, aged: aged.length,
    unassigned: open.filter((report) => !String(report.assigned_officer || "").trim()).length,
    total: rows.length, resolutionRate: rows.length ? (counts.resolved / rows.length) * 100 : null,
    previousCount, change, invalidDates,
  };
}

export function analyticsCSV(data, label, snapshot = "") {
  const rows = [
    ["HapsayDalan Analytics & Trends", label], ["Snapshot (Philippine time)", snapshot], ["Metric", "Value"],
    ["Submitted reports", data.total], ["Currently open", data.open], ["Currently resolved", data.counts.resolved],
    ["Resolution rate (%)", data.resolutionRate === null ? "N/A" : data.resolutionRate.toFixed(1)],
    ["Open at least 7 days", data.aged], ["Open and unassigned", data.unassigned], [],
    ["Status", "Reports"], ...Object.entries(STATUS_LABELS).map(([key, name]) => [name, data.counts[key]]), [],
    ["Violation type", "Reports"], ...data.types.map((type) => [type.label, type.count]), [],
    ["Reported location / area", "Reports"], ...data.locations.map((place) => [place.label, place.count]), [],
    ["Period starting (Philippine time)", "Reports"], ...data.buckets.map((bucket) => [bucket.key, bucket.count]),
  ];
  return "\uFEFF" + rows.map((row) => row.map((value) => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
}
