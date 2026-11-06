import React from "react";
import "./SuspiciousReportNotice.css";

function flagDetail(flag) {
  if (flag.code !== "future_incident_time") return flag.detail;
  return flag.detail?.replace(/\b(\d+) minutes after submission\b/, (original, value) => {
    const total = Number(value);
    if (!Number.isSafeInteger(total) || total < 1) return original;
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const minutes = total % 60;
    const parts = [[days, "day"], [hours, "hour"], [minutes, "minute"]]
      .filter(([amount]) => amount > 0)
      .map(([amount, unit]) => `${amount} ${unit}${amount === 1 ? "" : "s"}`);
    return `${parts.join(", ")} after submission`;
  });
}

export function SuspiciousBadge({ flags = [] }) {
  if (!flags.length) return null;
  return <span className="suspicious-badge">Review flags ({flags.length})</span>;
}

export default function SuspiciousReportNotice({ report, onReviewRelated }) {
  const flags = report.suspicious_flags || [];
  if (!flags.length) return null;
  return <section className="suspicious-notice" aria-label="Suspicious report flags">
    <h4>Review flags ({flags.length})</h4>
    <p>These signals identify details to check. They do not prove a false report or automatically reject it.</p>
    <ul>{flags.map((flag) => <li key={flag.code}>
      <strong>{flag.title}</strong>
      <p>{flagDetail(flag)}</p>
      {flag.related_reports?.length ? <div className="suspicious-related">{flag.related_reports.slice(0, 5).map((related) => (
        <button type="button" key={related.id} onClick={() => onReviewRelated(related.id)}>
          Review {related.reference_id}
        </button>
      ))}</div> : null}
    </li>)}</ul>
  </section>;
}
