import ResponsiveSelect from "./ResponsiveSelect";
import React, { useMemo, useState } from "react";
import { analyticsCSV, analyticsWindow, buildReportAnalytics, philippineDay, STATUS_LABELS } from "../utils/reportAnalytics";
import "./ReportsAnalytics.css";
import "./ReportsAnalytics.print.css";
import ctmoShieldLogo from "../assets/ctmo-shield-logo-transparent.png";

const COLORS = { pending: "#d59b18", reviewing: "#7661c4", assigned: "#2186ab", inProgress: "#245fbd", resolved: "#15855d", rejected: "#c44958", other: "#64748b" };
const dayLabel = (date) => new Date(date).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
const periodDate = (date) => new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });
const fullDate = (date) => new Date(date).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export default function ReportsAnalytics({ reports, loading, error, lastUpdated, onRetry, onOpenReport }) {
  const [range, setRange] = useState("30");
  const [startDate, setStartDate] = useState(() => philippineDay(Date.now() - 29 * 86400000));
  const [endDate, setEndDate] = useState(() => philippineDay(Date.now()));
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const now = lastUpdated || new Date().toISOString();
  const reportWindow = useMemo(() => analyticsWindow(range, now, startDate, endDate), [range, now, startDate, endDate]);
  const data = useMemo(() => reportWindow.error ? null : buildReportAnalytics(reports, reportWindow, now), [reports, reportWindow, now]);
  const periodLabel = reportWindow.error ? "Invalid date range" : `${reportWindow.start === null ? "All available dates" : periodDate(reportWindow.start)} – ${periodDate(reportWindow.end - 1)} (Philippine time)`;
  const bucket = data?.buckets.find((item) => item.key === selectedBucket);
  const visibleReports = data ? data.rows.filter((report) => !bucket || (report.timestamp >= bucket.start && report.timestamp < bucket.end))
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 10) : [];
  const maxVolume = Math.max(1, ...(data?.buckets.map((item) => item.count) || []));
  const topTypes = data?.types.slice(0, showAllTypes ? undefined : 5) || [];
  const shownTypeCount = topTypes.reduce((sum, item) => sum + item.count, 0);

  const exportCSV = () => {
    const url = URL.createObjectURL(new Blob([analyticsCSV(data, periodLabel, fullDate(now))], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hapsaydalan-analytics-${philippineDay(now)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="admin-panel-card ra-panel" aria-labelledby="analytics-title">
      <div className="ra-print-page ra-print-overview">
      <PrintHeader title="Analytics & Trends" section="Performance overview" period={periodLabel} snapshot={fullDate(now)} />
      <div className="ra-heading">
        <div>
          <div className="ra-eyebrow">CTMO REPORT INSIGHTS</div>
          <h2 id="analytics-title" className="admin-panel-title">Analytics &amp; Trends</h2>
          <p className="admin-panel-subtitle">Understand report volume, case progress, and places that need attention.</p>
        </div>
        <div className="ra-export-actions" role="group" aria-label="Analytics exports">
          <button className="ra-button ra-print-button" type="button" onClick={() => window.print()} disabled={!data || loading || !lastUpdated}>Print / PDF</button>
          <button className="ra-button ra-csv-button" type="button" onClick={exportCSV} disabled={!data?.total || loading}>Export CSV ↓</button>
        </div>
      </div>

      <div className="ra-toolbar">
        <label>Reporting period
          <ResponsiveSelect aria-label="Reporting period" value={range} onChange={(event) => { setRange(event.target.value); setSelectedBucket(null); }}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option><option value="all">All time</option><option value="custom">Custom dates</option>
          </ResponsiveSelect>
        </label>
        {range === "custom" ? <>
          <label>From<input type="date" value={startDate} max={endDate || philippineDay(now)} onChange={(event) => { setStartDate(event.target.value); setSelectedBucket(null); }} /></label>
          <label>Through<input type="date" value={endDate} min={startDate} max={philippineDay(now)} onChange={(event) => { setEndDate(event.target.value); setSelectedBucket(null); }} /></label>
        </> : null}
        <div className="ra-freshness"><span className={`ra-live-dot${error ? " ra-offline" : ""}`} />
          {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" })} PHT` : "Waiting for reports"}
          <small>{periodLabel}</small>
        </div>
      </div>

      {error ? <div className="ra-warning" role="alert">{lastUpdated ? "Refresh failed. Showing the last successfully loaded reports." : "Reports could not be loaded. Analytics will appear when the connection is restored."}
        <button type="button" onClick={onRetry}>Retry</button>
      </div> : null}
      {reportWindow.error ? <p className="ra-warning" role="alert">{reportWindow.error}</p> : null}
      {loading ? <p className="ra-empty" role="status">Loading report analytics…</p> : data ? <>
        <div className="ra-metrics">
          <Metric label="Submitted reports" value={data.total} note={data.previousCount === null ? "Across all available dates" : data.previousCount === 0
            ? "No reports in the previous equal-length period" : `${data.change > 0 ? "+" : ""}${data.change.toFixed(1)}% vs previous equal-length period (${data.previousCount})`} />
          <Metric label="Currently open" value={data.open} note={`${data.unassigned} still without an assigned officer`} />
          <Metric label="Resolution rate" value={data.resolutionRate === null ? "—" : `${data.resolutionRate.toFixed(1)}%`} note={`${data.counts.resolved} of ${data.total} reports currently resolved`} />
          <Metric label="Open for 7+ days" value={data.aged} note="Unresolved and not rejected" attention={data.aged > 0} />
        </div>
        <p className="ra-method">All metrics use reports submitted in the selected period and their current status. Trend bars show submission time, rather than when an incident happened.</p>
        {!data.total ? <div className="ra-empty"><strong>No reports in this period</strong><p>Choose a wider date range to explore your available reports.</p></div> : <>
          <div className="ra-chart ra-volume">
            <div className="ra-section-heading"><div><h3>Report volume over time</h3><p>{data.bucketDays === 1 ? "Daily" : data.bucketDays === 7 ? "Weekly" : "30-day"} totals<span className="ra-screen-hint"> · Click a bar to inspect reports</span></p></div>
              <span className="ra-tag">{data.total} reports</span></div>
            <div className="ra-chart-scroll">
              <div className="ra-bars" style={{ gridTemplateColumns: `repeat(${data.buckets.length}, minmax(28px, 1fr))` }}>
                {data.buckets.map((item, index) => (
                  <button key={item.key} type="button" className={`ra-day${selectedBucket === item.key ? " is-selected" : ""}`}
                    aria-pressed={selectedBucket === item.key} aria-label={`${dayLabel(item.start)} to ${dayLabel(item.end - 1)}: ${item.count} reports`}
                    title={`${dayLabel(item.start)}${data.bucketDays > 1 ? ` – ${dayLabel(item.end - 1)}` : ""}: ${item.count} reports`}
                    onClick={() => setSelectedBucket(selectedBucket === item.key ? null : item.key)}>
                    <span className="ra-bar-space"><span className="ra-day-count">{item.count || ""}</span>
                      <span className="ra-day-bar" style={{ height: `${(item.count / maxVolume) * 116}px`, "--ra-bar-scale": item.count / maxVolume }} /></span>
                    <span className="ra-day-label">{index === 0 || index === data.buckets.length - 1 || index % Math.max(1, Math.ceil(data.buckets.length / 8)) === 0 ? dayLabel(item.start) : "·"}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="ra-footnote">Philippine time (UTC+8). First and last buckets may cover part of a day.</p>
          </div>

          <div className="ra-two-columns ra-print-type-status">
            <div className="ra-chart"><div className="ra-section-heading"><div><h3>Violations by type</h3><p>Share of all reports in this period</p></div></div>
              <div className="ra-rankings">{topTypes.map((item, index) => (
                <div className="ra-ranking" key={item.key}><div><span>{item.label}</span><strong>{item.count} <small>· {((item.count / data.total) * 100).toFixed(1)}%</small></strong></div>
                  <div className="ra-track"><span style={{ width: `${(item.count / data.total) * 100}%`, background: ["#174c97", "#327ca9", "#359a94", "#7b6bb4", "#94a3b8"][index % 5] }} /></div>
                </div>
              ))}</div>
              {data.types.length > 5 ? <button className="ra-text-button" type="button" onClick={() => setShowAllTypes(!showAllTypes)}>{showAllTypes ? "Show top 5" : `View all ${data.types.length} types · ${data.total - shownTypeCount} reports in remaining types`}</button> : null}
              {data.types.length > 5 && !showAllTypes ? <p className="ra-print-only ra-footnote">Top 5 of {data.types.length} violation types shown.</p> : null}
            </div>
            <div className="ra-chart"><div className="ra-section-heading"><div><h3>Case status</h3><p>Current progress of submitted reports</p></div></div>
              <div className="ra-status-track" aria-label="Status distribution">{Object.entries(STATUS_LABELS).map(([key, label]) => data.counts[key] ? <span key={key} style={{ width: `${(data.counts[key] / data.total) * 100}%`, background: COLORS[key] }} title={`${label}: ${data.counts[key]}`} /> : null)}</div>
              <div className="ra-status-list">{Object.entries(STATUS_LABELS).filter(([key]) => key !== "other" || data.counts.other).map(([key, label]) => (
                <div key={key}><span><i style={{ background: COLORS[key] }} />{label}</span><strong>{data.counts[key]} <small>{((data.counts[key] / data.total) * 100).toFixed(1)}%</small></strong></div>
              ))}</div>
            </div>
          </div>
        </>}
      </> : null}
      </div>

      {!loading && data?.total > 0 ? <div className="ra-print-page ra-print-details">
          <PrintHeader title="Case Insights & Activity" section="Operational follow-up" period={periodLabel} snapshot={fullDate(now)} />
          <div className="ra-two-columns ra-print-areas">
            <div className="ra-chart"><div className="ra-section-heading"><div><h3>Most reported areas</h3><p>Violation pins, rather than reporter device locations</p></div></div>
              <ol className="ra-locations">{data.locations.slice(0, 5).map((place) => <li key={place.key}><span>{place.label}</span><strong>{place.count}<small> reports</small></strong></li>)}</ol>
              <p className="ra-footnote">Nearby pins are grouped into approximate 100 m areas. Reports without coordinates are grouped by address.</p>
            </div>
            <div className="ra-chart ra-attention"><div className="ra-section-heading"><div><h3>What needs attention</h3><p>Based on the selected report period</p></div></div>
              <ul>
                <li><strong>{data.unassigned} open reports</strong> have no assigned officer.</li>
                <li><strong>{data.aged} open reports</strong> were submitted at least 7 days ago.</li>
                {data.types[0] ? <li><strong>{data.types[0].label}</strong> is the most reported type ({data.types[0].count} reports).</li> : null}
              </ul>
              <p className="ra-footnote">Report counts reflect citizen submissions. They do not measure every violation or establish that a report has been validated.</p>
            </div>
          </div>

          <div className="ra-chart ra-recent-reports"><div className="ra-section-heading"><div><h3>{bucket ? `Reports: ${dayLabel(bucket.start)} – ${dayLabel(bucket.end - 1)}` : "Recent reports in this period"}</h3><p>Showing up to 10 latest reports<span className="ra-screen-hint"> · Click a reference ID to review</span></p></div>
            {bucket ? <button className="ra-text-button" type="button" onClick={() => setSelectedBucket(null)}>Clear day selection</button> : null}</div>
            {visibleReports.length ? <div className="ra-table-scroll"><table><thead><tr><th>Reference ID</th><th>Violation</th><th>Status</th><th>Submitted (PHT)</th></tr></thead><tbody>
              {visibleReports.map((report) => <tr key={report.id}><td><button className="ra-text-button" type="button" onClick={() => onOpenReport(report)}>{report.reference_id}</button></td><td>{report.violation_type}</td><td>{report.status}</td><td>{fullDate(report.date_reported)}</td></tr>)}
            </tbody></table></div> : <p className="ra-empty">No reports in this chart interval.</p>}
          </div>
      </div> : null}
      {!loading && data?.invalidDates > 0 ? <p className="ra-footnote">{data.invalidDates} records with missing, invalid, or future submission dates are excluded.</p> : null}
    </section>
  );
}

function PrintHeader({ title, section, period, snapshot }) {
  return <header className="ra-print-header" aria-hidden="true">
    <div className="ra-print-brand">
      <img src={ctmoShieldLogo} alt="" />
      <div className="ra-print-brand-name"><strong>HapsayDalan</strong><span>CTMO, Surigao City</span></div>
      <div className="ra-print-document">TRAFFIC OPERATIONS<span>ANALYTICS REPORT</span></div>
    </div>
    <div className="ra-print-page-title"><span>{section}</span><h2>{title}</h2></div>
    <div className="ra-print-metadata">
      <div><span>Reporting period</span><strong>{period}</strong></div>
      <div><span>Report snapshot</span><strong>{snapshot} PHT</strong></div>
    </div>
  </header>;
}

function Metric({ label, value, note, attention }) {
  return <div className={`ra-metric${attention ? " ra-metric-attention" : ""}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></div>;
}
