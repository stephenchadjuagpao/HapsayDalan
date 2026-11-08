import React, { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "./MaterialIcon";
import "./AdminAdvisories.css";

const CATEGORIES = [
  { label: "Road Closure", icon: "block", color: "#dc2626", bg: "#fef2f2" },
  { label: "Construction", icon: "construction", color: "#d97706", bg: "#fffbeb" },
  { label: "Heavy Traffic", icon: "directions_car", color: "#b91c1c", bg: "#fef2f2" },
  { label: "Rerouting", icon: "alt_route", color: "#0284c7", bg: "#f0f9ff" },
  { label: "Accident", icon: "warning_amber", color: "#c026d3", bg: "#fdf4ff" },
  { label: "Emergency", icon: "error_outline", color: "#7c2d12", bg: "#ffedd5" },
];

export default function AdminAdvisories({ refreshKey = 0, onAdvisoryChange }) {
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusTab, setStatusTab] = useState("published"); // published | draft | archived
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Composer Modal State
  const [showComposer, setShowComposer] = useState(false);
  const [editingAdvisory, setEditingAdvisory] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Comments view modal
  const [viewingCommentsAdvisory, setViewingCommentsAdvisory] = useState(null);
  const [advisoryComments, setAdvisoryComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Form Fields
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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const loadAdvisories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("status", statusTab);
      if (selectedCategory && selectedCategory !== "All") {
        params.append("category", selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      const { data } = await API.get(`admin/advisories/?${params.toString()}`);
      const rows = Array.isArray(data) ? data : data?.results || [];
      setAdvisories(rows);
    } catch {
      setError("Failed to load advisories. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [statusTab, selectedCategory, searchQuery]);

  useEffect(() => {
    loadAdvisories();
  }, [loadAdvisories, refreshKey]);

  const broadcastAdvisoryChange = () => {
    try {
      localStorage.setItem("hapsaydalan_advisory_updated", Date.now().toString());
      window.dispatchEvent(new CustomEvent("hapsaydalan_advisory_updated"));
    } catch {
      /* ignore */
    }
  };

  const openNewComposer = () => {
    setEditingAdvisory(null);
    setFormTitle("");
    setFormCategory("Road Closure");
    setFormMessage("");
    setFormLocation("");
    setFormRoute("");
    setFormStartDate("");
    setFormEndDate("");
    setFormIsPinned(false);
    setFormStatus(statusTab === "draft" ? "draft" : "published");
    setFormMediaFile(null);
    setFormMediaPreview(null);
    setFormError("");
    setShowComposer(true);
  };

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
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormMediaFile(file);
    setFormMediaPreview(URL.createObjectURL(file));
  };

  const parseIsoDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() && !formMessage.trim()) {
      setFormError("Please provide an announcement title or advisory description.");
      return;
    }
    setSubmittingForm(true);
    setFormError("");
    try {
      const startIso = parseIsoDate(formStartDate);
      const endIso = parseIsoDate(formEndDate);

      let payload;
      if (formMediaFile) {
        const formData = new FormData();
        formData.append("title", formTitle.trim());
        formData.append("category", formCategory);
        formData.append("message", formMessage.trim() || formTitle.trim());
        formData.append("affected_location", formLocation.trim());
        formData.append("alternative_route", formRoute.trim());
        formData.append("is_pinned", formIsPinned ? "true" : "false");
        formData.append("status", formStatus);
        formData.append("audience", "all");
        if (startIso) formData.append("start_datetime", startIso);
        if (endIso) formData.append("end_datetime", endIso);
        formData.append("media", formMediaFile);
        payload = formData;
      } else {
        payload = {
          title: formTitle.trim(),
          category: formCategory,
          message: formMessage.trim() || formTitle.trim(),
          affected_location: formLocation.trim(),
          alternative_route: formRoute.trim(),
          is_pinned: Boolean(formIsPinned),
          status: formStatus,
          audience: "all",
        };
        if (startIso) payload.start_datetime = startIso;
        if (endIso) payload.end_datetime = endIso;
      }

      if (editingAdvisory) {
        await API.patch(`admin/advisories/${editingAdvisory.id}/`, payload);
        showToast("Announcement updated successfully!");
      } else {
        await API.post("admin/advisories/", payload);
        showToast("New traffic announcement published!");
      }

      setShowComposer(false);
      loadAdvisories();
      broadcastAdvisoryChange();
      onAdvisoryChange?.();
    } catch (err) {
      const detail =
        err.response?.data?.message?.[0] ||
        err.response?.data?.detail ||
        "Could not save advisory. Please check your fields and retry.";
      setFormError(detail);
    } finally {
      setSubmittingForm(false);
    }
  };

  const togglePin = async (advisory) => {
    try {
      await API.patch(`admin/advisories/${advisory.id}/pin/`, { is_pinned: !advisory.is_pinned });
      showToast(advisory.is_pinned ? "Advisory unpinned." : "Advisory pinned to top!");
      loadAdvisories();
      broadcastAdvisoryChange();
      onAdvisoryChange?.();
    } catch {
      showToast("Could not update pin status.");
    }
  };

  const toggleArchive = async (advisory) => {
    try {
      await API.patch(`admin/advisories/${advisory.id}/archive/`);
      showToast(advisory.archived_at ? "Advisory restored from archive." : "Advisory moved to archive.");
      loadAdvisories();
      broadcastAdvisoryChange();
      onAdvisoryChange?.();
    } catch {
      showToast("Could not update archive status.");
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await API.delete(`admin/advisories/${deletingId}/`);
      showToast("Advisory permanently deleted.");
      setDeletingId(null);
      loadAdvisories();
      broadcastAdvisoryChange();
      onAdvisoryChange?.();
    } catch {
      showToast("Failed to delete advisory.");
    }
  };

  const openComments = async (advisory) => {
    setViewingCommentsAdvisory(advisory);
    setLoadingComments(true);
    try {
      const { data } = await API.get(`advisories/${advisory.id}/comments/`);
      setAdvisoryComments(data || []);
    } catch {
      setAdvisoryComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  return (
    <section className="admin-advisories-page" aria-label="Traffic Advisories Management">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-adv-toast" role="status">
          <MaterialIcon name="check_circle" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="admin-adv-header">
        <div>
          <span className="admin-eyebrow">CTMO DISPATCH & COMMUNICATIONS</span>
          <h2 className="admin-adv-title">Traffic Advisories & Announcements</h2>
          <p className="admin-adv-subtitle">
            Create, publish, and manage real-time road closures, construction alerts, and traffic notices.
          </p>
        </div>
        <button
          type="button"
          className="admin-adv-primary-btn"
          onClick={openNewComposer}
        >
          <MaterialIcon name="campaign" />
          <span>+ Create Announcement</span>
        </button>
      </div>

      {/* Tabs Bar: Published, Drafts, Archived */}
      <div className="admin-adv-tabs-bar">
        <div className="admin-adv-tabs">
          <button
            type="button"
            className={`admin-adv-tab ${statusTab === "published" ? "active" : ""}`}
            onClick={() => setStatusTab("published")}
          >
            <span>Published</span>
          </button>
          <button
            type="button"
            className={`admin-adv-tab ${statusTab === "draft" ? "active" : ""}`}
            onClick={() => setStatusTab("draft")}
          >
            <span>Drafts</span>
          </button>
          <button
            type="button"
            className={`admin-adv-tab ${statusTab === "archived" ? "active" : ""}`}
            onClick={() => setStatusTab("archived")}
          >
            <span>Archived</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="admin-adv-filters">
          <div className="admin-adv-search">
            <MaterialIcon name="search" />
            <input
              type="text"
              placeholder="Search advisories or streets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="admin-adv-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="admin-adv-loading">
          <div className="admin-adv-spinner" />
          <span>Loading CTMO advisories...</span>
        </div>
      )}

      {!loading && error && (
        <div className="admin-adv-error" role="alert">
          <MaterialIcon name="error_outline" />
          <span>{error}</span>
          <button type="button" onClick={loadAdvisories}>Retry</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && advisories.length === 0 && (
        <div className="admin-adv-empty">
          <MaterialIcon name="campaign" />
          <h3>No {statusTab} advisories found</h3>
          <p>
            {statusTab === "published"
              ? "No active traffic advisories currently broadcasted."
              : statusTab === "draft"
                ? "You don't have any saved drafts."
                : "No archived announcements."}
          </p>
          <button type="button" className="admin-adv-primary-btn" onClick={openNewComposer}>
            Create your first announcement
          </button>
        </div>
      )}

      {/* Advisories Grid / List */}
      {!loading && !error && advisories.length > 0 && (
        <div className="admin-adv-grid">
          {advisories.map((advisory) => {
            const cat = CATEGORIES.find((c) => c.label.toLowerCase() === (advisory.category || "").toLowerCase()) || {
              label: advisory.category || "Advisory",
              color: "#1877f2",
              bg: "#e7f0ff",
            };
            return (
              <article
                key={advisory.id}
                className={`admin-adv-card ${advisory.is_pinned ? "is-pinned" : ""}`}
              >
                {/* Pin Badge */}
                {advisory.is_pinned && (
                  <div className="admin-adv-pinned-tag">
                    <MaterialIcon name="push_pin" />
                    <span>PINNED TO TOP</span>
                  </div>
                )}

                {/* Card Top Meta */}
                <div className="admin-adv-card-header">
                  <span
                    className="admin-adv-category-badge"
                    style={{ color: cat.color, backgroundColor: cat.bg }}
                  >
                    {cat.label.toUpperCase()}
                  </span>
                  <div className="admin-adv-header-meta">
                    <span className="admin-adv-time">
                      {new Date(advisory.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className={`admin-adv-status-tag is-${advisory.status}`}>
                      {advisory.status?.toUpperCase() || "PUBLISHED"}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="admin-adv-card-title">{advisory.title || "Traffic Advisory Notice"}</h3>
                <p className="admin-adv-card-msg">{advisory.message}</p>

                {/* Location & Alternative Route */}
                {(advisory.affected_location || advisory.alternative_route) && (
                  <div className="admin-adv-details-box">
                    {advisory.affected_location && (
                      <div className="admin-adv-detail-row">
                        <span className="admin-adv-detail-icon red">
                          <MaterialIcon name="place" />
                        </span>
                        <div>
                          <strong>Affected Location:</strong> {advisory.affected_location}
                        </div>
                      </div>
                    )}
                    {advisory.alternative_route && (
                      <div className="admin-adv-detail-row">
                        <span className="admin-adv-detail-icon blue">
                          <MaterialIcon name="alt_route" />
                        </span>
                        <div>
                          <strong>Alternative Route:</strong> {advisory.alternative_route}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Media Attachment Preview */}
                {advisory.media_url && (
                  <div className="admin-adv-media-wrap">
                    <img src={advisory.media_url} alt="Notice attachment" />
                  </div>
                )}

                {/* Stats Bar */}
                <div className="admin-adv-stats-row">
                  <span className="admin-adv-stat">
                    <MaterialIcon name="thumb_up" />
                    <span>{advisory.likes_count || 0} citizen reactions</span>
                  </span>
                  <button
                    type="button"
                    className="admin-adv-comments-link"
                    onClick={() => openComments(advisory)}
                  >
                    <MaterialIcon name="chat" />
                    <span>{advisory.comments_count || 0} comments</span>
                  </button>
                </div>

                {/* Admin Management Actions Bar */}
                <div className="admin-adv-actions-bar">
                  <button
                    type="button"
                    className={`admin-adv-action-btn ${advisory.is_pinned ? "active" : ""}`}
                    onClick={() => togglePin(advisory)}
                    title={advisory.is_pinned ? "Unpin post" : "Pin post to top"}
                  >
                    <MaterialIcon name="push_pin" />
                    <span>{advisory.is_pinned ? "Unpin" : "Pin"}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-adv-action-btn"
                    onClick={() => openEditComposer(advisory)}
                  >
                    <MaterialIcon name="edit" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="admin-adv-action-btn"
                    onClick={() => toggleArchive(advisory)}
                  >
                    <MaterialIcon name="archive" />
                    <span>{advisory.archived_at ? "Restore" : "Archive"}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-adv-action-btn is-danger"
                    onClick={() => setDeletingId(advisory.id)}
                  >
                    <MaterialIcon name="delete" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ANNOUNCEMENT MODAL */}
      {showComposer && (
        <div className="admin-modal-backdrop" onClick={() => setShowComposer(false)}>
          <div
            className="admin-modal admin-adv-composer-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-header">
                <div className="admin-adv-modal-title-wrap">
                  <h3 className="admin-modal-title">
                    {editingAdvisory ? "Edit Traffic Advisory" : "Create Traffic Advisory"}
                  </h3>
                  <span className="admin-adv-ctmo-badge">CTMO Admin</span>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setShowComposer(false)}
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <div className="admin-modal-body">
                {formError && <div className="admin-adv-form-error">{formError}</div>}

                {/* Title */}
                <div className="admin-field-group">
                  <label className="admin-field-label">Announcement Title *</label>
                  <input
                    type="text"
                    className="admin-modal-input admin-adv-input-large"
                    placeholder="Enter advisory title (e.g. Road Closure: Bilang-Bilang St.)..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Category */}
                <div className="admin-field-group">
                  <label className="admin-field-label">Advisory Category *</label>
                  <select
                    className="admin-modal-select admin-adv-select-field"
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

                {/* Message / Description */}
                <div className="admin-field-group">
                  <label className="admin-field-label">Announcement Description *</label>
                  <textarea
                    className="admin-modal-textarea admin-adv-textarea-large"
                    rows="4"
                    maxLength={1000}
                    placeholder="Write your traffic announcement, rerouting plan, reasons, and guidelines here..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    required
                  />
                </div>

                {/* Upload Photos / Videos Dropzone */}
                <div className="admin-field-group">
                  <label className="admin-field-label">Upload Photos / Videos</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="image/*,video/*"
                    onChange={handleMediaChange}
                  />
                  <div
                    className="admin-adv-dropzone-btn"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <div className="admin-adv-dropzone-icon">
                      <MaterialIcon name="add_photo_alternate" />
                    </div>
                    <div className="admin-adv-dropzone-text">
                      <strong>Add photos or videos</strong>
                      <span>Upload supporting advisory media or notice flyer</span>
                    </div>
                  </div>

                  {formMediaPreview && (
                    <div className="admin-adv-preview-card">
                      <img src={formMediaPreview} alt="Selected preview" />
                      <div className="admin-adv-preview-info">
                        <span className="admin-adv-preview-name">
                          {formMediaFile ? formMediaFile.name : "Attached Media"}
                        </span>
                        <button
                          type="button"
                          className="admin-adv-preview-delete"
                          onClick={() => {
                            setFormMediaFile(null);
                            setFormMediaPreview(null);
                          }}
                        >
                          <MaterialIcon name="delete" /> Remove Media
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Location & Alternative Route */}
                <div className="admin-adv-row-2">
                  <div className="admin-field-group">
                    <label className="admin-field-label">Affected Location</label>
                    <input
                      type="text"
                      className="admin-modal-input"
                      placeholder="Enter road or location (e.g. Rizal St. cor. Borromeo)..."
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                    />
                  </div>
                  <div className="admin-field-group">
                    <label className="admin-field-label">Alternative Route</label>
                    <input
                      type="text"
                      className="admin-modal-input"
                      placeholder="Enter alternative route (e.g. Reroute via Boulevard)..."
                      value={formRoute}
                      onChange={(e) => setFormRoute(e.target.value)}
                    />
                  </div>
                </div>

                {/* Advisory Schedule */}
                <div className="admin-field-group">
                  <label className="admin-field-label">Advisory Schedule</label>
                  <div className="admin-adv-row-2">
                    <div className="admin-adv-date-field">
                      <span className="admin-adv-date-label">Start date & time</span>
                      <input
                        type="datetime-local"
                        className="admin-modal-input"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                      />
                    </div>
                    <div className="admin-adv-date-field">
                      <span className="admin-adv-date-label">End date & time</span>
                      <input
                        type="datetime-local"
                        className="admin-modal-input"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Pin & Status Options */}
                <div className="admin-adv-options-card">
                  <label className="admin-adv-check">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                    />
                    <span className="admin-adv-pin-label">
                      <MaterialIcon name="push_pin" />
                      <span><strong>Pin this announcement</strong> to the top of the feed</span>
                    </span>
                  </label>

                  <div className="admin-adv-status-selector">
                    <span className="admin-adv-status-title">Publishing Option:</span>
                    <div className="admin-adv-radios">
                      <label className={`admin-adv-radio-btn ${formStatus === "published" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="adv_status"
                          value="published"
                          checked={formStatus === "published"}
                          onChange={() => setFormStatus("published")}
                        />
                        <span className="admin-adv-radio-content">
                          <MaterialIcon name="send" />
                          <span>Publish Immediately</span>
                        </span>
                      </label>
                      <label className={`admin-adv-radio-btn ${formStatus === "draft" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="adv_status"
                          value="draft"
                          checked={formStatus === "draft"}
                          onChange={() => setFormStatus("draft")}
                        />
                        <span className="admin-adv-radio-content">
                          <MaterialIcon name="drafts" />
                          <span>Save as Draft</span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Big, Clear, Beautiful Action Buttons */}
              <div className="admin-modal-footer admin-adv-modal-footer">
                <button
                  type="button"
                  className="admin-adv-btn-cancel"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </button>

                <div className="admin-adv-footer-actions">
                  {formStatus === "draft" ? (
                    <button
                      type="submit"
                      className="admin-adv-btn-draft"
                      disabled={submittingForm}
                    >
                      <MaterialIcon name="article" />
                      <span>{submittingForm ? "Saving Draft..." : "Save as Draft"}</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="admin-adv-btn-publish"
                      disabled={submittingForm}
                    >
                      <MaterialIcon name="campaign" />
                      <span>
                        {submittingForm
                          ? "Publishing..."
                          : editingAdvisory
                            ? "Update Announcement"
                            : "Publish Announcement"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deletingId && (
        <div className="admin-modal-backdrop" onClick={() => setDeletingId(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Delete Announcement?</h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setDeletingId(null)}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Are you sure you want to permanently delete this traffic announcement? This action cannot be undone.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-cancel"
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-modal-save is-danger"
                style={{ background: "#dc2626" }}
                onClick={confirmDelete}
              >
                Delete Advisory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CITIZEN COMMENTS MODAL */}
      {viewingCommentsAdvisory && (
        <div className="admin-modal-backdrop" onClick={() => setViewingCommentsAdvisory(null)}>
          <div className="admin-modal admin-adv-comments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3 className="admin-modal-title">Citizen Comments</h3>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {viewingCommentsAdvisory.title || "Advisory Notice"}
                </div>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setViewingCommentsAdvisory(null)}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {loadingComments ? (
                <p style={{ textAlign: "center", color: "#64748b" }}>Loading citizen comments...</p>
              ) : advisoryComments.length === 0 ? (
                <p style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>
                  No citizen comments received on this advisory yet.
                </p>
              ) : (
                <div className="admin-adv-comments-list">
                  {advisoryComments.map((c) => (
                    <div key={c.id} className="admin-adv-comment-item">
                      <div className="admin-adv-comment-author-row">
                        <strong>{c.author_name}</strong>
                        <small>
                          {new Date(c.created_at).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                      <p>{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-cancel"
                onClick={() => setViewingCommentsAdvisory(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

