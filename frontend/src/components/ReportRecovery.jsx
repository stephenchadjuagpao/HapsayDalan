import React, { useState } from "react";
import API from "../services/api";
import { rateLimitMessage as recoveryError } from "../utils/rateLimitMessage";
import "./ReportRecovery.css";
import ReportStatusFilter from "./ReportStatusFilter";
import MaterialIcon from "./MaterialIcon";

const REPORT_STATUSES = {
  pending: { key: "pending", label: "Pending Verification" },
  "pending verification": { key: "pending", label: "Pending Verification" },
  submitted: { key: "pending", label: "Pending Verification" },
  validated: { key: "validated", label: "Validated" },
  "under review": { key: "validated", label: "Validated" },
  assigned: { key: "assigned", label: "Assigned" },
  "in progress": { key: "in-progress", label: "In Progress" },
  resolved: { key: "resolved", label: "Resolved" },
  rejected: { key: "rejected", label: "Rejected" },
};
const FILTER_OPTIONS = [{ value: "all", label: "All statuses" },
  ...["pending", "validated", "assigned", "in progress", "resolved", "rejected"].map((key) => ({
    value: REPORT_STATUSES[key].key, label: REPORT_STATUSES[key].label,
  }))];

function reportStatus(value) {
  return REPORT_STATUSES[String(value || "").trim().toLowerCase()] || { key: "unknown", label: value || "Status unavailable" };
}

function reportDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Date unavailable";
}

function MetaIcon({ location = false }) {
  return <MaterialIcon name={location ? "place" : "calendar_today"} className="my-report-meta-icon" />;
}

