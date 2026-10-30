import React, { useEffect, useState } from "react";
import API from "../services/api";
import ResponsiveSelect from "./ResponsiveSelect";
import AdminIcon from "./AdminIcon";
import "./AdminActivityHistory.css";

const ACTIONS = [["", "All actions"], ["case_created", "Case created"], ["case_updated", "Case updated"],
  ["note_added", "Admin note added"], ["evidence_requested", "Additional evidence requested"], ["case_deleted", "Case deleted"]];
const LABELS = { assigned_officer: "Assigned officer", public_verified_at: "Public map approval", rejection_reason: "Rejection category",
  rejection_details: "Rejection explanation", image: "Original evidence", evidence_request: "Evidence request ID" };
const timestamp = (value) => new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
const display = (field, value) => value === null || value === undefined || value === "" ? "Not set" :
  value === "[private]" ? "Private contact value" : field.endsWith("_at") ? timestamp(value) :
  field === "status" && value === "Pending" ? "Pending Verification" : String(value);

export default function AdminActivityHistory({ reportId, onOpenReport, refreshKey = 0, compact = false }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { setPage(1); setVersion((value) => value + 1); }, [refreshKey]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    API.get("admin/activity/", { params: { page, page_size: compact ? 10 : 25,
      ...(reportId ? { report_id: reportId } : {}), ...(query ? { q: query } : {}), ...(action ? { action } : {}) } })
      .then(({ data }) => {
        if (cancelled) return;
        const incoming = Array.isArray(data.results) ? data.results : [];
        setRows((previous) => page === 1 ? incoming : [...previous, ...incoming]);
        setCount(data.count || 0);
      }).catch(() => { if (!cancelled) setError("Could not load activity history. Please retry."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reportId, compact, query, action, page, version]);
  const refresh = () => { setPage(1); setVersion((value) => value + 1); };
  return <section className={`admin-activity${compact ? " is-compact" : ""}`} aria-label={compact ? "Case activity" : "Admin Activity History"}>
    <div className="activity-heading"><div><span className="admin-eyebrow">ADMIN AUDIT TRAIL</span>
      <h2>{compact ? "Case activity" : "Admin Activity History"}</h2>
      <p>Who changed a case, what changed, and when.</p></div>
      <button type="button" className="activity-button" onClick={refresh} disabled={loading}><AdminIcon name="refresh" />Refresh</button></div>
    {!compact && <form className="activity-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(draft.trim()); }}>
      <label className="activity-search">Search activity<input aria-label="Search activity" maxLength={200} value={draft}
        placeholder="Reference ID, admin, or note" onChange={(event) => setDraft(event.target.value)} /></label>
      <label className="activity-action">Action<ResponsiveSelect aria-label="Filter activity action" value={action}
        onChange={(event) => { setPage(1); setAction(event.target.value); }}>
        {ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</ResponsiveSelect></label>
      <button type="submit" className="activity-button">Search</button>
      {(query || action) && <button type="button" className="activity-button" onClick={() => {
        setPage(1); setQuery(""); setDraft(""); setAction("");
      }}>Clear filters</button>}
    </form>}
    {error && <div role="alert" className="activity-error">{error}<button type="button" onClick={refresh}>Retry</button></div>}
    <div aria-busy={loading} className="activity-list">
      {loading && page === 1 ? <p role="status">Loading activity history…</p> : rows.map((item) => <article className="activity-entry" key={item.id}>
        <div className="activity-entry-top"><strong>{item.action_label}</strong><time dateTime={item.created_at}>{timestamp(item.created_at)}</time></div>
        <p className="activity-actor"><strong>{item.actor_name}</strong>{item.actor_username !== item.actor_name && <span> @{item.actor_username}</span>}<span> · </span>
          {item.report_id && onOpenReport ? <button className="activity-case" type="button" onClick={() => onOpenReport(item.report_id)}>{item.report_reference}</button> :
            <span>{item.report_reference}{!item.report_id ? " (deleted case)" : ""}</span>}</p>
        {Object.entries(item.changes || {}).map(([field, change]) => <div className="activity-change" key={field}>
          <span className="activity-field">{LABELS[field] || field.replace(/_/g, " ")}</span>
          <div className="activity-values"><span><small>Before</small>{display(field, change.before)}</span><span><small>After</small>{display(field, change.after)}</span></div>
        </div>)}
        {item.notes && <div className="activity-note"><strong>{item.action === "evidence_requested" ? "Evidence requested" : "Private admin note"}</strong><p>{item.notes}</p></div>}
      </article>)}
      {!loading && !error && !rows.length && <div className="activity-empty"><AdminIcon name="clock" /><strong>No activity recorded yet</strong>
        <p>{query || action ? "Try another search or action filter." : "History starts when this feature is enabled. Earlier actions are not reconstructed."}</p></div>}
    </div>
    {!loading && rows.length > 0 && <p className="activity-count">Showing {rows.length} of {count} activities</p>}
    {rows.length < count && !error && <button type="button" className="activity-button" disabled={loading} onClick={() => setPage((value) => value + 1)}>{loading ? "Loading…" : "Load more activity"}</button>}
    <p className="activity-private"><AdminIcon name="shield" />Staff only · Read-only history</p>
  </section>;
}
