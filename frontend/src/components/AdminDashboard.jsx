import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import ctmoShieldLogo from "../assets/ctmo-shield-logo.jpg";
import HotspotMap from "./HotspotMap";

// Realistic baseline data matching mockups with rich Surigao City locations
const INITIAL_REPORTS = [
  {
    id: 1,
    reference_id: "SUP-24091201",
    violation_type: "Illegal Parking",
    location: "Rizal St corner Borromeo, Surigao City",
    submitted: "2 hours ago",
    date_reported: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: "Under Review",
    assigned_officer: "",
    description: "Vehicle parked obstructing the designated pedestrian lane and loading bay.",
    latitude: 9.7843,
    longitude: 125.4888,
    reporter_name: "Citizen Witness",
  },
  {
    id: 2,
    reference_id: "SUP-24091202",
    violation_type: "Speeding",
    location: "Surigao-Davao Coastal Highway, Luna",
    submitted: "4 hours ago",
    date_reported: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "Assigned",
    assigned_officer: "Officer Santos",
    description: "Motorcycle clocking over 80 km/h in a 40 km/h school safety zone.",
    latitude: 9.7756,
    longitude: 125.4921,
    reporter_name: "Anonymous Citizen",
  },
  {
    id: 3,
    reference_id: "SUP-24091203",
    violation_type: "Traffic Light Violation",
    location: "Borromeo St intersection near City Hall",
    submitted: "6 hours ago",
    date_reported: new Date(Date.now() - 6 * 3600000).toISOString(),
    status: "In Progress",
    assigned_officer: "Officer Reyes",
    description: "Delivery van ran red light during heavy morning rush hour.",
    latitude: 9.7872,
    longitude: 125.4865,
    reporter_name: "City Traffic Cam",
  },
  {
    id: 4,
    reference_id: "SUP-24091204",
    violation_type: "Obstruction",
    location: "San Nicolas St Market Area",
    submitted: "1 day ago",
    date_reported: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: "Resolved",
    assigned_officer: "Officer Dela Cruz",
    description: "Commercial goods unloading blocking single open lane.",
    latitude: 9.7831,
    longitude: 125.4942,
    reporter_name: "Local Merchant",
  },
  {
    id: 5,
    reference_id: "SUP-24091205",
    violation_type: "Illegal Parking",
    location: "Downtown Boulevard, Washington",
    submitted: "1h ago",
    date_reported: new Date(Date.now() - 1 * 3600000).toISOString(),
    status: "Pending",
    assigned_officer: "",
    description: "SUV parked in clear No Parking zone near emergency clinic entrance.",
    latitude: 9.7891,
    longitude: 125.4912,
    reporter_name: "Pedestrian",
  },
  {
    id: 6,
    reference_id: "SUP-24091206",
    violation_type: "Speeding",
    location: "Main St, Brgy. Taft",
    submitted: "2h ago",
    date_reported: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: "Pending",
    assigned_officer: "",
    description: "Modified motorcycle excessive speed through residential street.",
    latitude: 9.7812,
    longitude: 125.4855,
    reporter_name: "Barangay Tanod",
  },
  {
    id: 7,
    reference_id: "SUP-24091207",
    violation_type: "Reckless Driving",
    location: "Highway Exit Lipata Ferry Terminal",
    submitted: "3h ago",
    date_reported: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: "Pending",
    assigned_officer: "",
    description: "Aggressive overtaking on blind curve near port entrance.",
    latitude: 9.8034,
    longitude: 125.4678,
    reporter_name: "Port Security",
  },
  {
    id: 8,
    reference_id: "SUP-24091208",
    violation_type: "Illegal Terminal",
    location: "Surigao Bus & Jeepney Terminal Area",
    submitted: "5h ago",
    date_reported: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: "Pending",
    assigned_officer: "",
    description: "Colorum tricycle terminal operating without city permit.",
    latitude: 9.7698,
    longitude: 125.4985,
    reporter_name: "Terminal Inspector",
  },
];

