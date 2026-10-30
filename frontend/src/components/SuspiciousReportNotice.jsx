import React from "react";
import "./SuspiciousReportNotice.css";

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
      <p>{flag.detail}</p>
      {flag.related_reports?.length ? <div className="suspicious-related">{flag.related_reports.slice(0, 5).map((related) => (
        <button type="button" key={related.id} onClick={() => onReviewRelated(related.id)}>
          Review {related.reference_id}
        </button>
      ))}</div> : null}
    </li>)}</ul>
  </section>;
}
