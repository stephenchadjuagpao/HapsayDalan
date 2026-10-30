import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "./MaterialIcon";
import "./TrafficAdvisories.css";

const AUDIENCE_LABELS = {
  all: "Public portal and CTMO workspace",
  public: "Public portal",
  officers: "CTMO workspace",
};
const SEEN_ADVISORIES_KEY = "hapsaydalan_seen_traffic_advisories";

function readSeenAdvisoryIds() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SEEN_ADVISORIES_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

function rememberSeenAdvisories(ids) {
  try {
    const saved = readSeenAdvisoryIds();
    ids.forEach((id) => saved.add(String(id)));
    window.localStorage.setItem(SEEN_ADVISORIES_KEY, JSON.stringify([...saved]));
  } catch { /* The advisory still displays when browser storage is unavailable. */ }
}

export default function TrafficAdvisories({ admin = false, refreshKey = 0 }) {
  const [advisories, setAdvisories] = useState([]);
  const [error, setError] = useState("");
  const [archivingId, setArchivingId] = useState(null);
  const [view, setView] = useState("active");
  const [page, setPage] = useState(1);
  const [historyCount, setHistoryCount] = useState(0);
  const [publicDeadline, setPublicDeadline] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const shownIds = useRef(new Set());
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const path = admin ? (view === "all" ? `admin/advisories/?status=all&page=${page}` : "admin/advisories/") : "advisories/";
      const { data } = await API.get(path);
      if (currentRequest !== requestId.current) return;
      const rows = Array.isArray(data) ? data : data?.results || [];
      if (admin) {
        setAdvisories(rows);
        if (view === "all") setHistoryCount(data.count || 0);
      } else {
        const saved = readSeenAdvisoryIds();
        const unseen = rows.filter((item) => !shownIds.current.has(String(item.id)) && !saved.has(String(item.id)));
        if (unseen.length) {
          setAdvisories(unseen);
          setPublicDeadline(Date.now() + 5000);
        }
      }
      setError("");
    } catch {
      if (admin && currentRequest === requestId.current) setError("Could not load advisories. Try refreshing the page.");
    }
  }, [admin, view, page]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => { requestId.current += 1; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [load, refreshKey]);

  useEffect(() => {
    if (admin || !publicDeadline || !advisories.length) return;
    const ids = advisories.map((item) => String(item.id));
    ids.forEach((id) => shownIds.current.add(id));
    rememberSeenAdvisories(ids);
  }, [admin, advisories, publicDeadline]);

  useEffect(() => {
    if (admin || !publicDeadline) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((publicDeadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [admin, publicDeadline]);

  const archive = async (id) => {
    setArchivingId(id);
    setError("");
    try {
      await API.patch(`admin/advisories/${id}/archive/`);
      setAdvisories((current) => current.filter((item) => item.id !== id));
      await load();
    } catch {
      setError("Could not archive this advisory. Please try again.");
    } finally {
      setArchivingId(null);
    }
  };

  if (!admin && (!advisories.length || secondsLeft === 0)) return null;

  return <section className={`traffic-advisories ${admin ? "is-admin" : "is-public"}`} aria-label="Traffic advisories">
    <div className="traffic-advisories-heading"><MaterialIcon name="notifications" /><div>
      <h2>Traffic Advisories</h2>
      <p>{admin ? (view === "all" ? "All published and archived CTMO advisories" : "Active CTMO advisories by audience") : "Latest traffic updates from CTMO"}</p>
    </div>{!admin && <span className="traffic-advisory-countdown">Closes in {secondsLeft}s</span>}</div>
    {admin && <div className="traffic-advisory-tabs" role="group" aria-label="Advisory view">
      <button type="button" className={view === "active" ? "is-selected" : ""} aria-pressed={view === "active"}
        onClick={() => { setView("active"); setPage(1); }}>Active</button>
      <button type="button" className={view === "all" ? "is-selected" : ""} aria-pressed={view === "all"}
        onClick={() => { setView("all"); setPage(1); }}>All Advisories</button>
    </div>}
    {error && <p className="traffic-advisories-error" role="alert">{error}</p>}
    {!advisories.length && admin && !error && <p className="traffic-advisories-empty">{view === "all" ? "No advisories have been published yet." : "No active advisories yet."}</p>}
    <div className="traffic-advisories-list">{advisories.map((advisory) => <article className="traffic-advisory" key={advisory.id}>
      <p className="traffic-advisory-message">{advisory.message}</p>
      <div className="traffic-advisory-meta">
        <span>{new Date(advisory.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
        {admin && <span>{AUDIENCE_LABELS[advisory.audience] || advisory.audience}</span>}
        {admin && view === "all" && <span className={`traffic-advisory-status ${advisory.archived_at ? "is-archived" : ""}`}>
          {advisory.archived_at ? `Archived ${new Date(advisory.archived_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}` : "Active"}
        </span>}
      </div>
      {admin && view === "active" && <button type="button" className="traffic-advisory-archive" disabled={archivingId === advisory.id}
        onClick={() => archive(advisory.id)}>{archivingId === advisory.id ? "Archiving..." : "Archive advisory"}</button>}
    </article>)}</div>
    {admin && view === "all" && historyCount > 20 && <div className="traffic-advisory-pages">
      <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span>Page {page} of {Math.ceil(historyCount / 20)}</span>
      <button type="button" disabled={page * 20 >= historyCount} onClick={() => setPage((value) => value + 1)}>Next</button>
    </div>}
  </section>;
}
