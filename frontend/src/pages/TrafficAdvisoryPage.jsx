import React, { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "../components/MaterialIcon";
import Navbar from "../components/reusablecode/Navbar";
import ctmoShieldLogo from "../assets/ctmo-shield-logo-transparent.png";
import "./TrafficAdvisoryPage.css";

const CATEGORIES = [
  { label: "Road Closure", icon: "block", color: "#d92d20", bg: "#fef3f2" },
  { label: "Construction", icon: "construction", color: "#d97706", bg: "#fffbeb" },
  { label: "Heavy Traffic", icon: "directions_car", color: "#dc2626", bg: "#fef2f2" },
  { label: "Rerouting", icon: "alt_route", color: "#0284c7", bg: "#f0f9ff" },
  { label: "Accident", icon: "warning_amber", color: "#b91c1c", bg: "#fef2f2" },
  { label: "Emergency", icon: "error_outline", color: "#7c2d12", bg: "#ffedd5" },
];

function getCategoryConfig(category) {
  return (
    CATEGORIES.find((c) => c.label.toLowerCase() === (category || "").toLowerCase()) || {
      label: category || "Advisory",
      icon: "campaign",
      color: "#1877f2",
      bg: "#e7f0ff",
    }
  );
}

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

function formatSchedule(start, end) {
  if (!start && !end) return null;
  const opt = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  const sStr = start ? new Date(start).toLocaleString("en-PH", opt) : "Now";
  const eStr = end ? new Date(end).toLocaleString("en-PH", opt) : "Until further notice";
  return `${sStr} – ${eStr}`;
}

const SEEN_ADVISORIES_KEY = "hapsaydalan_seen_advisory_ids";

function getSeenAdvisoryIds() {
  try {
    const raw = localStorage.getItem(SEEN_ADVISORIES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordSeenAdvisoryIds(ids) {
  try {
    const set = getSeenAdvisoryIds();
    ids.forEach((id) => set.add(String(id)));
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(SEEN_ADVISORIES_KEY, JSON.stringify(arr));
  } catch {
    /* ignore storage errors */
  }
}

// Gentle audio chime for real-time advisory alert
function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* ignore audio errors */
  }
}

export default function TrafficAdvisoryPage() {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Toast
  const [toastMessage, setToastMessage] = useState("");

  // Notifications subscription (in-app alerts + browser Push API)
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem("advisory_notifications") === "true"
  );

  // Active Lightbox / Comments
  const [activeMediaModal, setActiveMediaModal] = useState(null);
  const [openCommentsId, setOpenCommentsId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [newCommentAuthor, setNewCommentAuthor] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});

  const isInitializedRef = useRef(false);
  const loadAdvisoriesRef = useRef();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Toggle advisory alerts subscription
  const toggleNotifications = async () => {
    if (notifEnabled) {
      localStorage.setItem("advisory_notifications", "false");
      setNotifEnabled(false);
      showToast("Advisory alerts turned off.");
      return;
    }

    // Turn ON in-app advisory alerts
    localStorage.setItem("advisory_notifications", "true");
    setNotifEnabled(true);
    showToast("Advisory alerts turned on! You will receive real-time updates.");

    // Also attempt browser push permission if supported
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  };

  // Fetch Advisories for current filter (Public feed — always published advisories only)
  // Accepts silent parameter so background real-time polls don't flash the loading spinner
  const loadAdvisories = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") {
        params.append("category", selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }

      const queryString = params.toString();
      const url = `advisories/${queryString ? `?${queryString}` : ""}`;
      const { data } = await API.get(url);
      const rows = Array.isArray(data) ? data : data?.results || [];
      setAdvisories(rows);
    } catch {
      if (!silent) {
        setError("Unable to load traffic advisories. Please check your connection.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [selectedCategory, searchQuery]);

  loadAdvisoriesRef.current = loadAdvisories;

  // Check for newly published announcements in the global "All" feed
  // Completely isolated from category clicks: alerts user exactly ONCE per announcement
  const checkForNewAdvisories = useCallback(async () => {
    try {
      const { data } = await API.get("advisories/");
      const allRows = Array.isArray(data) ? data : data?.results || [];
      if (!allRows.length) return;

      const currentIds = allRows.map((item) => String(item.id));
      const seenSet = getSeenAdvisoryIds();

      // On initial page load: mark all existing advisories as already seen
      // so the user is NEVER alerted about historical posts
      if (!isInitializedRef.current) {
        recordSeenAdvisoryIds(currentIds);
        isInitializedRef.current = true;
        return;
      }

      // Check for brand-new advisories that were NOT seen before
      const brandNew = allRows.filter((item) => !seenSet.has(String(item.id)));

      if (brandNew.length > 0) {
        // Record them immediately in localStorage so they can NEVER notify again
        recordSeenAdvisoryIds(brandNew.map((item) => String(item.id)));

        const newest = brandNew[0];

        // 1. Play audio chime
        playAlertChime();

        // 2. Browser push notification if user opted in and granted
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("CTMO Surigao City – New Traffic Advisory", {
              body: newest.title || newest.message || "A new traffic advisory has been posted.",
              icon: "/favicon.ico",
            });
          } catch {
            /* ignore notification error */
          }
        }

        // 3. Show in-app alert toast exactly once
        showToast(`New traffic advisory: ${newest.title || newest.message}`);

        // 4. Silently refresh the current feed list so it appears on screen immediately
        loadAdvisoriesRef.current?.(true);
      }
    } catch {
      /* ignore background check errors */
    }
  }, []); // EMPTY DEPENDENCY ARRAY: Never recreated on category filter change!

  // Initial load & debounced search/category filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAdvisories(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAdvisories]);

  // Initialize known advisories once on mount
  useEffect(() => {
    checkForNewAdvisories();
  }, [checkForNewAdvisories]);

  // Real-time auto-refresh, cross-tab sync & background polling (every 3 seconds)
  useEffect(() => {
    const triggerSync = () => {
      checkForNewAdvisories();
      loadAdvisoriesRef.current?.(true);
    };

    const handleStorage = (e) => {
      if (e.key === "hapsaydalan_advisory_updated") {
        triggerSync();
      }
    };
    const handleCustomEvent = () => {
      triggerSync();
    };
    const handleFocus = () => {
      triggerSync();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        triggerSync();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("hapsaydalan_advisory_updated", handleCustomEvent);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // Fast silent polling every 3 seconds for instant updates
    const interval = setInterval(() => {
      if (!document.hidden) {
        triggerSync();
      }
    }, 3000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("hapsaydalan_advisory_updated", handleCustomEvent);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [checkForNewAdvisories]);

  // Citizen Reaction / Like
  const handleLike = async (advisoryId) => {
    try {
      const clientId =
        localStorage.getItem("hapsaydalan_client_id") ||
        `client_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("hapsaydalan_client_id", clientId);

      const { data } = await API.post(
        `advisories/${advisoryId}/like/`,
        { client_id: clientId },
        { headers: { "X-Client-ID": clientId } }
      );

      setAdvisories((prev) =>
        prev.map((item) =>
          item.id === advisoryId
            ? { ...item, likes_count: data.likes_count, user_has_liked: data.liked }
            : item
        )
      );
    } catch {
      showToast("Could not register like.");
    }
  };

  // Toggle & Load Comments
  const toggleComments = async (advisoryId) => {
    if (openCommentsId === advisoryId) {
      setOpenCommentsId(null);
      return;
    }
    setOpenCommentsId(advisoryId);
    if (!commentsMap[advisoryId]) {
      try {
        const { data } = await API.get(`advisories/${advisoryId}/comments/`);
        setCommentsMap((prev) => ({ ...prev, [advisoryId]: data }));
      } catch {
        showToast("Could not load comments.");
      }
    }
  };

  // Post New Citizen Comment
  const handlePostComment = async (advisoryId) => {
    const text = (newCommentText[advisoryId] || "").trim();
    if (!text) return;

    setCommentSubmitting((prev) => ({ ...prev, [advisoryId]: true }));
    try {
      const author = (newCommentAuthor[advisoryId] || "").trim() || "Citizen";
      const { data } = await API.post(`advisories/${advisoryId}/comments/`, {
        author_name: author,
        comment: text,
      });

      setCommentsMap((prev) => ({
        ...prev,
        [advisoryId]: [...(prev[advisoryId] || []), data],
      }));
      setNewCommentText((prev) => ({ ...prev, [advisoryId]: "" }));
      setAdvisories((prev) =>
        prev.map((item) =>
          item.id === advisoryId
            ? { ...item, comments_count: (item.comments_count || 0) + 1 }
            : item
        )
      );
    } catch {
      showToast("Failed to post comment.");
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [advisoryId]: false }));
    }
  };

  // Share Advisory
  const handleShare = async (advisory) => {
    const shareUrl = `${window.location.origin}/advisory#advisory-${advisory.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: advisory.title || "CTMO Surigao Traffic Advisory",
          text: advisory.message,
          url: shareUrl,
        });
        return;
      } catch {
        /* User cancelled or unsupported */
      }
    }
    navigator.clipboard?.writeText(shareUrl);
    showToast("Advisory link copied to clipboard!");
  };

  return (
    <div className="ta-page">
      <Navbar currentPage="advisory" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="ta-toast" role="status">
          <MaterialIcon name="check_circle" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="ta-layout">
        {/* Left Column: Official Page Info Card */}
        <aside className="ta-sidebar-left">
          <div className="ta-profile-card">
            <div className="ta-profile-cover" />
            <div className="ta-profile-avatar-wrap">
              <img src={ctmoShieldLogo} alt="CTMO Surigao City" className="ta-profile-avatar" />
              <span className="ta-profile-online-badge" title="Active Agency" />
            </div>
            <div className="ta-profile-details">
              <h2 className="ta-profile-name">
                CTMO Surigao City
                <span className="ta-verified-badge" title="Verified Government Office">
                  <MaterialIcon name="verified" />
                </span>
              </h2>
              <p className="ta-profile-handle">@surigaoctmo · City Traffic Management</p>
              <p className="ta-profile-desc">
                Official real-time road advisories, traffic alerts, construction rerouting, and emergency
                announcements for Surigao City.
              </p>
            </div>

            <div className="ta-profile-stats">
              <div className="ta-stat-item">
                <span className="ta-stat-val">{advisories.length}</span>
                <span className="ta-stat-lbl">Active Posts</span>
              </div>
              <div className="ta-stat-divider" />
              <div className="ta-stat-item">
                <span className="ta-stat-val">24/7</span>
                <span className="ta-stat-lbl">Monitoring</span>
              </div>
            </div>

            <div className="ta-profile-contact">
              <div className="ta-contact-row">
                <MaterialIcon name="place" />
                <span>City Hall Complex, Surigao City</span>
              </div>
              <div className="ta-contact-row">
                <MaterialIcon name="headset_mic" />
                <span>Hotline: 0912 064 6724</span>
              </div>
            </div>

            {/* Notification Subscribe Button */}
            <button
              type="button"
              className={`ta-notify-btn ${notifEnabled ? "is-subscribed" : ""}`}
              onClick={toggleNotifications}
              title={notifEnabled ? "Turn off notifications" : "Get notified of new advisories"}
            >
              <MaterialIcon name={notifEnabled ? "notifications" : "notifications_none"} />
              <span>{notifEnabled ? "Notifications On" : "Get Notified"}</span>
            </button>
          </div>
        </aside>

        {/* Center Column: Public Feed */}
        <main className="ta-main-feed">
          {/* Search & Category Filter Pills */}
          <div className="ta-filter-bar">
            {/* Mobile Notification Subscribe Pill (Mobile Only) */}
            <div className="ta-mobile-notify-wrap">
              <button
                type="button"
                className={`ta-mobile-notify-pill ${notifEnabled ? "is-subscribed" : ""}`}
                onClick={toggleNotifications}
              >
                <MaterialIcon name={notifEnabled ? "notifications" : "notifications_none"} />
                <span>{notifEnabled ? "Advisory Alerts On" : "Get Real-Time Road Alerts"}</span>
              </button>
            </div>

            <div className="ta-search-wrap">
              <MaterialIcon name="search" />
              <input
                type="text"
                className="ta-search-input"
                placeholder="Search advisories, streets, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ta-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <MaterialIcon name="close" />
                </button>
              )}
            </div>

            <div className="ta-category-pills">
              <button
                type="button"
                className={`ta-pill ${selectedCategory === "All" ? "active" : ""}`}
                onClick={() => setSelectedCategory("All")}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  className={`ta-pill ${selectedCategory === cat.label ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.label)}
                >
                  <MaterialIcon name={cat.icon} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="ta-feed-loading">
              <div className="ta-spinner" />
              <span>Fetching latest announcements from CTMO...</span>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="ta-feed-error">
              <MaterialIcon name="error_outline" />
              <p>{error}</p>
              <button type="button" className="ta-btn-primary" onClick={loadAdvisories}>
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && advisories.length === 0 && (
            <div className="ta-feed-empty">
              <MaterialIcon name="campaign" />
              <h3>No traffic announcements found</h3>
              <p>
                {searchQuery || selectedCategory !== "All"
                  ? "Try adjusting your search or category filter to view other advisories."
                  : "All roadways are clear. Check back later for official CTMO updates."}
              </p>
            </div>
          )}

          {/* Feed List */}
          <div className="ta-feed-list">
            {advisories.map((item) => {
              const catConfig = getCategoryConfig(item.category);
              const schedule = formatSchedule(item.start_datetime, item.end_datetime);
              const comments = commentsMap[item.id] || item.recent_comments || [];
              const commentsOpen = openCommentsId === item.id;

              return (
                <article
                  key={item.id}
                  id={`advisory-${item.id}`}
                  className={`ta-post-card ${item.is_pinned ? "is-pinned" : ""}`}
                >
                  {/* Pinned Announcement Indicator */}
                  {item.is_pinned && (
                    <div className="ta-pinned-banner">
                      <MaterialIcon name="push_pin" />
                      <span>PINNED ANNOUNCEMENT · HIGH PRIORITY</span>
                    </div>
                  )}

                  {/* Post Header */}
                  <div className="ta-post-header">
                    <img src={ctmoShieldLogo} alt="CTMO" className="ta-post-avatar" />
                    <div className="ta-post-meta">
                      <div className="ta-post-author-row">
                        <span className="ta-post-author">CTMO Surigao City</span>
                        <span className="ta-verified-badge" title="Verified Government Office">
                          <MaterialIcon name="verified" />
                        </span>
                      </div>
                      <div className="ta-post-sub-name">Surigao City Traffic Management Office</div>
                      <div className="ta-post-sub-row">
                        <span className="ta-post-time">{timeAgo(item.created_at)}</span>
                        <span className="ta-post-dot">·</span>
                        <span className="ta-post-globe" title="Public">
                          <MaterialIcon name="public" />
                        </span>
                        {item.status && item.status !== "published" && (
                          <span className={`ta-post-status-badge is-${item.status}`}>
                            {item.status.toUpperCase()}
                          </span>
                        )}
                        {item.archived_at && (
                          <span className="ta-post-status-badge is-archived">ARCHIVED</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category Badge */}
                  <div className="ta-post-category-row">
                    <span
                      className="ta-category-badge"
                      style={{ color: catConfig.color, backgroundColor: catConfig.bg }}
                    >
                      <MaterialIcon name={catConfig.icon} />
                      <span>{catConfig.label.toUpperCase()}</span>
                    </span>
                  </div>

                  {/* Post Content */}
                  <div className="ta-post-body">
                    {item.title && <h3 className="ta-post-title">{item.title}</h3>}
                    <p className="ta-post-message">{item.message}</p>
                  </div>

                  {/* Operational Details (Location & Alternative Route) */}
                  {(item.affected_location || item.alternative_route || schedule) && (
                    <div className="ta-details-box">
                      {item.affected_location && (
                        <div className="ta-detail-row is-location">
                          <div className="ta-detail-icon-wrap">
                            <MaterialIcon name="place" />
                          </div>
                          <div>
                            <span className="ta-detail-label">AFFECTED LOCATION</span>
                            <span className="ta-detail-val">{item.affected_location}</span>
                          </div>
                        </div>
                      )}

                      {item.alternative_route && (
                        <div className="ta-detail-row is-route">
                          <div className="ta-detail-icon-wrap">
                            <MaterialIcon name="alt_route" />
                          </div>
                          <div>
                            <span className="ta-detail-label">RECOMMENDED ALTERNATIVE ROUTE</span>
                            <span className="ta-detail-val">{item.alternative_route}</span>
                          </div>
                        </div>
                      )}

                      {schedule && (
                        <div className="ta-detail-row is-schedule">
                          <div className="ta-detail-icon-wrap">
                            <MaterialIcon name="schedule" />
                          </div>
                          <div>
                            <span className="ta-detail-label">DURATION / ADVISORY SCHEDULE</span>
                            <span className="ta-detail-val">{schedule}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Photo or Video Media Attachment */}
                  {item.media_url && (
                    <div className="ta-post-media" onClick={() => setActiveMediaModal(item.media_url)}>
                      {item.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video
                          src={item.media_url}
                          controls
                          className="ta-media-video"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <img
                          src={item.media_url}
                          alt={item.title || "Traffic Advisory"}
                          className="ta-media-img"
                          loading="lazy"
                        />
                      )}
                    </div>
                  )}

                  {/* Reaction and Engagement Stats Bar */}
                  {((item.likes_count || 0) > 0 || (item.comments_count || 0) > 0) && (
                    <div className="ta-post-stats-bar">
                      <div className="ta-stats-row">
                        {(item.likes_count || 0) > 0 && (
                          <span className="ta-stats-reactions">
                            <span className="ta-reaction-bubble" aria-label="Reaction">
                              <MaterialIcon name="thumb_up" />
                            </span>
                            <span>{item.likes_count} {item.likes_count === 1 ? "reaction" : "reactions"}</span>
                          </span>
                        )}
                        {(item.likes_count || 0) > 0 && (item.comments_count || 0) > 0 && (
                          <span className="ta-stats-sep"> · </span>
                        )}
                        {(item.comments_count || 0) > 0 && (
                          <button
                            type="button"
                            className="ta-stats-btn"
                            onClick={() => toggleComments(item.id)}
                          >
                            {item.comments_count} {item.comments_count === 1 ? "comment" : "comments"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons: Like, Comment, Share */}
                  <div className="ta-post-actions-bar">
                    <button
                      type="button"
                      className={`ta-action-btn ${item.user_has_liked ? "is-liked" : ""}`}
                      onClick={() => handleLike(item.id)}
                    >
                      <MaterialIcon name="thumb_up" />
                      <span>{item.user_has_liked ? "Liked" : "Like"}</span>
                    </button>
                    <button
                      type="button"
                      className="ta-action-btn"
                      onClick={() => toggleComments(item.id)}
                    >
                      <MaterialIcon name="chat_bubble_outline" />
                      <span>Comment</span>
                    </button>
                    <button
                      type="button"
                      className="ta-action-btn"
                      onClick={() => handleShare(item)}
                    >
                      <MaterialIcon name="share" />
                      <span>Share</span>
                    </button>
                  </div>

                  {/* Collapsible Citizen Comments Drawer */}
                  {commentsOpen && (
                    <div className="ta-comments-section">
                      {/* Comment Input */}
                      <div className="ta-comment-input-box">
                        <div className="ta-comment-avatar-placeholder">
                          <MaterialIcon name="account_circle" />
                        </div>
                        <div className="ta-comment-fields">
                          <input
                            type="text"
                            className="ta-comment-author-input"
                            placeholder="Your Name (e.g. Juan D.)"
                            value={newCommentAuthor[item.id] || ""}
                            onChange={(e) =>
                              setNewCommentAuthor((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="ta-comment-input-row">
                            <input
                              type="text"
                              className="ta-comment-text-input"
                              placeholder="Write a comment or ask for updates..."
                              value={newCommentText[item.id] || ""}
                              onChange={(e) =>
                                setNewCommentText((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handlePostComment(item.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="ta-comment-send-btn"
                              disabled={
                                !newCommentText[item.id]?.trim() || commentSubmitting[item.id]
                              }
                              onClick={() => handlePostComment(item.id)}
                            >
                              <MaterialIcon name="arrow_forward" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Comment List */}
                      <div className="ta-comments-list">
                        {comments.length === 0 ? (
                          <p className="ta-comments-empty">
                            No comments yet. Be the first to share an update.
                          </p>
                        ) : (
                          comments.map((c) => (
                            <div key={c.id} className="ta-comment-bubble-wrap">
                              <div className="ta-comment-bubble">
                                <span className="ta-comment-author">{c.author_name}</span>
                                <p className="ta-comment-text">{c.comment}</p>
                              </div>
                              <span className="ta-comment-time">{timeAgo(c.created_at)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </main>
      </div>

      {/* Lightbox Media Modal */}
      {activeMediaModal && (
        <div className="ta-lightbox-backdrop" onClick={() => setActiveMediaModal(null)}>
          <div className="ta-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ta-lightbox-close"
              onClick={() => setActiveMediaModal(null)}
            >
              <MaterialIcon name="close" />
            </button>
            {activeMediaModal.match(/\.(mp4|webm|mov)$/i) ? (
              <video src={activeMediaModal} controls autoPlay className="ta-lightbox-media" />
            ) : (
              <img src={activeMediaModal} alt="Enlarged advisory" className="ta-lightbox-media" />
            )}
          </div>
        </div>
      )}

      {/* Public Footer */}
      <footer className="ta-footer">
        <span>© 2026 Surigao City Traffic Management Office (CTMO). All rights reserved.</span>
      </footer>
    </div>
  );
}