export default function ReportRecovery({ onSelect, embedded = false, verificationOnly = false, onVerified }) {
  const prefix = verificationOnly ? "evidence-recovery" : "recovery";
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const rows = Array.isArray(reports) ? reports : [];
  const visibleReports = rows.filter((report) => statusFilter === "all" || reportStatus(report.status).key === statusFilter);
  const counts = rows.reduce((totals, report) => {
    const key = reportStatus(report.status).key;
    if (["pending", "validated", "assigned", "in-progress"].includes(key)) totals.open += 1;
    if (key === "resolved") totals.resolved += 1;
    if (key === "rejected") totals.rejected += 1;
    return totals;
  }, { open: 0, resolved: 0, rejected: 0 });

  const loadReports = async (accessToken) => {
    const response = await API.get("reports/my-reports/", {
      headers: { "X-Report-Access": accessToken },
    });
    setReports(response.data);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const csrf = await API.get("csrf/");
      const options = { headers: { "X-CSRFToken": csrf.data.csrfToken } };
      if (!challengeId) {
        const response = await API.post("reports/recover/", { email }, options);
        setChallengeId(response.data.challenge_id);
        setNotice(response.data.detail);
      } else {
        const response = await API.post("reports/verify-recovery/", {
          challenge_id: challengeId, code,
        }, options);
        onVerified?.(response.data.access_token);
        if (verificationOnly) return;
        setToken(response.data.access_token);
        setNotice("Email verified. Access lasts 15 minutes; verify again after it expires.");
        await loadReports(response.data.access_token);
      }
    } catch (err) {
      setError(recoveryError(err, "Unable to continue. Check your details and try again."));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setChallengeId(""); setCode(""); setToken(""); setReports(null);
    setError(""); setNotice(""); setEmail("");
    setStatusFilter("all");
  };

  const refresh = async () => {
    setBusy(true); setError("");
    try { await loadReports(token); }
    catch (err) { setError(recoveryError(err, "Unable to refresh your reports.")); }
    finally { setBusy(false); }
  };

  return (
    <section className={`${embedded ? "track-recovery-panel" : "track-form-card"}${token ? " my-reports" : ""}`} aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className="track-form-title">{verificationOnly ? "Verify your report email" : token ? "My Reports" : "Forgot Reference ID?"}</h2>
      {!token ? (
        <form onSubmit={submit}>
          <p className="track-help">Use the email address you provided when submitting your report. No account needed.</p>
          <label className="track-label" htmlFor={`${prefix}-email`}>Email address</label>
          <input id={`${prefix}-email`} className="track-input" type="email" autoComplete="email"
            required maxLength={254} value={email} disabled={!!challengeId || busy}
            onChange={(event) => setEmail(event.target.value)} />
          {challengeId ? <>
            <label className="track-label" htmlFor={`${prefix}-code`}>6-digit verification code</label>
            <input id={`${prefix}-code`} className="track-input" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy}
              onChange={(event) => setCode(event.target.value)} />
            <p className="track-help">The code expires in 10 minutes. You have up to 5 attempts.</p>
          </> : null}
          <button className="track-submit" type="submit" disabled={busy}>
            {busy ? "Please wait..." : challengeId ? verificationOnly ? "Verify & Continue" : "Verify & View My Reports" : "Send Verification Code"}
          </button>
        </form>
      ) : (
        <>
          <p className="my-reports-intro">Your submitted reports, all in one place. Select a report to view its progress and feedback.</p>
          <dl className="my-reports-summary" aria-label="Report summary">
            <div><dt>Total</dt><dd>{rows.length}</dd></div>
            <div className="my-reports-stat-open"><dt>Open</dt><dd>{counts.open}</dd></div>
            <div className="my-reports-stat-resolved"><dt>Resolved</dt><dd>{counts.resolved}</dd></div>
            <div className="my-reports-stat-rejected"><dt>Rejected</dt><dd>{counts.rejected}</dd></div>
          </dl>
          <div className="my-reports-toolbar">
            <span className="my-reports-count" role="status">{visibleReports.length} of {rows.length} reports</span>
            <div className="my-reports-filter">
              <span id="my-reports-status-label" className="my-reports-filter-label">Status</span>
              <ReportStatusFilter id="my-reports-status-filter" labelId="my-reports-status-label"
                value={statusFilter} options={FILTER_OPTIONS} onChange={setStatusFilter} />
            </div>
          </div>
          {!rows.length ? <p className="my-reports-empty">No reports found for this email address.</p>
            : !visibleReports.length ? <div className="my-reports-empty"><p>No reports match this status.</p>
              <button type="button" onClick={() => setStatusFilter("all")}>Show all reports</button></div> : null}
          <ul className="my-reports-list" aria-label="Your reports">{visibleReports.map((report) => {
            const status = reportStatus(report.status);
            return <li key={report.id}><button type="button" className={`my-report-card my-report-card-${status.key}`}
              aria-label={`View report ${report.reference_id}: ${report.violation_type}, ${status.label}`}
              onClick={() => onSelect(report.reference_id)}>
              <span className="my-report-topline"><span className="my-report-reference">{report.reference_id}</span>
                <span className={`my-report-status my-report-status-${status.key}`}>{status.label}</span></span>
              <span className="my-report-title">{report.violation_type}</span>
              {report.evidence_status ? <span className="ae-summary-note">{report.evidence_status === "requested" ? "Action needed: additional evidence requested" : "Additional evidence submitted for review"}</span> : null}
              <span className="my-report-meta"><MetaIcon /><span>Submitted {reportDate(report.date_reported)}</span></span>
              <span className="my-report-meta"><MetaIcon location /><span>{report.location || "Location unavailable"}</span></span>
              {status.key === "rejected" ? <span className="my-report-rejection">
                <strong>{report.rejection_reason_label || "Rejection feedback"}</strong>
                <span>{report.rejection_details || "Open this report to view the rejection details."}</span>
              </span> : null}
              <span className="my-report-card-footer">View report <span aria-hidden="true">&rarr;</span></span>
            </button></li>;
          })}</ul>
          <button className="my-reports-refresh" type="button" disabled={busy} onClick={refresh}>
            {busy ? "Refreshing..." : "Refresh My Reports"}
          </button>
        </>
      )}
      {notice ? <p className={`track-help${token ? " my-reports-session" : ""}`} role="status">{notice}</p> : null}
      {error ? <div className="track-error" role="alert">{error}</div> : null}
      {challengeId || token ? <button className={token ? "my-reports-close" : "track-submit"} type="button" disabled={busy} onClick={reset}>
        {token ? "Close My Reports" : "Use Another Email / Request a New Code"}
      </button> : null}
      {!token ? <p className="track-help">Reports submitted without an email address require the original reference ID.</p> : null}
    </section>
  );
}
