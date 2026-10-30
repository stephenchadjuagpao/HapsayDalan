import React, { useState } from "react";
import "./DuplicateReportNotice.css";

export function DuplicateBadge() {
  return <span className="duplicate-badge">Possible duplicate</span>;
}

export default function DuplicateReportNotice({ report, onReviewMatch }) {
  const [expanded, setExpanded] = useState(false);
  const matches = report.duplicate_matches || [];
  if (!report.possible_duplicate || !matches.length) return null;
  const visible = expanded ? matches : matches.slice(0, 3);
  return <section className="duplicate-notice" aria-label="Possible duplicate reports">
    <h4>Possible duplicate — review required</h4>
    <p>Identical files or visually similar photos with the same violation type, within 100 metres and 30 minutes. These reports are kept for review; different people may be reporting the same incident.</p>
    {report.occurred_at ? <p>Reported incident time: {new Date(report.occurred_at).toLocaleString()}</p> : null}
    <div className="duplicate-comparisons">{visible.map((match) => <article className="duplicate-comparison" key={match.id}>
      <div className="duplicate-match-heading">
        <strong>{match.reference_id}</strong>
        <button type="button" onClick={() => onReviewMatch(match.id)}>Review matched report</button>
      </div>
      <p>{match.violation_type} · {match.location}</p>
      <p><strong>{match.match_type === "visual" ? "Visually similar photo" : "Identical evidence file"}</strong>
        {match.match_type === "visual" ? " — may be resized, recompressed or cropped. Compare the evidence before deciding." : " — the file content matches, even if its filename differs."}</p>
      <p><strong>{Math.round(match.distance_m)} m apart · {match.time_difference_minutes} min apart</strong> ({match.time_basis})</p>
      <div className="duplicate-evidence">
        <figure><img src={report.image} alt={`Evidence for current report ${report.reference_id}`} loading="lazy" /><figcaption>Current: {report.reference_id}</figcaption></figure>
        <figure><img src={match.image} alt={`Evidence for matched report ${match.reference_id}`} loading="lazy" /><figcaption>Match: {match.reference_id}</figcaption></figure>
      </div>
    </article>)}</div>
    {matches.length > 3 ? <button type="button" className="duplicate-expand" onClick={() => setExpanded(!expanded)}>
      {expanded ? "Show fewer matches" : `Show all ${matches.length} matches`}
    </button> : null}
  </section>;
}