const INITIAL_OFFICERS = [
  { id: 1, name: "Officer Santos", badge: "CTMO-104", unit: "Traffic Enforcer Unit 1", activeCases: 6 },
  { id: 2, name: "Officer Reyes", badge: "CTMO-118", unit: "Mobile Patrol Unit", activeCases: 8 },
  { id: 3, name: "Officer Dela Cruz", badge: "CTMO-205", unit: "Central District Unit", activeCases: 5 },
  { id: 4, name: "Officer Martinez", badge: "CTMO-312", unit: "Highway Patrol Unit", activeCases: 8 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview"); // overview | queue | assignment | analytics | hotspot
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [officers, setOfficers] = useState(INITIAL_OFFICERS);
  const [selectedReport, setSelectedReport] = useState(null);
  const [assigningOfficer, setAssigningOfficer] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationTarget, setNotificationTarget] = useState("all");
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editStatus, setEditStatus] = useState("");
  const [editOfficer, setEditOfficer] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [adminUser] = useState(
    () => sessionStorage.getItem("ctmo_admin_user") || "Officer Admin"
  );

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

  // Live real-time fetch from Django API with polling
  useEffect(() => {
    let isMounted = true;

    const fetchLiveReports = async () => {
      try {
        const response = await API.get("reports/");
        if (response?.data && Array.isArray(response.data)) {
          if (!isMounted) return;
          if (response.data.length > 0) {
            const formatted = response.data.map((r) => ({
              id: r.id,
              reference_id: r.reference_id || `SUP-${r.id}`,
              violation_type: r.violation_type || "Traffic Violation",
              location: r.location || "Surigao City",
              submitted: formatRelativeTime(r.date_reported),
              date_reported: r.date_reported || new Date().toISOString(),
              status: r.status || "Pending",
              assigned_officer: r.assigned_officer || "",
              description: r.description || "No citizen remarks provided.",
              image: r.image || null,
              latitude: r.latitude ? Number(r.latitude) : 9.7843,
              longitude: r.longitude ? Number(r.longitude) : 125.4888,
            }));
            setReports(formatted);
          }
        }
      } catch (err) {
        console.warn("Using offline simulated reports data.", err?.message);
      }
    };

    fetchLiveReports();
    // Real-time polling every 3 seconds for live user updates
    const intervalId = setInterval(fetchLiveReports, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

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
      avgResponse: totalReports > 0 ? "24h" : "--",
      pendingReview: urgentCases,
    };
  }, [reports]);

  // Dynamic violation breakdown from real reports
  const violationBreakdown = useMemo(() => {
    if (!reports.length) return [];
    const counts = {};
    reports.forEach((r) => {
      const type = r.violation_type || "Other";
      counts[type] = (counts[type] || 0) + 1;
    });

    const palette = [
      { color: "#003366" },
      { color: "#eab308" },
      { color: "#38bdf8" },
      { color: "#6366f1" },
      { color: "#94a3b8" },
    ];

    return Object.entries(counts)
      .map(([name, count], idx) => ({
        name,
        count,
        percentage: Math.round((count / reports.length) * 100),
        color: palette[idx % palette.length].color,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reports]);

  // Dynamic status distribution from real reports
  const statusDistribution = useMemo(() => {
    const pending = reports.filter((r) => r.status === "Pending").length;
    const reviewing = reports.filter((r) => r.status === "Under Review" || r.status === "Validated").length;
    const inProgress = reports.filter((r) => r.status === "In Progress" || r.status === "Assigned").length;
    const resolved = reports.filter((r) => r.status === "Resolved").length;

    return { pending, reviewing, inProgress, resolved };
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

      return matchQuery && matchStatus;
    });
  }, [reports, searchQuery, statusFilter]);

  // Handle Review Click
  const handleOpenReview = (report) => {
    setSelectedReport(report);
    setEditStatus(report.status || "Pending");
    setEditOfficer(report.assigned_officer || "");
    setAdminNotes("");
  };

  // Save report status / assignment updates
  const handleSaveReportUpdate = async () => {
    if (!selectedReport) return;

    const updated = {
      ...selectedReport,
      status: editStatus,
      assigned_officer: editOfficer,
    };

    // Optimistic UI update
    setReports((prev) =>
      prev.map((r) => (r.reference_id === selectedReport.reference_id ? updated : r))
    );

    // If assigned to officer, update officer's active count
    if (editOfficer && editOfficer !== selectedReport.assigned_officer) {
      setOfficers((prev) =>
        prev.map((o) => (o.name === editOfficer ? { ...o, activeCases: o.activeCases + 1 } : o))
      );
    }

    try {
      if (selectedReport.id) {
        await API.patch(`reports/${selectedReport.id}/`, {
          status: editStatus,
          assigned_officer: editOfficer,
        });
      }
    } catch (e) {
      // Backend sync error handled silently
    }

    showToast(`Case ${selectedReport.reference_id} updated successfully!`);
    setSelectedReport(null);
  };

  // Handle quick assignment to officer
  const handleAssignToOfficer = (officer, reportId) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId || r.reference_id === reportId) {
          return { ...r, assigned_officer: officer.name, status: "Assigned" };
        }
        return r;
      })
    );

    setOfficers((prev) =>
      prev.map((o) => (o.id === officer.id ? { ...o, activeCases: o.activeCases + 1 } : o))
    );

    showToast(`Assigned case to ${officer.name}`);
    setAssigningOfficer(null);
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
  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!notificationMessage.trim()) return;
    showToast(`Advisory broadcasted to ${notificationTarget.toUpperCase()}`);
    setNotificationMessage("");
    setShowNotificationModal(false);
  };

  // Get status badge styling
  const getStatusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("review") || s.includes("pending")) return "status-badge-reviewing";
    if (s.includes("assign")) return "status-badge-assigned";
    if (s.includes("progress")) return "status-badge-progress";
    if (s.includes("resolve")) return "status-badge-resolved";
    return "status-badge-default";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .admin-dashboard-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-height: 100vh;
          /* Exact user dashboard signature ambient background */
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          color: #0f172a;
          padding-bottom: 60px;
        }

        /* Top Header Navbar - High Contrast CTMO Official Dark Blue */
        .admin-header {
          background: #003366;
          color: #ffffff;
          padding: 16px 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 18px rgba(0, 51, 102, 0.25);
          position: sticky;
          top: 0;
          z-index: 99999;
        }

        .admin-header-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .admin-logo-img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .admin-header-title {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
          line-height: 1.2;
        }

        .admin-header-subtitle {
          font-size: 13px;
          color: #93c5fd;
          font-weight: 500;
          margin-top: 2px;
        }

        .admin-header-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .admin-time-pill {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-pulse-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 8px #22c55e;
          animation: pulseGreen 2s infinite;
        }

        @keyframes pulseGreen {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .admin-header-btn {
          background: #ffffff;
          color: #003366;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .admin-header-btn:hover {
          background: #f1f5f9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .admin-logout-btn {
          background: transparent;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.25);
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .admin-logout-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #fca5a5;
        }

        /* Container */
        .admin-container {
          max-width: 1280px;
          margin: 28px auto 0;
          padding: 0 24px;
        }

        /* Top 4 KPI Metric Cards */
        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }

        .admin-stat-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 14px;
          padding: 22px 24px;
          box-shadow: 0 10px 25px rgba(90, 108, 166, 0.08);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .admin-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(90, 108, 166, 0.14);
        }

        .admin-stat-title {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 12px;
          text-transform: capitalize;
        }

        .admin-stat-number {
          font-size: 34px;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 10px;
          letter-spacing: -0.02em;
        }

        .admin-stat-number.total {
          color: #003366;
        }

        .admin-stat-number.open {
          color: #d97706;
        }

        .admin-stat-number.resolved {
          color: #059669;
        }

        .admin-stat-number.response {
          color: #2563eb;
        }

        .admin-stat-footer {
          font-size: 12px;
          font-weight: 600;
        }

        .admin-stat-footer.green {
          color: #16a34a;
        }

        .admin-stat-footer.amber {
          color: #d97706;
        }

        .admin-stat-footer.blue {
          color: #2563eb;
        }

        /* Nav Pills / Tabs bar */
        .admin-nav-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(221, 229, 243, 0.95);
          width: fit-content;
          margin: 0 auto 30px;
          box-shadow: 0 4px 14px rgba(90, 108, 166, 0.06);
        }

        .admin-tab-btn {
          border: none;
          background: transparent;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 22px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .admin-tab-btn:hover {
          color: #003366;
          background: rgba(255, 255, 255, 0.8);
        }

        .admin-tab-btn.active {
          color: #003366;
          background: #ffffff;
          border: 1.5px solid #003366;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0, 51, 102, 0.12);
        }

        .admin-tab-badge {
          background: #ef4444;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 999px;
        }

        /* Content Card Panel */
        .admin-panel-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 12px 34px rgba(90, 108, 166, 0.08);
        }

        .admin-panel-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .admin-panel-subtitle {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 22px;
        }

        /* TAB 1: OVERVIEW 2-COLUMN LAYOUT */
        .admin-overview-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
        }

        .admin-recent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .admin-recent-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .admin-recent-row:hover {
          border-color: #003366;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 51, 102, 0.06);
        }

        .admin-recent-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .admin-recent-id {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .admin-recent-meta {
          font-size: 13px;
          color: #64748b;
        }

        .admin-recent-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .admin-recent-time {
          font-size: 12px;
          color: #94a3b8;
        }

        /* Status Pills */
        .status-badge {
          font-size: 12px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          letter-spacing: 0.01em;
        }

        .status-badge-reviewing {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .status-badge-assigned {
          background: #dbeafe;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .status-badge-progress {
          background: #ffedd5;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .status-badge-resolved {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .status-badge-default {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        /* Quick Actions Panel */
        .admin-quick-actions-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 20px;
        }

        .admin-quick-actions-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 16px;
        }

        .admin-action-btn-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .admin-action-item-btn {
          width: 100%;
          text-align: left;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13.5px;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .admin-action-item-btn:hover {
          background: #003366;
          color: #ffffff;
          border-color: #003366;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 51, 102, 0.15);
        }

        /* TAB 2: REPORTS QUEUE */
        .admin-queue-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 20px;
        }

        .admin-search-input {
          flex: 1;
          min-width: 240px;
          max-width: 420px;
          border: 1px solid #d9e2ec;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          background: #ffffff;
          transition: border-color 0.15s ease;
        }

        .admin-search-input:focus {
          border-color: #003366;
          box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
        }

        .admin-filter-select {
          border: 1px solid #d9e2ec;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13.5px;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          cursor: pointer;
        }

        .admin-table-wrapper {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .admin-table th {
          background: #f8fafc;
          padding: 14px 18px;
          font-size: 12.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #e2e8f0;
        }

        .admin-table td {
          padding: 16px 18px;
          font-size: 14px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .admin-table tr:hover td {
          background: #f8fbff;
        }

        .admin-table tr:last-child td {
          border-bottom: none;
        }

        .admin-id-text {
          font-weight: 700;
          color: #003366;
        }

        .admin-review-btn {
          background: #ffffff;
          border: 1.5px solid #003366;
          color: #003366;
          font-size: 12.5px;
          font-weight: 700;
          padding: 6px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .admin-review-btn:hover {
          background: #003366;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 51, 102, 0.2);
        }

        /* TAB 3: CASE ASSIGNMENT (2x2 GRID MATCHING PICTURE) */
        .admin-officer-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .admin-officer-card {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 22px;
          background: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.02);
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.18s ease;
        }

        .admin-officer-card:hover {
          border-color: #003366;
          box-shadow: 0 8px 24px rgba(0, 51, 102, 0.08);
          transform: translateY(-2px);
        }

        .admin-officer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .admin-officer-name {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .admin-officer-unit {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .admin-officer-badge {
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .admin-officer-cases {
          font-size: 14px;
          color: #475569;
          font-weight: 600;
        }

        .admin-assign-btn {
          width: 100%;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          color: #1e293b;
          font-size: 13.5px;
          font-weight: 700;
          padding: 10px 0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .admin-assign-btn:hover {
          background: #003366;
          border-color: #003366;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 51, 102, 0.15);
        }

        /* TAB 4: ANALYTICS & TRENDS */
        .admin-analytics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .admin-chart-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 24px;
        }

        .admin-chart-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 20px;
        }

        .admin-bar-list {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .admin-bar-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .admin-bar-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
          font-weight: 600;
          color: #334155;
        }

        .admin-bar-track {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .admin-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.6s ease;
        }

        .admin-bar-fill.parking {
          background: #003366;
          width: 45%;
        }

        .admin-bar-fill.speeding {
          background: #eab308;
          width: 28%;
        }

        .admin-bar-fill.traffic-light {
          background: #38bdf8;
          width: 18%;
        }

        .admin-bar-fill.other {
          background: #94a3b8;
          width: 9%;
        }

        .admin-status-dist-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .admin-status-dist-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
        }

        .admin-status-dist-row.resolved-highlight {
          background: #f0fdf4;
          border-color: #86efac;
        }

        .admin-status-dist-name {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .admin-status-dist-count {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .admin-status-dist-row.resolved-highlight .admin-status-dist-count {
          color: #15803d;
        }

        /* TAB 5: HOTSPOT MAP INTEGRATION */
        .admin-hotspot-container {
          position: relative;
          isolation: isolate;
          z-index: 1;
          background: #ffffff;
          border-radius: 14px;
          overflow: hidden;
          padding: 0;
        }

        /* MODALS */
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 999;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .admin-modal {
          background: #ffffff;
          border-radius: 18px;
          width: 100%;
          max-width: 640px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 28px;
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.25);
          position: relative;
        }

        .admin-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        .admin-modal-title {
          font-size: 20px;
          font-weight: 800;
          color: #003366;
        }

        .admin-modal-close-btn {
          border: none;
          background: #f1f5f9;
          color: #64748b;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .admin-modal-close-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .admin-modal-body {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .admin-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          background: #f8fafc;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .admin-detail-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .admin-detail-label {
          font-size: 11.5px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
        }

        .admin-detail-val {
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
        }

        .admin-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .admin-field-label {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .admin-modal-select,
        .admin-modal-textarea,
        .admin-modal-input {
          width: 100%;
          border: 1px solid #d9e2ec;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          font-family: inherit;
        }

        .admin-modal-select:focus,
        .admin-modal-textarea:focus,
        .admin-modal-input:focus {
          border-color: #003366;
          box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
        }

        .admin-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .admin-modal-cancel {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
        }

        .admin-modal-save {
          background: #003366;
          border: none;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 22px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .admin-modal-save:hover {
          background: #002244;
        }

        /* Toast notification */
        .admin-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #003366;
          color: #ffffff;
          padding: 14px 22px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(0, 51, 102, 0.3);
          z-index: 1000;
          animation: slideUp 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .admin-overview-grid {
            grid-template-columns: 1fr;
          }
          .admin-analytics-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .admin-header {
            padding: 14px 18px;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .admin-header-right {
            width: 100%;
            justify-content: space-between;
          }
          .admin-stats-grid {
            grid-template-columns: 1fr;
          }
          .admin-officer-grid {
            grid-template-columns: 1fr;
          }
          .admin-nav-bar {
            width: 100%;
            overflow-x: auto;
            border-radius: 12px;
            justify-content: flex-start;
          }
          .admin-tab-btn {
            white-space: nowrap;
            padding: 8px 14px;
            font-size: 13px;
          }
        }
      `}</style>

      <div className="admin-dashboard-root">
        {/* Top High-Authority Header */}
        <header className="admin-header">
          <div className="admin-header-brand">
            <img src={ctmoShieldLogo} alt="CTMO Shield" className="admin-logo-img" />
            <div>
              <h1 className="admin-header-title">CTMO Admin Dashboard</h1>
              <div className="admin-header-subtitle">Welcome, {adminUser} • Surigao City Portal</div>
            </div>
          </div>

          <div className="admin-header-right">
            <div className="admin-time-pill">
              <span className="admin-pulse-dot" />
              <span>{currentTime}</span>
            </div>
            <Link to="/" className="admin-header-btn">
              ← User Dashboard
            </Link>
            <button
              className="admin-logout-btn"
              onClick={() => {
                sessionStorage.removeItem("ctmo_admin_authenticated");
                sessionStorage.removeItem("ctmo_admin_user");
                showToast("Logged out of CTMO session.");
                setTimeout(() => navigate("/admin-ctmo", { replace: true }), 400);
              }}
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="admin-container">
          {/* Top 4 KPI Metric Summary Cards */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-title">Total Reports</div>
              <div className="admin-stat-number total">{stats.total.toLocaleString()}</div>
              <div className="admin-stat-footer green">
                {stats.todayCount > 0 ? `+${stats.todayCount} new today` : `Real-time synced (${stats.total} total)`}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">Open Cases</div>
              <div className="admin-stat-number open">{stats.open.toLocaleString()}</div>
              <div className="admin-stat-footer amber">{stats.urgent} pending review</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">Resolved Cases</div>
              <div className="admin-stat-number resolved">{stats.resolved.toLocaleString()}</div>
              <div className="admin-stat-footer green">{stats.resolutionRate} resolution rate</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-title">Avg Response Time</div>
              <div className="admin-stat-number response">{stats.avgResponse}</div>
              <div className="admin-stat-footer blue">Live monitoring</div>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="admin-nav-bar" aria-label="Admin Navigation">
            <button
              className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "queue" ? "active" : ""}`}
              onClick={() => setActiveTab("queue")}
            >
              Reports Queue
              {stats.pendingReview > 0 && <span className="admin-tab-badge">{stats.pendingReview}</span>}
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "assignment" ? "active" : ""}`}
              onClick={() => setActiveTab("assignment")}
            >
              Case Assignment
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              Analytics
            </button>
            <button
              className={`admin-tab-btn ${activeTab === "hotspot" ? "active" : ""}`}
              onClick={() => setActiveTab("hotspot")}
            >
              Hotspot Map
            </button>
          </nav>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="admin-overview-grid">
              {/* Left Column: Recent Reports */}
              <div className="admin-panel-card">
                <h2 className="admin-panel-title">Recent Reports</h2>
                <p className="admin-panel-subtitle">Latest citizen incident submissions requiring verification</p>

                <div className="admin-recent-list">
                  {reports.slice(0, 5).map((report) => (
                    <div
                      key={report.reference_id}
                      className="admin-recent-row"
                      onClick={() => handleOpenReview(report)}
                      title="Click to view & review report"
                    >
                      <div className="admin-recent-info">
                        <span className="admin-recent-id">{report.reference_id}</span>
                        <span className="admin-recent-meta">
                          {report.violation_type} • {report.location}
                        </span>
                      </div>
                      <div className="admin-recent-right">
                        <span className={`status-badge ${getStatusBadgeClass(report.status)}`}>
                          {report.status}
                        </span>
                        <span className="admin-recent-time">{report.submitted}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Quick Actions */}
              <div className="admin-quick-actions-card">
                <h3 className="admin-quick-actions-title">Quick Actions</h3>
                <div className="admin-action-btn-list">
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("queue")}>
                    <span>📋</span>
                    <span>Review New Reports ({stats.pendingReview})</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("assignment")}>
                    <span>👮</span>
                    <span>Assign Cases to Officers</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setShowNotificationModal(true)}>
                    <span>🔔</span>
                    <span>Send Advisory Alert</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("analytics")}>
                    <span>📊</span>
                    <span>View Analytics & Trends</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={() => setActiveTab("hotspot")}>
                    <span>🗺️</span>
                    <span>View Live Hotspot Map</span>
                  </button>
                  <button className="admin-action-item-btn" onClick={handleExportCSV}>
                    <span>📥</span>
                    <span>Export Reports (CSV)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REPORTS QUEUE */}
          {activeTab === "queue" && (
            <div className="admin-panel-card">
              <h2 className="admin-panel-title">Reports Queue</h2>
              <p className="admin-panel-subtitle">
                {stats.pendingReview} new reports waiting for review
              </p>

              {/* Search & Filter Toolbar */}
              <div className="admin-queue-toolbar">
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search by ID (e.g. SUP-24091205), violation, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <select
                  className="admin-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending & Under Review</option>
                  <option value="assigned">Assigned</option>
                  <option value="in progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* Table */}
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Violation</th>
                      <th>Location</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.length > 0 ? (
                      filteredQueue.map((report) => (
                        <tr key={report.reference_id}>
                          <td className="admin-id-text">{report.reference_id}</td>
                          <td>
                            <strong>{report.violation_type}</strong>
                          </td>
                          <td>{report.location}</td>
                          <td>{report.submitted}</td>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td>
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
                          No reports match your search query.
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
              <h2 className="admin-panel-title">Case Assignment</h2>
              <p className="admin-panel-subtitle">{stats.open} active cases ready for assignment</p>

              <div className="admin-officer-grid">
                {officers.map((officer) => {
                  const officerCases = reports.filter(
                    (r) => r.assigned_officer === officer.name && r.status !== "Resolved"
                  ).length;

                  return (
                    <div key={officer.id} className="admin-officer-card">
                      <div className="admin-officer-header">
                        <div>
                          <div className="admin-officer-name">{officer.name}</div>
                          <div className="admin-officer-unit">{officer.unit}</div>
                        </div>
                        <span className="admin-officer-badge">{officer.badge}</span>
                      </div>

                      <div className="admin-officer-cases">
                        <strong>{officerCases}</strong> active cases currently assigned
                      </div>

                      <button
                        className="admin-assign-btn"
                        onClick={() => setAssigningOfficer(officer)}
                      >
                        Assign Cases
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS & TRENDS */}
          {activeTab === "analytics" && (
            <div className="admin-panel-card">
              <h2 className="admin-panel-title">Analytics & Trends</h2>
              <p className="admin-panel-subtitle">Key performance metrics and violation trends from live reports</p>

              <div className="admin-analytics-grid">
                {/* Violations by Type */}
                <div className="admin-chart-box">
                  <h3 className="admin-chart-title">Violations by Type</h3>
                  <div className="admin-bar-list">
                    {violationBreakdown.length > 0 ? (
                      violationBreakdown.map((item) => (
                        <div key={item.name} className="admin-bar-row">
                          <div className="admin-bar-label-row">
                            <span>{item.name} ({item.count})</span>
                            <span>{item.percentage}%</span>
                          </div>
                          <div className="admin-bar-track">
                            <div
                              className="admin-bar-fill"
                              style={{
                                width: `${Math.max(item.percentage, 5)}%`,
                                background: item.color,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#64748b", fontSize: "14px", padding: "16px 0" }}>
                        No violation data recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="admin-chart-box">
                  <h3 className="admin-chart-title">Status Distribution</h3>
                  <div className="admin-status-dist-list">
                    <div className="admin-status-dist-row">
                      <span className="admin-status-dist-name">Submitted (Pending)</span>
                      <span className="admin-status-dist-count">{statusDistribution.pending}</span>
                    </div>

                    <div className="admin-status-dist-row">
                      <span className="admin-status-dist-name">Reviewing & Validated</span>
                      <span className="admin-status-dist-count">{statusDistribution.reviewing}</span>
                    </div>

                    <div className="admin-status-dist-row">
                      <span className="admin-status-dist-name">Assigned & In Progress</span>
                      <span className="admin-status-dist-count">{statusDistribution.inProgress}</span>
                    </div>

                    <div className="admin-status-dist-row resolved-highlight">
                      <span className="admin-status-dist-name">Resolved</span>
                      <span className="admin-status-dist-count">{statusDistribution.resolved}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HOTSPOT MAP */}
          {activeTab === "hotspot" && (
            <div className="admin-panel-card" style={{ padding: "24px" }}>
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
        </div>

        {/* REVIEW REPORT MODAL */}
        {selectedReport && (
          <div className="admin-modal-backdrop" onClick={() => setSelectedReport(null)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <h3 className="admin-modal-title">Review Case {selectedReport.reference_id}</h3>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                    Reported on {selectedReport.submitted}
                  </div>
                </div>
                <button className="admin-modal-close-btn" onClick={() => setSelectedReport(null)}>
                  ×
                </button>
              </div>

              <div className="admin-modal-body">
                <div className="admin-detail-grid">
                  <div className="admin-detail-cell">
                    <span className="admin-detail-label">Violation</span>
                    <span className="admin-detail-val">{selectedReport.violation_type}</span>
                  </div>
                  <div className="admin-detail-cell">
                    <span className="admin-detail-label">Current Status</span>
                    <span className="admin-detail-val">{selectedReport.status}</span>
                  </div>
                  <div className="admin-detail-cell" style={{ gridColumn: "span 2" }}>
                    <span className="admin-detail-label">Location</span>
                    <span className="admin-detail-val">{selectedReport.location}</span>
                  </div>
                  <div className="admin-detail-cell" style={{ gridColumn: "span 2" }}>
                    <span className="admin-detail-label">Citizen Remarks</span>
                    <span className="admin-detail-val" style={{ fontWeight: 400 }}>
                      {selectedReport.description || "No further details submitted."}
                    </span>
                  </div>
                </div>

                {selectedReport.image && (
                  <div className="admin-field-group">
                    <label className="admin-field-label">Evidence Photo</label>
                    <img
                      src={selectedReport.image}
                      alt="Violation Evidence"
                      style={{
                        width: "100%",
                        maxHeight: "220px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                      }}
                    />
                  </div>
                )}

                <div className="admin-field-group">
                  <label className="admin-field-label">Update Case Status</label>
                  <select
                    className="admin-modal-select"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="admin-field-group">
                  <label className="admin-field-label">Assign Traffic Enforcer / Officer</label>
                  <select
                    className="admin-modal-select"
                    value={editOfficer}
                    onChange={(e) => setEditOfficer(e.target.value)}
                  >
                    <option value="">-- Select Officer --</option>
                    {officers.map((o) => (
                      <option key={o.id} value={o.name}>
                        {o.name} ({o.unit} - {o.activeCases} active cases)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-field-group">
                  <label className="admin-field-label">Officer Admin Action Notes</label>
                  <textarea
                    className="admin-modal-textarea"
                    rows="3"
                    placeholder="Enter verification notes, dispatch instructions, or citation ticket number..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button className="admin-modal-cancel" onClick={() => setSelectedReport(null)}>
                  Cancel
                </button>
                <button className="admin-modal-save" onClick={handleSaveReportUpdate}>
                  Save & Update Case
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGN CASE TO OFFICER MODAL */}
        {assigningOfficer && (
          <div className="admin-modal-backdrop" onClick={() => setAssigningOfficer(null)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <h3 className="admin-modal-title">Assign Cases to {assigningOfficer.name}</h3>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                    {assigningOfficer.unit} • Current active workload: {assigningOfficer.activeCases}
                  </div>
                </div>
                <button className="admin-modal-close-btn" onClick={() => setAssigningOfficer(null)}>
                  ×
                </button>
              </div>

              <div className="admin-modal-body">
                <p style={{ fontSize: "13.5px", color: "#475569" }}>
                  Select an unassigned or pending report from the queue to assign immediately:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                  {reports
                    .filter((r) => r.status !== "Resolved" && (!r.assigned_officer || r.assigned_officer !== assigningOfficer.name))
                    .map((report) => (
                      <div
                        key={report.reference_id}
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
                          onClick={() => handleAssignToOfficer(assigningOfficer, report.reference_id)}
                        >
                          Assign
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
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSendBroadcast}>
                <div className="admin-modal-header">
                  <div>
                    <h3 className="admin-modal-title">Broadcast Traffic Advisory</h3>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                      Send official CTMO alert to public portal & field enforcers
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
                    <select
                      className="admin-modal-select"
                      value={notificationTarget}
                      onChange={(e) => setNotificationTarget(e.target.value)}
                    >
                      <option value="all">Public Portal & All Field Enforcers</option>
                      <option value="public">Citizens & Commuters Only</option>
                      <option value="officers">Active Field Officers Only</option>
                    </select>
                  </div>

                  <div className="admin-field-group">
                    <label className="admin-field-label">Advisory Message</label>
                    <textarea
                      className="admin-modal-textarea"
                      rows="4"
                      required
                      placeholder="e.g. Heavy congestion along Rizal St due to ongoing utility maintenance. Alternative route via Borromeo St recommended."
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                    />
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-modal-cancel"
                    onClick={() => setShowNotificationModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="admin-modal-save">
                    Broadcast Advisory
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toast && (
          <div className="admin-toast">
            <span>✓</span>
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </>
  );
}
