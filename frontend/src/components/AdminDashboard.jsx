import ResponsiveSelect from "./ResponsiveSelect";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import ctmoShieldLogo from "../assets/ctmo-shield-logo-transparent.png";
import HotspotMap from "./HotspotMap";
import ReportDirections from "./ReportDirections";
import DuplicateReportNotice, { DuplicateBadge } from "./DuplicateReportNotice";
import SuspiciousReportNotice, { SuspiciousBadge } from "./SuspiciousReportNotice";
import ReportsAnalytics from "./ReportsAnalytics";
import AdminIcon from "./AdminIcon";
import "./AdminDashboard.css";
import AdditionalEvidence from "./AdditionalEvidence";
import AdminActivityHistory from "./AdminActivityHistory";
import AdminMessages from "./AdminMessages";
import ThemeToggle from "./ThemeToggle";
import TrafficAdvisories from "./TrafficAdvisories";
import AdminStaffAccounts from "./AdminStaffAccounts";
import OfficerEditor from "./OfficerEditor";
import useOfficers from "../hooks/useOfficers";

const statusLabel = (status) => status === "Pending" ? "Pending Verification" : status;
const formatCitizenRemarks = (description) => {
  const remarks = description?.trim();
  if (!remarks) return "No further details submitted.";
  return /^Description\s*:/i.test(remarks) ? remarks : `Description: ${remarks}`;
};
const REJECTION_REASONS = [
  ["insufficient_evidence", "Insufficient evidence"], ["unrelated_evidence", "Unrelated photo or video"],
  ["duplicate_incident", "Duplicate incident"], ["inconsistent_details", "Inconsistent report details"],
  ["unable_to_verify", "Unable to verify the incident"], ["other", "Other reason"],
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview"); // overview | queue | assignment | analytics | hotspot
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageVersion, setMessageVersion] = useState(0);
  const refreshMessageCount = useCallback(() => setMessageVersion((value) => value + 1), []);
  useEffect(() => {
    let alive = true;
    let fetching = false;
    const loadCount = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const { data } = await API.get("admin/messages/unread-count/");
        if (alive && Number.isInteger(data?.unread_count) && data.unread_count >= 0) {
          setUnreadMessages(data.unread_count);
        }
      } catch { /* Retain the last count while the connection recovers. */ }
      finally { fetching = false; }
    };
    loadCount();
    const timer = setInterval(loadCount, 30000);
    window.addEventListener("focus", loadCount);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", loadCount); };
  }, [messageVersion]);
  const mobileMenuButton = useRef(null);
  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width:1101px)");
    const closeOnDesktop = (event) => { if (event.matches) setMobileMenuOpen(false); };
    desktop?.addEventListener?.("change", closeOnDesktop);
    return () => desktop?.removeEventListener?.("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        mobileMenuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);
  const [reports, setReports] = useState([]);
  const [reportLoad, setReportLoad] = useState({ loading: true, error: false, lastUpdated: null });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [officerVersion, setOfficerVersion] = useState(0);
  const { officers, loading: officersLoading, error: officersError } = useOfficers(officerVersion);
  const [officerEditor, setOfficerEditor] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteCancelRef = useRef(null);
  const [assigningOfficer, setAssigningOfficer] = useState(null);
  const [assigningCaseId, setAssigningCaseId] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("all");
  const [advisoryVersion, setAdvisoryVersion] = useState(0);
  const [sendingAdvisory, setSendingAdvisory] = useState(false);
  const [advisoryError, setAdvisoryError] = useState("");
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editOfficer, setEditOfficer] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionDetails, setRejectionDetails] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  const [adminUser] = useState(
    () => sessionStorage.getItem("ctmo_admin_user") || "Officer Admin"
  );
  const [isSuperuser, setIsSuperuser] = useState(false);
  useEffect(() => {
    let alive = true;
    API.get("admin/me/").then(({ data }) => {
      if (alive) setIsSuperuser(Boolean(data?.is_superuser));
    }).catch(() => { if (alive) setIsSuperuser(false); });
    return () => { alive = false; };
  }, []);
  const isDialogOpen = Boolean(selectedReport || assigningOfficer || showNotificationModal || officerEditor);

  useEffect(() => {
    if (confirmDelete) deleteCancelRef.current?.focus();
  }, [confirmDelete]);

  useEffect(() => {
    if (!isDialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isDialogOpen]);

  // Require admin login: redirect to /admin-ctmo if unauthenticated
  useEffect(() => {
    const isAuth = sessionStorage.getItem("ctmo_admin_authenticated");
    if (!isAuth) {
      navigate("/admin-ctmo", { replace: true });
    }
  }, [navigate]);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Show toast notification
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Helper for human-readable relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Retain the last successful snapshot on a connection error; never substitute sample reports.
  useEffect(() => {
    let isMounted = true;
    let fetching = false;
    const fetchLiveReports = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const response = await API.get("reports/");
        if (!Array.isArray(response.data)) throw new Error("Unexpected report response");
        if (!isMounted) return;
        const formatted = response.data.map((r) => ({
          ...r,
          reference_id: r.reference_id || `SUP-${r.id}`,
          violation_type: r.violation_type || "Traffic Violation",
          location: r.location || "Location not recorded",
          submitted: formatRelativeTime(r.date_reported),
          date_reported: r.date_reported || null,
          status: r.status || "Pending",
          assigned_officer: r.assigned_officer || "",
          description: r.description || "No citizen remarks provided.",
          image: r.image ? r.image.startsWith("http") ? r.image : `${window.location.origin}${r.image}` : null,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
        }));
        setReports(formatted);
        setReportLoad({ loading: false, error: false, lastUpdated: new Date().toISOString() });
      } catch (error) {
        if (isMounted) setReportLoad((current) => ({ ...current, loading: false, error: true }));
      } finally {
        fetching = false;
      }
    };
    fetchLiveReports();
    const intervalId = setInterval(fetchLiveReports, 3000);
    return () => { isMounted = false; clearInterval(intervalId); };
  }, [refreshVersion]);

  const assignableReports = useMemo(() => reports.filter((report) =>
    report.public_verified_at && report.status === "Validated" && !String(report.assigned_officer || "").trim()
  ), [reports]);

  // Real-time exact stats calculations from user reports
  const stats = useMemo(() => {
    const totalReports = reports.length;
    const resolvedCases = reports.filter((r) => r.status === "Resolved").length;
    const openCases = reports.filter((r) => r.status !== "Resolved" && r.status !== "Rejected").length;
    const urgentCases = reports.filter((r) => r.status === "Pending" || r.status === "Under Review").length;
    const resolutionRate = totalReports > 0 ? ((resolvedCases / totalReports) * 100).toFixed(1) + "%" : "0.0%";

    const now = new Date();
    const todayCount = reports.filter((r) => {
      if (!r.date_reported) return false;
      const d = new Date(r.date_reported);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      total: totalReports,
      open: openCases,
      urgent: urgentCases,
      resolved: resolvedCases,
      resolutionRate,
      todayCount,
      unassigned: reports.filter((report) => !["Resolved", "Rejected"].includes(report.status) && !String(report.assigned_officer || "").trim()).length,
      pendingReview: urgentCases,
      flagged: reports.filter((report) => report.suspicious_flags?.length > 0).length,
      duplicates: reports.filter((report) => report.possible_duplicate).length,
      readyForAssignment: reports.filter((report) => report.public_verified_at && report.status === "Validated" && !String(report.assigned_officer || "").trim()).length,
      rejected: reports.filter((report) => report.status === "Rejected").length,
    };
  }, [reports]);

  // Queue filtered items
  const filteredQueue = useMemo(() => {
    return reports.filter((report) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        report.reference_id.toLowerCase().includes(q) ||
        report.violation_type.toLowerCase().includes(q) ||
        report.location.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && (report.status === "Pending" || report.status === "Under Review")) ||
        report.status.toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus && (!duplicatesOnly || report.possible_duplicate) &&
        (!flaggedOnly || report.suspicious_flags?.length > 0);
    });
  }, [reports, searchQuery, statusFilter, duplicatesOnly, flaggedOnly]);

  // Handle Review Click
  const handleOpenReview = (report) => {
    setSelectedReport(report);
    setConfirmDelete(false);
    setDeleteError("");
    setReviewError("");
    setEditStatus(report.status || "Pending");
    setEditOfficer(report.assigned_officer || "");
    setRejectionReason(report.rejection_reason || "");
    setRejectionDetails(report.rejection_details || "");
    setAdminNotes("");
  };

  const closeCaseReview = () => {
    if (deletingCase) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      setDeleteError("");
    } else setSelectedReport(null);
  };

  const handleDeleteCase = async () => {
    if (!selectedReport || deletingCase || !confirmDelete) return;
    const report = selectedReport;
    setDeletingCase(true);
    setDeleteError("");
    try {
      await API.delete(`reports/${report.id}/`);
      setReports((current) => current.filter((item) => item.id !== report.id));
      setRefreshVersion((version) => version + 1);
      setSelectedReport(null);
      setConfirmDelete(false);
      showToast(`Case ${report.reference_id} deleted.`);
    } catch (error) {
      setDeleteError(error.response?.data?.detail || "Could not delete this case. Please try again.");
    } finally {
      setDeletingCase(false);
    }
  };

  // Save report status / assignment updates
  const handleSaveReportUpdate = async () => {
    if (!selectedReport || savingReview) return;
    if (editStatus === "Rejected" && (!rejectionReason || !rejectionDetails.trim())) {
      setReviewError("Select a rejection reason and explain it to the reporter before saving.");
      return;
    }
    setSavingReview(true);
    setReviewError("");
    try {
      const response = await API.patch(`reports/${selectedReport.id}/`, {
        status: editStatus, assigned_officer: editOfficer,
        ...(adminNotes.trim() ? { admin_note: adminNotes.trim() } : {}),
        ...(editStatus === "Rejected" ? { rejection_reason: rejectionReason, rejection_details: rejectionDetails.trim() } : {}),
      });
      setReports((prev) => prev.map((report) => report.id === selectedReport.id
        ? { ...report, ...response.data } : report));
      setRefreshVersion((version) => version + 1);
      showToast(`Case ${selectedReport.reference_id} updated successfully!`);
      setSelectedReport(null);
    } catch (error) {
      const detail = error.response?.data;
      setReviewError(detail?.assigned_officer?.[0] || detail?.admin_note?.[0] || detail?.rejection_reason?.[0] || detail?.rejection_details?.[0] || detail?.status?.[0] || detail?.detail || "Could not save the review. Please try again.");
    } finally {
      setSavingReview(false);
    }
  };

  // Assignment is available only after the report has been verified.
  const handleAssignToOfficer = async (officer, reportId) => {
    const report = assignableReports.find((item) => item.id === reportId || item.reference_id === reportId);
    if (!report || assigningCaseId !== null) return;
    setAssigningCaseId(report.id);
    try {
      const response = await API.patch(`reports/${report.id}/`, { assigned_officer: officer.name, status: "Assigned" });
      setReports((prev) => prev.map((item) => item.id === report.id ? { ...item, ...response.data } : item));
      setRefreshVersion((version) => version + 1);
      showToast(`Assigned case to ${officer.name}`);
      setAssigningOfficer(null);
    } catch (error) {
      showToast(error.response?.data?.assigned_officer?.[0] || error.response?.data?.status?.[0] || "Could not assign this case. Please try again.");
    } finally {
      setAssigningCaseId(null);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Reference ID", "Violation", "Location", "Date Reported", "Status", "Assigned Officer"];
    const rows = reports.map((r) => [
      r.reference_id,
      `"${r.violation_type}"`,
      `"${r.location}"`,
      `"${r.submitted || r.date_reported}"`,
      r.status,
      `"${r.assigned_officer || 'Unassigned'}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CTMO_Reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report dataset exported to CSV");
  };

  // Broadcast Notification
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!notificationMessage.trim() || sendingAdvisory) return;
    setSendingAdvisory(true);
    setAdvisoryError("");
    try {
      await API.post("admin/advisories/", { message: notificationMessage.trim(), audience: notificationTarget });
      setAdvisoryVersion((value) => value + 1);
      setNotificationMessage("");
      setShowNotificationModal(false);
      showToast("Traffic advisory published.");
    } catch (error) {
      setAdvisoryError(error.response?.data?.message?.[0] || error.response?.data?.audience?.[0] ||
        error.response?.data?.detail || "Could not publish the advisory. Please try again.");
    } finally {
      setSendingAdvisory(false);
    }
  };

  // Get status badge styling
  const getStatusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("reject")) return "status-badge-rejected";
    if (s.includes("review") || s.includes("pending")) return "status-badge-reviewing";
    if (s.includes("assign")) return "status-badge-assigned";
    if (s.includes("progress")) return "status-badge-progress";
    if (s.includes("resolve")) return "status-badge-resolved";
    return "status-badge-default";
  };

  const openQueue = (filter = "all", flags = false, duplicates = false) => {
    setStatusFilter(filter);
    setFlaggedOnly(flags);
    setDuplicatesOnly(duplicates);
    setSearchQuery("");
    setActiveTab("queue");
  };
  const navigation = [
    { key: "overview", label: "Overview", icon: "overview" },
    { key: "queue", label: "Reports Queue", icon: "reports" },
    { key: "assignment", label: "Case Assignment", icon: "officers" },
    { key: "analytics", label: "Analytics", icon: "analytics" },
    { key: "hotspot", label: "Hotspot Map", icon: "map" },
    { key: "activity", label: "Activity History", icon: "clock" },
    { key: "messages", label: "Messages", icon: "reports" },
    ...(isSuperuser ? [{ key: "accounts", label: "CTMO Accounts", icon: "officers" }] : []),
  ];
  const workflow = [
    { label: "Pending review", count: stats.pendingReview, color: "#b18b45" },
    { label: "Validated", count: reports.filter((report) => report.status === "Validated").length, color: "#8976b6" },
    { label: "Assigned", count: reports.filter((report) => report.status === "Assigned").length, color: "#597fab" },
    { label: "In progress", count: reports.filter((report) => report.status === "In Progress").length, color: "#b77c57" },
    { label: "Resolved", count: stats.resolved, color: "#438d78" },
    { label: "Rejected", count: stats.rejected, color: "#b96672" },
  ];
  const syncLabel = reportLoad.error ? "Connection interrupted" : reportLoad.loading ? "Connecting to reports" : "Auto-refresh active";
  const hasSnapshot = Boolean(reportLoad.lastUpdated);
  const displayCount = (count) => hasSnapshot ? count.toLocaleString() : "-";
  const officerWorkload = (name) => reports.filter((report) => report.assigned_officer === name && !["Resolved", "Rejected"].includes(report.status)).length;
  const handleLogout = async () => {
    try { await API.post("admin/logout/"); } catch { /* Clear the local session even if the server is unavailable. */ }
    sessionStorage.removeItem("ctmo_admin_authenticated");
    sessionStorage.removeItem("ctmo_admin_user");
    showToast("Logged out of CTMO session.");
    setTimeout(() => navigate("/admin-ctmo", { replace: true }), 400);
  };

  return (
    <>
      <div className="admin-dashboard-root" data-view={activeTab}>
        <a className="admin-skip-link" href="#admin-main">Skip to dashboard content</a>
        {mobileMenuOpen && <div className="admin-menu-backdrop" aria-hidden="true" onClick={() => {
          setMobileMenuOpen(false);
          mobileMenuButton.current?.focus();
        }} />}
        <aside className={`admin-sidebar${mobileMenuOpen ? " is-menu-open" : ""}`}>
          <div className="admin-sidebar-brand">
            <img src={ctmoShieldLogo} alt="CTMO Shield" className="admin-logo-img" />
            <div><strong>Hapsay<span>Dalan</span></strong><small>CTMO OPERATIONS</small></div>
            <button ref={mobileMenuButton} type="button" className="admin-mobile-menu-toggle"
              aria-label={mobileMenuOpen ? "Close admin navigation" : "Open admin navigation"}
              aria-expanded={mobileMenuOpen} aria-controls="admin-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}>
              <AdminIcon name={mobileMenuOpen ? "close" : "menu"} /><span>{mobileMenuOpen ? "Close" : "Menu"}</span>
            </button>
          </div>
          <div className="admin-sidebar-label">WORKSPACE</div>
          <nav className="admin-nav-bar" id="admin-navigation" aria-label="Admin Navigation">
            <div className="admin-mobile-nav-heading"><strong>Your workspace</strong><span>CTMO MENU</span></div>
            {navigation.map((item) => <button key={item.key}
              className={`admin-tab-btn ${activeTab === item.key ? "active" : ""}`}
              aria-current={activeTab === item.key ? "page" : undefined}
              onClick={() => {
                setActiveTab(item.key);
                setMobileMenuOpen(false);
              }}>
              <span className="admin-nav-icon"><AdminIcon name={item.icon} /></span>
              <span className="admin-nav-copy"><span>{item.label}</span><small aria-hidden="true">{{
                overview: "Summary & updates", queue: "Review citizen reports", assignment: "Coordinate officers",
                analytics: "Trends & statistics", hotspot: "Verified locations", activity: "Admin actions & notes", messages: "Citizen questions & help", accounts: "Manage staff access",
              }[item.key]}</small></span>
              {item.key === "queue" && stats.pendingReview > 0 && <span className="admin-tab-badge">{stats.pendingReview}</span>}
              {item.key === "messages" && unreadMessages > 0 && <span className="admin-tab-badge" aria-label={`${unreadMessages} unread messages`}>{unreadMessages}</span>}
            </button>)}
            <div className="admin-mobile-actions">
              <div className="admin-mobile-actions-time"><AdminIcon name="clock" /><span>Local time</span><strong>{currentTime}</strong></div>
              <ThemeToggle showLabel />
              <div className="admin-mobile-actions-buttons">
                <Link to="/" className="admin-header-btn" onClick={() => setMobileMenuOpen(false)}><AdminIcon name="home" /><span>User Dashboard</span></Link>
                <button type="button" className="admin-logout-btn" onClick={handleLogout}><AdminIcon name="logout" /><span>Log Out</span></button>
              </div>
            </div>
          </nav>
          <div className="admin-sidebar-note"><AdminIcon name="shield" /><strong>Verify before publishing.</strong>
            <p>Only approved reports appear on the public hotspot map.</p></div>
          <div className="admin-sidebar-footer"><span className="admin-avatar">{adminUser.trim().charAt(0).toUpperCase()}</span>
            <div><strong>{adminUser}</strong><small>CTMO administrator</small></div></div>
        </aside>
        <header className="admin-header">
          <div className="admin-header-brand">
            <div><span className="admin-breadcrumb">Workspace / {navigation.find((item) => item.key === activeTab)?.label}</span>
              <h1 className="admin-header-title">CTMO Admin Dashboard</h1></div>
          </div>
          <div className="admin-header-right">
              <ThemeToggle showLabel />
            <div className="admin-time-pill" title="Current time on your device">
              <span className="admin-clock-icon"><AdminIcon name="clock" /></span>
              <span className="admin-clock-copy"><small>LOCAL TIME</small><strong>{currentTime}</strong></span>
            </div>
            <Link to="/" className="admin-header-btn"><AdminIcon name="home" /><span>User Dashboard</span><AdminIcon name="arrow" className="admin-header-link-arrow" /></Link>
            <button className="admin-logout-btn" onClick={handleLogout}><AdminIcon name="logout" /><span>Log Out</span></button>
          </div>
        </header>

        <main className="admin-container" id="admin-main" tabIndex={-1}>
          <section className="admin-welcome" aria-labelledby="admin-welcome-title">
            <div><span className="admin-eyebrow">SURIGAO CITY | TRAFFIC OPERATIONS</span>
              <h2 id="admin-welcome-title">Traffic operations overview</h2>
              <p>Review citizen submissions, verify incidents, and coordinate case assignments.</p>
              <div className="admin-welcome-meta"><span>{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                <span className={`admin-sync-status ${reportLoad.error ? "is-offline" : reportLoad.loading ? "is-connecting" : ""}`}><i />{syncLabel}</span></div>
            </div>
            <button className="admin-primary-action" onClick={() => openQueue("pending")}><AdminIcon name="reports" />Review pending reports<AdminIcon name="arrow" /></button>
          </section>
          {reportLoad.error && activeTab !== "analytics" ? <div className="admin-connection-notice" role="alert">
            <span>{hasSnapshot ? "Connection interrupted. Showing the last loaded reports." : "Reports could not be loaded. Check your connection and retry."}</span>
            <button onClick={() => setRefreshVersion((value) => value + 1)}>Retry connection</button>
          </div> : null}
          {/* Top 4 KPI Metric Summary Cards */}
          {activeTab === "overview" && <div className="admin-stats-grid">
            <div className="admin-stat-card" data-tone="blue">
              <div className="admin-stat-title">Total Reports<AdminIcon name="reports" /></div>
              <div className="admin-stat-number total">{displayCount(stats.total)}</div>
              <div className="admin-stat-footer green">
                {hasSnapshot ? `${stats.todayCount} received today` : "Waiting for report data"}
              </div>
            </div>

            <div className="admin-stat-card" data-tone="amber">
              <div className="admin-stat-title">Open Cases<AdminIcon name="clock" /></div>
              <div className="admin-stat-number open">{displayCount(stats.open)}</div>
              <div className="admin-stat-footer amber">{hasSnapshot ? `${stats.urgent} pending review` : "Waiting for report data"}</div>
            </div>

            <div className="admin-stat-card" data-tone="green">
              <div className="admin-stat-title">Resolved Cases<AdminIcon name="check" /></div>
              <div className="admin-stat-number resolved">{displayCount(stats.resolved)}</div>
              <div className="admin-stat-footer green">{hasSnapshot ? `${stats.resolutionRate} resolution rate` : "Waiting for report data"}</div>
            </div>

            <div className="admin-stat-card" data-tone="purple">
              <div className="admin-stat-title">Unassigned Cases<AdminIcon name="officers" /></div>
              <div className="admin-stat-number response">{displayCount(stats.unassigned)}</div>
              <div className="admin-stat-footer blue">{hasSnapshot ? "Open reports without an officer" : "Waiting for report data"}</div>
            </div>
          </div>}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="admin-overview-content">
              <TrafficAdvisories admin refreshKey={advisoryVersion} />
              <div className="admin-attention-grid">
                <button className="admin-attention-card" onClick={() => openQueue("all", true)}><span className="admin-attention-icon"><AdminIcon name="flag" /></span>
                  <span><strong>{displayCount(stats.flagged)} {stats.flagged === 1 ? "report" : "reports"} with review flags</strong><small>Check details that may need a closer look</small></span><AdminIcon name="arrow" /></button>
                <button className="admin-attention-card" onClick={() => openQueue("all", false, true)}><span className="admin-attention-icon"><AdminIcon name="reports" /></span>
                  <span><strong>{displayCount(stats.duplicates)} possible {stats.duplicates === 1 ? "duplicate" : "duplicates"}</strong><small>Compare evidence before making a decision</small></span><AdminIcon name="arrow" /></button>
              </div>
              <section className="admin-workflow-card" aria-labelledby="case-progress-title">
                <div className="admin-section-heading"><div><span className="admin-eyebrow">THE BIG PICTURE</span><h2 id="case-progress-title">Case progress</h2></div>
                  <span className="admin-section-note">{hasSnapshot ? `${stats.total} total reports` : "Waiting for data"}</span></div>
                <div className="admin-workflow-track" aria-hidden="true">{workflow.filter((item) => item.count > 0).map((item) =>
                  <span key={item.label} style={{ width: `${item.count / stats.total * 100}%`, background: item.color }} />)}</div>
                <div className="admin-workflow-legend">{workflow.map((item) => <div key={item.label}><i style={{ background: item.color }} />
                  <span>{item.label}</span><strong>{displayCount(item.count)}</strong></div>)}</div>
              </section>
            <div className="admin-overview-grid">
              {/* Left Column: Recent Reports */}
              <div className="admin-panel-card">
                <div className="admin-section-heading"><div><span className="admin-eyebrow">CITIZEN SUBMISSIONS</span><h2 className="admin-panel-title">Recent Reports</h2></div>
                  <button className="admin-text-action" onClick={() => openQueue()}>View all<AdminIcon name="arrow" /></button></div>
                <p className="admin-panel-subtitle">The latest reports, ready for your attention.</p>

                <div className="admin-recent-list" aria-busy={reportLoad.loading}>
                  {!reports.length ? <div className="admin-empty-state"><AdminIcon name="reports" /><strong>{reportLoad.loading ? "Loading recent reports..." : reportLoad.error ? "Reports are currently unavailable" : "No reports yet"}</strong>
                    <p>{reportLoad.error ? "Retry the connection to load citizen reports." : "New citizen submissions will appear here."}</p></div> : null}
                  {reports.slice(0, 5).map((report) => (
                    <button type="button"
                      key={report.reference_id}
                      className="admin-recent-row"
                      onClick={() => handleOpenReview(report)}
                      title="Click to view & review report"
                    >
                      <span className="admin-report-icon"><AdminIcon name="reports" /></span>
                      <span className="admin-recent-info">
                        <span className="admin-recent-id">{report.reference_id}</span>
                        <span className="admin-recent-type">{report.violation_type}</span>
                        <span className="admin-recent-meta admin-report-location"><AdminIcon name="map" /><span>{report.location}</span></span>
                        {report.evidence_status ? <span className={`ae-badge${report.evidence_status === "submitted" ? " is-submitted" : ""}`}>{report.evidence_status === "submitted" ? "New evidence received" : "Evidence requested"}</span> : null}
                      </span>
                      <span className="admin-recent-right">
                        <span className={`status-badge ${getStatusBadgeClass(report.status)}`}>
                          {statusLabel(report.status)}
                        </span>
                        <span className="admin-recent-time">{report.submitted}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Quick Actions */}
              <div className="admin-quick-actions-card">
                <h3 className="admin-quick-actions-title">Quick Actions</h3>
                <div className="admin-action-btn-list">
                  <button className="admin-action-item-btn" onClick={() => openQueue("pending")}>
                    <AdminIcon name="reports" />
                    <span>Review New Reports ({stats.pendingReview})</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("assignment")}>
                    <AdminIcon name="officers" />
                    <span>Assign Cases to Officers</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setShowNotificationModal(true)}>
                    <AdminIcon name="bell" />
                    <span>Send Advisory Alert</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("analytics")}>
                    <AdminIcon name="analytics" />
                    <span>View Analytics & Trends</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("hotspot")}>
                    <AdminIcon name="map" />
                    <span>View Live Hotspot Map</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={handleExportCSV}>
                    <AdminIcon name="download" />
                    <span>Export Reports (CSV)</span>
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* TAB 2: REPORTS QUEUE */}
          {activeTab === "queue" && (
            <div className="admin-panel-card">
              <span className="admin-eyebrow">CASE REVIEW</span>
              <h2 className="admin-panel-title">Reports Queue</h2>
              <p className="admin-panel-subtitle">
                {stats.pendingReview} new reports waiting for review
              </p>

              {/* Search & Filter Toolbar */}
              <div className="admin-queue-toolbar">
                <input
                  type="text"
                  className="admin-search-input"
                  aria-label="Search reports"
                  placeholder="Search reference, violation, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <ResponsiveSelect
                  className="admin-filter-select"
                  aria-label="Filter case status" value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Verification</option>
                  <option value="Validated">Validated</option>
                  <option value="assigned">Assigned</option>
                  <option value="in progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </ResponsiveSelect>
              </div>

              <div className="admin-queue-filters">
              <label className="duplicate-filter"><input type="checkbox" checked={duplicatesOnly}
                onChange={(event) => setDuplicatesOnly(event.target.checked)} />Show possible duplicates only</label>
              <label className="duplicate-filter"><input type="checkbox" checked={flaggedOnly}
                onChange={(event) => setFlaggedOnly(event.target.checked)} />Show reports with review flags only</label>
              </div>
              <div className="admin-results-meta"><span>{filteredQueue.length} of {reports.length} reports</span>
                {(searchQuery || statusFilter !== "all" || flaggedOnly || duplicatesOnly) ? <button className="admin-text-action" onClick={() => openQueue()}>Clear filters</button> : null}</div>
              <div className="admin-table-wrapper">
                <table className="admin-table" role="table" aria-label="Reports queue">
                  <thead>
                    <tr role="row">
                      <th scope="col" role="columnheader">ID</th>
                      <th scope="col" role="columnheader">Violation</th>
                      <th scope="col" role="columnheader">Location</th>
                      <th scope="col" role="columnheader">Submitted</th>
                      <th scope="col" role="columnheader">Status</th>
                      <th scope="col" role="columnheader">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.length > 0 ? (
                      filteredQueue.map((report) => (
                        <tr key={report.reference_id} role="row">
                          <td className="admin-id-text" role="cell" data-label="Reference ID">{report.reference_id}</td>
                          <td role="cell" data-label="Violation">
                            <strong>{report.violation_type}</strong>
                            {report.possible_duplicate ? <div><DuplicateBadge /></div> : null}
                            <div><SuspiciousBadge flags={report.suspicious_flags} /></div>
                            {report.evidence_status ? <span className={`ae-badge${report.evidence_status === "submitted" ? " is-submitted" : ""}`}>{report.evidence_status === "submitted" ? "New evidence received" : "Evidence requested"}</span> : null}
                          </td>
                          <td role="cell" data-label="Location">{report.location}</td>
                          <td role="cell" data-label="Submitted">{report.submitted}</td>
                          <td role="cell" data-label="Status">
                            <span className={`status-badge ${getStatusBadgeClass(report.status)}`}>
                              {statusLabel(report.status)}
                            </span>
                          </td>
                          <td role="cell" data-label="Action">
                            <button
                              className="admin-review-btn"
                              onClick={() => handleOpenReview(report)}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                          {reportLoad.loading ? "Loading reports..." : reportLoad.error && !hasSnapshot ? "Reports are currently unavailable." : "No reports match your filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CASE ASSIGNMENT (2x2 GRID MATCHING SCREENSHOT) */}
          {activeTab === "assignment" && (
            <div className="admin-panel-card">
              <span className="admin-eyebrow">OFFICER COORDINATION</span>
              <h2 className="admin-panel-title">Case Assignment</h2>
              <p className="admin-panel-subtitle">{stats.readyForAssignment} verified, unassigned reports ready for an officer.</p>
              <div className="admin-officer-toolbar">
                <button type="button" className="admin-modal-save" onClick={() => setOfficerEditor({ officer: null })}>Add Officer</button>
                <button type="button" className="admin-modal-cancel" disabled={officersLoading} onClick={() => setOfficerVersion((v) => v + 1)}>Refresh Officers</button>
              </div>
              {officersError && <p role="alert">{officersError}</p>}
              {officersLoading && <p role="status">Loading officers...</p>}
              {!officersLoading && !officersError && officers.length === 0 && <p>No officers yet. Add an officer to start assigning cases.</p>}

              <div className="admin-officer-grid">
                {officers.map((officer) => {
                  const officerCases = officerWorkload(officer.name);

                  return (
                    <div key={officer.id} className="admin-officer-card">
                      <div className="admin-officer-header">
                        <div className="admin-officer-identity"><span className="admin-officer-avatar"><AdminIcon name="officers" /></span><div>
                          <div className="admin-officer-name">{officer.name}</div>
                          <div className="admin-officer-unit">{officer.unit}</div>
                        </div></div>
                        <span className="admin-officer-badge">{officer.badge}</span>
                      </div>

                      <div className="admin-officer-cases">
                        <strong>{officerCases}</strong> active cases currently assigned
                      </div>

                      <button
                        className="admin-assign-btn"
                        disabled={officersLoading || !!officersError}
                        onClick={() => setAssigningOfficer(officer)}
                      >
                        Assign Cases
                      </button>
                      <div className="admin-officer-actions">
                        <button type="button" className="admin-modal-cancel admin-officer-edit" onClick={() => setOfficerEditor({ officer })} aria-label={`Edit ${officer.name}`}>Edit</button>
                        <button type="button" className="admin-modal-delete admin-modal-delete-trigger" onClick={() => setOfficerEditor({ officer, deleting: true })} aria-label={`Delete ${officer.name}`}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS & TRENDS */}
          {activeTab === "analytics" && (
            <ReportsAnalytics reports={reports} loading={reportLoad.loading} error={reportLoad.error}
              lastUpdated={reportLoad.lastUpdated} onRetry={() => setRefreshVersion((value) => value + 1)}
              onOpenReport={handleOpenReview} />
          )}

          {/* TAB 5: HOTSPOT MAP */}
          {activeTab === "hotspot" && (
            <div className="admin-panel-card admin-hotspot-panel">
              <div style={{ marginBottom: "16px" }}>
                <h2 className="admin-panel-title">Live Traffic & Violation Hotspots</h2>
                <p className="admin-panel-subtitle" style={{ margin: 0 }}>
                  Geographical density map and incident clusters across Surigao City
                </p>
              </div>
              <div className="admin-hotspot-container">
                <HotspotMap isEmbedded={true} />
              </div>
            </div>
          )}
          {activeTab === "messages" && <AdminMessages onRead={refreshMessageCount} />}
          {activeTab === "accounts" && isSuperuser && <AdminStaffAccounts />}
          {activeTab === "activity" && <AdminActivityHistory refreshKey={refreshVersion} onOpenReport={(id) => {
            const report = reports.find((item) => item.id === id);
            if (report) handleOpenReview(report);
            else showToast("This report is no longer available.");
          }} />}
          <footer className="admin-workspace-footer"><span>HapsayDalan | CTMO, Surigao City</span><span>{reportLoad.lastUpdated ? `Last synced ${new Date(reportLoad.lastUpdated).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting report data"}</span></footer>
        </main>

        {/* REVIEW REPORT MODAL */}
        {selectedReport && (
          <div className="admin-modal-backdrop" onClick={closeCaseReview}>
            <div className="admin-modal" role={confirmDelete ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="admin-case-dialog-title" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <h3 id="admin-case-dialog-title" className="admin-modal-title">{confirmDelete ? "Delete Case" : "Review Case"} {selectedReport.reference_id}</h3>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                    Reported on {selectedReport.submitted}
                  </div>
                </div>
                <button type="button" className="admin-modal-close-btn" aria-label="Close case review" onClick={closeCaseReview} disabled={deletingCase}>
                  ×
                </button>
              </div>

              <div className="admin-modal-body">
                {confirmDelete ? <div className="admin-delete-warning">
                  <strong>Permanently delete this case?</strong>
                  <p>Case {selectedReport.reference_id} will be removed from the reports queue and public map. This cannot be undone. The deletion will remain in Activity History.</p>
                  {deleteError && <p role="alert" className="admin-delete-error">{deleteError}</p>}
                </div> : <>
                <p role="status">{selectedReport.public_verified_at && !["Pending", "Rejected"].includes(selectedReport.status)
                  ? "Verified: included in the public hotspot map."
                  : "Not public. Review the evidence, then save as Validated to approve this report for the public hotspot map."}</p>
                <SuspiciousReportNotice report={selectedReport} onReviewRelated={(id) => {
                  const related = reports.find((item) => item.id === id);
                  if (related) handleOpenReview(related);
                }} />
                <DuplicateReportNotice key={`duplicates-${selectedReport.id}`} report={selectedReport} onReviewMatch={(id) => {
                  const match = reports.find((item) => item.id === id);
                  if (match) handleOpenReview(match);
                }} />
                <div className="admin-detail-grid">
                  <div className="admin-detail-cell">
                    <span className="admin-detail-label">Violation</span>
                    <span className="admin-detail-val">{selectedReport.violation_type}</span>
                  </div>
                  <div className="admin-detail-cell">
                    <span className="admin-detail-label">Current Status</span>
                    <span className="admin-detail-val">{statusLabel(selectedReport.status)}</span>
                  </div>
                  <div className="admin-detail-cell" style={{ gridColumn: "span 2" }}>
                    <span className="admin-detail-label">Location</span>
                    <span className="admin-detail-val">{selectedReport.location}</span>
                    {selectedReport.location_captured_at ? (
                      <span className="admin-detail-val" style={{ fontWeight: 400 }}>
                        Violation pin: {selectedReport.location_source === "manual" ? "Selected by reporter" : "Automatic GPS"}
                        <br />Coordinates: {selectedReport.latitude}, {selectedReport.longitude}
                        <br /><a target="_blank" rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${selectedReport.latitude}&mlon=${selectedReport.longitude}#map=18/${selectedReport.latitude}/${selectedReport.longitude}`}>
                          View violation pin on map
                        </a>
                        <br />Reporter device location: {selectedReport.reporter_latitude ?? selectedReport.latitude}, {selectedReport.reporter_longitude ?? selectedReport.longitude}
                        <br />Device GPS accuracy: {Math.ceil(selectedReport.location_accuracy)} m
                        <br />GPS captured: {new Date(selectedReport.location_captured_at).toLocaleString()}
                        <br /><a target="_blank" rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${selectedReport.reporter_latitude ?? selectedReport.latitude}&mlon=${selectedReport.reporter_longitude ?? selectedReport.longitude}`}>
                          View reporter device location on map
                        </a>
                      </span>
                    ) : null}
                  </div>
                  <div className="admin-detail-cell" style={{ gridColumn: "span 2" }}>
                    <span className="admin-detail-label">Citizen Remarks</span>
                    <span className="admin-detail-val admin-detail-remarks">
                      {formatCitizenRemarks(selectedReport.description)}
                    </span>
                  </div>
                </div>

                <ReportDirections latitude={selectedReport.latitude} longitude={selectedReport.longitude}
                  label={selectedReport.location} />

                {selectedReport.image && (
                  <div className="admin-field-group">
                    <label className="admin-field-label">Evidence Photo</label>
                    <img
                      src={selectedReport.image}
                      alt="Violation Evidence"
                      style={{
                        width: "100%",
                        maxHeight: "400px",
                        objectFit: "contain",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                      }}
                    />
                  </div>
                )}

                <AdditionalEvidence key={`evidence-${selectedReport.id}`} report={selectedReport} admin onChanged={(evidenceStatus) => {
                  setSelectedReport((current) => current ? { ...current, evidence_status: evidenceStatus } : current);
                  setReports((current) => current.map((item) => item.id === selectedReport.id ? { ...item, evidence_status: evidenceStatus } : item));
                  setRefreshVersion((version) => version + 1);
                }} />

                <div className="admin-field-group">
                  <label className="admin-field-label">Update Case Status</label>
                  <ResponsiveSelect
                    className="admin-modal-select"
                    aria-label="Update Case Status" value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Pending">Pending Verification</option>
                    <option value="Validated">Validated: approve for public map</option>
                    <option value="Assigned" disabled={!selectedReport.public_verified_at}>Assigned</option>
                    <option value="In Progress" disabled={!selectedReport.public_verified_at}>In Progress</option>
                    <option value="Resolved" disabled={!selectedReport.public_verified_at}>Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </ResponsiveSelect>
                </div>

                {editStatus === "Rejected" ? <>
                  <div className="admin-field-group">
                    <label className="admin-field-label" htmlFor="rejection-reason">Rejection reason *</label>
                    <ResponsiveSelect id="rejection-reason" className="admin-modal-select" required value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}>
                      <option value="">Select a rejection reason</option>
                      {REJECTION_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </ResponsiveSelect>
                  </div>
                  <div className="admin-field-group">
                    <label className="admin-field-label" htmlFor="rejection-details">Explanation for the reporter *</label>
                    <textarea id="rejection-details" className="admin-modal-textarea" required rows="3" maxLength={1000}
                      value={rejectionDetails} onChange={(event) => setRejectionDetails(event.target.value)}
                      placeholder="Explain the decision clearly. This will be visible on Track My Report." />
                    <p style={{ fontSize: 12, color: "#526b86" }}>Visible to the reporter. Include only information appropriate to share.</p>
                  </div>
                </> : null}

                <div className="admin-field-group">
                  <label className="admin-field-label">Assign Traffic Enforcer / Officer</label>
                  <ResponsiveSelect
                    className="admin-modal-select"
                    aria-label="Assign Traffic Enforcer / Officer" value={editOfficer}
                    onChange={(e) => setEditOfficer(e.target.value)}
                  >
                    <option value="">-- Select Officer --</option>
                    {editOfficer && !officers.some((officer) => officer.name === editOfficer) &&
                      <option value={editOfficer}>{editOfficer} (not in current directory)</option>}
                    {officers.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name} ({o.unit} - {officerWorkload(o.name)} active cases)
                      </option>
                    ))}
                  </ResponsiveSelect>
                </div>

                <div className="admin-field-group">
                  <label className="admin-field-label" htmlFor="admin-action-notes">Officer Admin Action Notes</label>
                  <textarea
                    id="admin-action-notes" maxLength={2000}
                    className="admin-modal-textarea"
                    rows="3"
                    placeholder="Enter verification notes, dispatch instructions, or citation ticket number..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                  <small>Private note saved in admin activity history. Not shown to the reporter.</small>
                </div>
                <AdminActivityHistory key={`activity-${selectedReport.id}`} reportId={selectedReport.id} compact refreshKey={refreshVersion} />
                </>}
              </div>

              {!confirmDelete && reviewError && <p role="alert" style={{ color: "#b91c1c", margin: "12px 0 0", flexShrink: 0 }}>{reviewError}</p>}
              {confirmDelete ? <div className="admin-modal-footer">
                <button ref={deleteCancelRef} type="button" className="admin-modal-cancel" onClick={closeCaseReview} disabled={deletingCase}>Keep Case</button>
                <button type="button" className="admin-modal-delete" onClick={handleDeleteCase} disabled={deletingCase}>
                  {deletingCase ? "Deleting..." : "Delete Case Permanently"}
                </button>
              </div> : <div className="admin-modal-footer admin-modal-footer-with-delete">
                <button type="button" className="admin-modal-save" onClick={handleSaveReportUpdate} disabled={savingReview}>
                  {savingReview ? "Saving..." : "Save & Update Case"}
                </button>
                <button type="button" className="admin-modal-cancel" onClick={closeCaseReview} disabled={savingReview}>Cancel</button>
                <button type="button" className="admin-modal-delete admin-modal-delete-trigger" onClick={() => setConfirmDelete(true)} disabled={savingReview}>Delete Case</button>
              </div>}
            </div>
          </div>
        )}

        {officerEditor && <OfficerEditor {...officerEditor} onClose={() => setOfficerEditor(null)} onSaved={(message) => {
          setOfficerEditor(null);
          setOfficerVersion((v) => v + 1);
          setRefreshVersion((v) => v + 1);
          showToast(message);
        }} />}

        {/* ASSIGN CASE TO OFFICER MODAL */}
        {assigningOfficer && (
          <div className="admin-modal-backdrop" onClick={() => setAssigningOfficer(null)}>
            <div className="admin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <h3 className="admin-modal-title">Assign Cases to {assigningOfficer.name}</h3>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                    {assigningOfficer.unit} • Current active workload: {officerWorkload(assigningOfficer.name)}
                  </div>
                </div>
                <button type="button" className="admin-modal-close-btn" aria-label="Close case assignment" onClick={() => setAssigningOfficer(null)}>
                  ×
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ fontSize: "13.5px", color: "#475569" }}>
                  Select a verified, unassigned case. Cases already assigned to another officer stay with that officer.
                </p>
                {assignableReports.length === 0 && <p role="status" className="admin-empty-state">
                  No verified, unassigned cases are available. Validate a new report in Reports Queue first.
                </p>}

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                  {assignableReports
                    .map((report) => (
                      <div
                        key={report.reference_id}
                        className="admin-assignment-row"
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#f8fafc",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#003366", fontSize: "14px" }}>{report.reference_id}</strong>
                          <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                            {report.violation_type} • {report.location}
                          </div>
                        </div>
                        <button
                          className="admin-review-btn"
                          disabled={assigningCaseId !== null}
                          onClick={() => handleAssignToOfficer(assigningOfficer, report.reference_id)}
                        >
                          {assigningCaseId === report.id ? "Assigning..." : "Assign"}
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="admin-modal-footer">
                <button className="admin-modal-cancel" onClick={() => setAssigningOfficer(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SEND ADVISORY MODAL */}
        {showNotificationModal && (
          <div className="admin-modal-backdrop" onClick={() => setShowNotificationModal(false)}>
            <div className="admin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSendBroadcast}>
                <div className="admin-modal-header">
                  <div>
                    <h3 className="admin-modal-title">Broadcast Traffic Advisory</h3>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                      Publish an advisory on the public portal and/or CTMO workspace
                    </div>
                  </div>
                  <button
                    type="button"
                    className="admin-modal-close-btn"
                    onClick={() => setShowNotificationModal(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="admin-modal-body">
                  <div className="admin-field-group">
                    <label className="admin-field-label">Target Audience</label>
                    <ResponsiveSelect
                      className="admin-modal-select"
                      aria-label="Notification audience" value={notificationTarget}
                      onChange={(e) => setNotificationTarget(e.target.value)}
                    >
                      <option value="all">Public Portal & CTMO Workspace</option>
                      <option value="public">Citizens & Commuters Only</option>
                      <option value="officers">CTMO Workspace Only</option>
                    </ResponsiveSelect>
                    <small>CTMO workspace advisories are visible to staff who sign in here.</small>
                  </div>

                  <div className="admin-field-group">
                    <label className="admin-field-label">Advisory Message</label>
                    <textarea
                      className="admin-modal-textarea"
                      rows="4"
                      required
                      maxLength={1000}
                      placeholder="e.g. Heavy congestion along Rizal St due to ongoing utility maintenance. Alternative route via Borromeo St recommended."
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                    />
                  </div>
                  {advisoryError && <p className="traffic-advisories-error" role="alert">{advisoryError}</p>}
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-modal-cancel"
                    onClick={() => setShowNotificationModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-modal-save" disabled={sendingAdvisory}>
                    {sendingAdvisory ? "Publishing..." : "Broadcast Advisory"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toast && (
          <div className="admin-toast" role="status">
            <AdminIcon name="check" />
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </>
  );
}
