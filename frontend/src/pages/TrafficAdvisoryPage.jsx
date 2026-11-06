import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "../components/MaterialIcon";
import Navbar from "../components/reusablecode/Navbar";
import "./TrafficAdvisoryPage.css";

const PAGE_SIZE = 10;

function timeAgo(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function AdvisoryCard({ advisory }) {
  const [expanded, setExpanded] = useState(false);
  const msg = advisory.message || "";
  const isLong = msg.length > 220;
  const displayed = !isLong || expanded ? msg : msg.slice(0, 220) + "…";

  return (
    <article className="ta-feed-card">
      <div className="ta-feed-card-header">
        <div className="ta-feed-avatar">
          <MaterialIcon name="campaign" />
        </div>
        <div className="ta-feed-card-meta">
          <span className="ta-feed-author">CTMO Surigao City</span>
          <span className="ta-feed-org">Surigao City Traffic Management Office</span>
          <span className="ta-feed-time">
            <MaterialIcon name="schedule" />
            {timeAgo(advisory.created_at)}
          </span>
        </div>
        <div className="ta-feed-badge">
          <MaterialIcon name="notifications_active" />
          Advisory
        </div>
      </div>

      <div className="ta-feed-body">
        <p className="ta-feed-message">{displayed}</p>
        {isLong && (
          <button className="ta-feed-see-more" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>

      <div className="ta-feed-footer">
        <span className="ta-feed-timestamp">
          {new Date(advisory.created_at).toLocaleString("en-PH", {
            weekday: "short", month: "short", day: "numeric",
            year: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        {advisory.archived_at && (
          <span className="ta-feed-archived">
            <MaterialIcon name="archive" /> Archived
          </span>
        )}
      </div>
    </article>
  );
}

export default function TrafficAdvisoryPage() {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async (pageNum, append) => {
    const currentRequest = ++requestId.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const { data } = await API.get(`advisories/?page=${pageNum}&page_size=${PAGE_SIZE}`);
      if (currentRequest !== requestId.current) return;
      const rows = Array.isArray(data) ? data : (data?.results || []);
      const count = data?.count != null ? data.count : rows.length;
      setTotal(count);
      if (append) {
        setAdvisories((prev) => {
          const merged = [...prev, ...rows];
          setHasMore(merged.length < count);
          return merged;
        });
      } else {
        setAdvisories(rows);
        setHasMore(rows.length < count);
      }
    } catch {
      if (currentRequest === requestId.current) {
        setError("Could not load advisories. Please try again.");
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    load(1, false);
  }, [load]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, true);
  };

  return (
    <div className="ta-page">
      <Navbar currentPage="advisory" />

      <div className="ta-page-inner">
        <header className="ta-page-header">
          <div className="ta-page-header-icon">
            <MaterialIcon name="campaign" />
          </div>
          <div>
            <h1 className="ta-page-title">Traffic Advisory</h1>
            <p className="ta-page-subtitle">
              Official announcements from the Surigao City Traffic Management Office
            </p>
          </div>
        </header>

        <div className="ta-feed">
          {loading && (
            <div className="ta-feed-loading">
              <div className="ta-spinner" />
              <span>Loading advisories…</span>
            </div>
          )}

          {!loading && error && (
            <div className="ta-feed-error">
              <MaterialIcon name="error_outline" />
              <span>{error}</span>
              <button className="ta-btn-retry" onClick={() => load(1, false)}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && advisories.length === 0 && (
            <div className="ta-feed-empty">
              <MaterialIcon name="notifications_none" />
              <p>No traffic advisories yet.</p>
              <small>Check back later for updates from CTMO.</small>
            </div>
          )}

          {advisories.map((advisory) => (
            <AdvisoryCard key={advisory.id} advisory={advisory} />
          ))}

          {!loading && !error && hasMore && (
            <button className="ta-btn-load-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <><div className="ta-spinner ta-spinner-sm" /> Loading…</>
              ) : (
                <><MaterialIcon name="expand_more" /> Load more advisories</>
              )}
            </button>
          )}

          {!loading && !error && advisories.length > 0 && !hasMore && (
            <p className="ta-feed-end">
              <MaterialIcon name="check_circle" />
              All {total} {total === 1 ? "advisory" : "advisories"} shown
            </p>
          )}
        </div>
      </div>

      <footer className="ta-footer">
        <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
      </footer>
    </div>
  );
}
