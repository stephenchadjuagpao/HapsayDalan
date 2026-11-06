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

export default function TrafficAdvisoryPage() {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true); // prevent flash of admin UI

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modals & Forms
  const [showComposer, setShowComposer] = useState(false);
  const [editingAdvisory, setEditingAdvisory] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Composer Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Road Closure");
  const [formMessage, setFormMessage] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formRoute, setFormRoute] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formStatus, setFormStatus] = useState("published");
  const [formMediaFile, setFormMediaFile] = useState(null);
  const [formMediaPreview, setFormMediaPreview] = useState(null);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef(null);

  // Notifications subscription (browser Push API / local polling)
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem("advisory_notifications") === "true"
  );

  // Active Dropdowns / Lightboxes / Comments
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeMediaModal, setActiveMediaModal] = useState(null);
  const [openCommentsId, setOpenCommentsId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [newCommentAuthor, setNewCommentAuthor] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});

  // Check admin authorization
  useEffect(() => {
    let alive = true;
    const hasLocalFlag = sessionStorage.getItem("ctmo_admin_authenticated") === "true";
    API.get("admin/me/")
      .then(({ data }) => {
        if (!alive) return;
        if (data && (data.is_staff || data.is_superuser || hasLocalFlag)) {
          setIsAdmin(true);
        }
      })
      .catch(() => {
        if (alive && hasLocalFlag) {
          setIsAdmin(true);
        }
      })
      .finally(() => {
        if (alive) setIsAdminLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Toggle browser notification subscription
  const toggleNotifications = async () => {
    if (typeof Notification === "undefined") {
      showToast("Your browser does not support notifications.");
      return;
    }
    if (notifEnabled) {
      // Unsubscribe
      localStorage.setItem("advisory_notifications", "false");
      setNotifEnabled(false);
      showToast("Notification alerts turned off.");
      return;
    }
    // Request permission if not yet granted
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm === "granted") {
      localStorage.setItem("advisory_notifications", "true");
      setNotifEnabled(true);
      showToast("🔔 You will now receive traffic advisory notifications!");
    } else {
      showToast("Notification permission denied. Enable it in your browser settings.");
    }
  };

  // Fetch Advisories (Public feed always fetches published advisories)
  const loadAdvisories = useCallback(async () => {
    setLoading(true);
    setError("");
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
      setError("Unable to load traffic advisories. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(loadAdvisories, 250);
    return () => clearTimeout(timer);
  }, [loadAdvisories]);

  // Poll for new advisories every 60 seconds and fire browser notification
  const lastAdvisoryIdRef = useRef(null);
  useEffect(() => {
    if (!notifEnabled) return;
    const poll = async () => {
      try {
        const { data } = await API.get("advisories/?page_size=1&page=1");
        const newest = (Array.isArray(data) ? data : data?.results || [])[0];
        if (!newest) return;
        if (lastAdvisoryIdRef.current === null) {
          lastAdvisoryIdRef.current = newest.id;
          return;
        }
        if (newest.id !== lastAdvisoryIdRef.current && Notification.permission === "granted") {
          lastAdvisoryIdRef.current = newest.id;
          new Notification("CTMO Surigao City – New Traffic Advisory", {
            body: newest.title || newest.message || "A new traffic advisory has been posted.",
            icon: "/favicon.ico",
          });
          loadAdvisories();
        }
      } catch {
        /* ignore polling errors */
      }
    };
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [notifEnabled, loadAdvisories]);

  // Open Composer for Editing Existing Announcement
  const openEditComposer = (advisory) => {
    setEditingAdvisory(advisory);
    setFormTitle(advisory.title || "");
    setFormCategory(advisory.category || "Road Closure");
    setFormMessage(advisory.message || "");
    setFormLocation(advisory.affected_location || "");
    setFormRoute(advisory.alternative_route || "");
    setFormStartDate(advisory.start_datetime ? advisory.start_datetime.slice(0, 16) : "");
    setFormEndDate(advisory.end_datetime ? advisory.end_datetime.slice(0, 16) : "");
    setFormIsPinned(Boolean(advisory.is_pinned));
    setFormStatus(advisory.status || "published");
    setFormMediaFile(null);
    setFormMediaPreview(advisory.media_url || null);
    setFormError("");
    setShowComposer(true);
    setOpenMenuId(null);
  };

  // Handle Media File Selection
  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormMediaFile(file);
    const url = URL.createObjectURL(file);
    setFormMediaPreview(url);
  };

  // Submit Composer Form (Create / Edit)
  const handleSubmitAnnouncement = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() && !formMessage.trim()) {
      setFormError("Please enter an announcement title or description.");
      return;
    }
    setSubmittingForm(true);
    setFormError("");

    try {
      const formData = new FormData();
      formData.append("title", formTitle.trim());
      formData.append("category", formCategory);
      formData.append("message", formMessage.trim() || formTitle.trim());
      formData.append("affected_location", formLocation.trim());
      formData.append("alternative_route", formRoute.trim());
      formData.append("is_pinned", formIsPinned ? "true" : "false");
      formData.append("status", formStatus);
      formData.append("audience", "all");

      if (formStartDate) formData.append("start_datetime", new Date(formStartDate).toISOString());
      if (formEndDate) formData.append("end_datetime", new Date(formEndDate).toISOString());
      if (formMediaFile) formData.append("media", formMediaFile);

      if (editingAdvisory) {
        await API.patch(`admin/advisories/${editingAdvisory.id}/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToast("Announcement updated successfully!");
      } else {
        await API.post("admin/advisories/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToast("New traffic announcement published!");
      }

      setShowComposer(false);
      loadAdvisories();
    } catch (err) {
      const detail =
        err.response?.data?.message?.[0] ||
        err.response?.data?.detail ||
        "Could not save announcement. Please try again.";
      setFormError(detail);
    } finally {
      setSubmittingForm(false);
    }
  };

  // Pin / Unpin Advisory
  const togglePinAdvisory = async (advisory) => {
    try {
      await API.patch(`admin/advisories/${advisory.id}/pin/`, { is_pinned: !advisory.is_pinned });
      showToast(advisory.is_pinned ? "Announcement unpinned." : "Announcement pinned to top!");
      setOpenMenuId(null);
      loadAdvisories();
    } catch {
      showToast("Failed to update pin status.");
    }
  };

  // Archive / Unarchive Advisory
  const toggleArchiveAdvisory = async (advisory) => {
    try {
      await API.patch(`admin/advisories/${advisory.id}/archive/`);
      showToast(advisory.archived_at ? "Announcement restored from archive." : "Announcement archived.");
      setOpenMenuId(null);
      loadAdvisories();
    } catch {
      showToast("Failed to update archive status.");
    }
  };

  // Delete Advisory
  const confirmDeleteAdvisory = async () => {
    if (!deletingId) return;
    try {
      await API.delete(`admin/advisories/${deletingId}/`);
      showToast("Announcement permanently deleted.");
      setDeletingId(null);
      setOpenMenuId(null);
      loadAdvisories();
    } catch {
      showToast("Failed to delete announcement.");
    }
  };

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

            {/* Notification Subscribe Button — public users */}
            {!isAdmin && (
              <button
                type="button"
                className={`ta-notify-btn ${notifEnabled ? "is-subscribed" : ""}`}
                onClick={toggleNotifications}
                title={notifEnabled ? "Turn off notifications" : "Get notified of new advisories"}
              >
                <MaterialIcon name={notifEnabled ? "notifications" : "notifications_none"} />
                <span>{notifEnabled ? "Notifications On" : "Get Notified"}</span>
              </button>
            )}
          </div>
        </aside>

        {/* Center Column: Public Feed */}
        <main className="ta-main-feed">
          {/* Search & Category Filter Pills */}
          <div className="ta-filter-bar">
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
                        <span className="ta-post-globe" title="Public">🌐</span>
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

                    {/* Admin 3-Dot Management Menu (top right) */}
                    {!isAdminLoading && isAdmin && (
                      <div className="ta-post-actions-menu">
                        <button
                          type="button"
                          className="ta-icon-btn"
                          onClick={() =>
                            setOpenMenuId((cur) => (cur === item.id ? null : item.id))
                          }
                          title="Manage Post"
                        >
                          <MaterialIcon name="more_vert" />
                        </button>

                        {openMenuId === item.id && (
                          <div className="ta-menu-dropdown">
                            <button
                              type="button"
                              className="ta-menu-item"
                              onClick={() => togglePinAdvisory(item)}
                            >
                              <MaterialIcon name="push_pin" />
                              <span>{item.is_pinned ? "Unpin Post" : "Pin to Top"}</span>
                            </button>
                            <button
                              type="button"
                              className="ta-menu-item"
                              onClick={() => openEditComposer(item)}
                            >
                              <MaterialIcon name="edit" />
                              <span>Edit Announcement</span>
                            </button>
                            <button
                              type="button"
                              className="ta-menu-item"
                              onClick={() => toggleArchiveAdvisory(item)}
                            >
                              <MaterialIcon name="archive" />
                              <span>{item.archived_at ? "Unarchive Post" : "Archive Post"}</span>
                            </button>
                            <div className="ta-menu-divider" />
                            <button
                              type="button"
                              className="ta-menu-item is-danger"
                              onClick={() => setDeletingId(item.id)}
                            >
                              <MaterialIcon name="delete" />
                              <span>Delete Post</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Category Badge — below header, matches screenshot */}
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

                  {/* Reaction and Engagement Stats Bar — matches screenshot exactly */}
                  {((item.likes_count || 0) > 0 || (item.comments_count || 0) > 0) && (
                    <div className="ta-post-stats-bar">
                      <div className="ta-stats-row">
                        {(item.likes_count || 0) > 0 && (
                          <span className="ta-stats-reactions">
                            <span className="ta-reaction-bubble">👍</span>
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

      {/* Admin Composer Modal */}
      {showComposer && (
        <div className="ta-modal-backdrop" onClick={() => setShowComposer(false)}>
          <div className="ta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ta-modal-header">
              <h2>{editingAdvisory ? "Edit Traffic Advisory" : "Create Traffic Advisory"}</h2>
              <button
                type="button"
                className="ta-modal-close"
                onClick={() => setShowComposer(false)}
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <form onSubmit={handleSubmitAnnouncement} className="ta-modal-form">
              {formError && <div className="ta-form-error">{formError}</div>}

              {/* Title */}
              <div className="ta-form-group">
                <label className="ta-form-label">Announcement Title *</label>
                <input
                  type="text"
                  className="ta-form-input"
                  placeholder="e.g. Temporary Road Closure: Bilang-Bilang St."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </div>

              {/* Category */}
              <div className="ta-form-group">
                <label className="ta-form-label">Advisory Category *</label>
                <select
                  className="ta-form-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.label} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description / Content */}
              <div className="ta-form-group">
                <label className="ta-form-label">Description / Announcement Details *</label>
                <textarea
                  className="ta-form-textarea"
                  rows={4}
                  placeholder="Provide detailed instructions, reasons for advisory, and traffic personnel guidance..."
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  required
                />
              </div>

              {/* Location & Alternative Route */}
              <div className="ta-form-row">
                <div className="ta-form-group">
                  <label className="ta-form-label">Affected Location</label>
                  <input
                    type="text"
                    className="ta-form-input"
                    placeholder="e.g. Rizal St. cor. Borromeo"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
                <div className="ta-form-group">
                  <label className="ta-form-label">Alternative Route</label>
                  <input
                    type="text"
                    className="ta-form-input"
                    placeholder="e.g. Reroute via Boulevard / Taft St."
                    value={formRoute}
                    onChange={(e) => setFormRoute(e.target.value)}
                  />
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="ta-form-row">
                <div className="ta-form-group">
                  <label className="ta-form-label">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    className="ta-form-input"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="ta-form-group">
                  <label className="ta-form-label">End Date & Time</label>
                  <input
                    type="datetime-local"
                    className="ta-form-input"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Photo / Video Upload */}
              <div className="ta-form-group">
                <label className="ta-form-label">Photo or Video Evidence / Notice</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/*,video/*"
                  onChange={handleMediaChange}
                />
                <button
                  type="button"
                  className="ta-upload-box"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <MaterialIcon name="add_photo_alternate" />
                  <span>
                    {formMediaFile ? formMediaFile.name : "Click to select a photo or video"}
                  </span>
                </button>
                {formMediaPreview && (
                  <div className="ta-preview-box">
                    <img src={formMediaPreview} alt="Preview" className="ta-preview-img" />
                    <button
                      type="button"
                      className="ta-preview-remove"
                      onClick={() => {
                        setFormMediaFile(null);
                        setFormMediaPreview(null);
                      }}
                    >
                      <MaterialIcon name="close" />
                    </button>
                  </div>
                )}
              </div>

              {/* Pin & Status Options */}
              <div className="ta-form-options">
                <label className="ta-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                  />
                  <span>📌 Pin to top of feed (High Priority)</span>
                </label>

                <div className="ta-status-radios">
                  <label className="ta-radio-label">
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={formStatus === "published"}
                      onChange={() => setFormStatus("published")}
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label className="ta-radio-label">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={formStatus === "draft"}
                      onChange={() => setFormStatus("draft")}
                    />
                    <span>Save as Draft</span>
                  </label>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="ta-modal-footer">
                <button
                  type="button"
                  className="ta-btn-secondary"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ta-btn-primary" disabled={submittingForm}>
                  {submittingForm
                    ? "Saving..."
                    : editingAdvisory
                    ? "Update Announcement"
                    : formStatus === "draft"
                    ? "Save Draft"
                    : "Publish Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="ta-modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="ta-modal ta-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ta-confirm-icon">
              <MaterialIcon name="delete" />
            </div>
            <h3>Delete this announcement?</h3>
            <p>
              This will permanently remove the announcement and its comments from the feed. This action cannot be undone.
            </p>
            <div className="ta-modal-footer">
              <button
                type="button"
                className="ta-btn-secondary"
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ta-btn-danger"
                onClick={confirmDeleteAdvisory}
              >
                Delete Announcement
              </button>
            </div>
          </div>
        </div>
      )}

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
