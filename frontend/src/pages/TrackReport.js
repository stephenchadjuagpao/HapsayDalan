import React, { useState, useEffect } from "react";
import Navbar from "../components/reusablecode/Navbar";
import API from "../services/api";

const FAQ_ITEMS = [
  {
    question: "Where can I find my reference ID?",
    answer:
      "Your reference ID was provided immediately after you submitted your report. You can also check your email if you provided contact information. The ID starts with 'SUP-' followed by 8 random numbers like SUP-48291357.",
  },
  {
    question: "How often does the status update?",
    answer:
      "Your report status updates whenever there's progress. Typical updates happen within 24-48 hours after submission, with regular updates every 2-3 days as the case progresses. You'll also receive notifications if you provided contact information.",
  },
  {
    question: "What do the different status levels mean?",
    answer:
      "Submitted: Your report has been received and registered.\n\nUnder Review: CTMO is verifying the evidence and details.\n\nAssigned: The case has been assigned to a CTMO officer.\n\nIn Progress: Action is being taken on the violation.\n\nResolved: The case has been completed.",
  },
  {
    question: "How long does it typically take to resolve a report?",
    answer:
      "Average resolution time is 3-7 business days, depending on the type of violation and complexity. Simple cases may be resolved faster, while more serious violations may require additional investigation.",
  },
];

const STATUS_STEPS = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"];
const STATUS_COLORS = {
  Submitted: "blue",
  "Under Review": "yellow",
  Assigned: "purple",
  "In Progress": "orange",
  Resolved: "green",
};

const STATUS_DESCRIPTIONS = {
  Submitted: "Report received and registered in the system.",
  "Under Review": "CTMO team is verifying the evidence and details.",
  Assigned: "Case assigned to a CTMO officer for action.",
  "In Progress": "Investigation in progress. Follow-up actions being taken.",
  Resolved: "Case has been completed and resolved.",
};

const mapBackendStatus = (status) => {
  if (!status) return "Submitted";

  const normalized = String(status).trim().toLowerCase();

  if (normalized === "pending") return "Submitted";
  if (normalized === "validated") return "Under Review";
  if (normalized === "assigned") return "Assigned";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "rejected") return "Assigned";
  if (normalized === "resolved") return "Resolved";

  return "Submitted";
};

const getStatusIndex = (status) => {
  const mappedStatus = mapBackendStatus(status);
  const index = STATUS_STEPS.indexOf(mappedStatus);
  return index >= 0 ? index : 0;
};

const formatReferenceId = (reportId) => `SUP-${String(reportId).padStart(8, "0")}`;

const formatDate = (value) => {
  if (!value) return "Feb 20, 2026";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Feb 20, 2026";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatIsoDate = (value, offset = 0) => {
  const base = value ? new Date(value) : new Date("2026-02-20");
  if (Number.isNaN(base.getTime())) return "2026-02-20";
  base.setDate(base.getDate() + offset);
  return base.toISOString().slice(0, 10);
};

export default function TrackReport() {
  const [referenceId, setReferenceId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("referenceId") || "";
  });
  const [lookupError, setLookupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [myReportsData, setMyReportsData] = useState({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hapsaydalan_my_reports") || "[]");
      setMyReports(saved);

      // Fetch live status for all saved reports
      saved.forEach(async (report) => {
        try {
          const response = await API.get(`reports/by-reference/${encodeURIComponent(report.referenceId)}/`);
          const data = response.data;
          setMyReportsData(prev => ({
            ...prev,
            [report.referenceId]: {
              ...data,
              referenceId: data.reference_id || formatReferenceId(data.id),
              displayStatus: mapBackendStatus(data.status),
            }
          }));
        } catch (e) {
          console.error("Failed to fetch status for", report.referenceId);
        }
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const lookupReport = async (eventOrId) => {
    let searchId = referenceId;
    if (typeof eventOrId === "string") {
      searchId = eventOrId;
      setReferenceId(searchId);
    } else if (eventOrId && eventOrId.preventDefault) {
      eventOrId.preventDefault();
    }

    setLookupError("");
    setReportResult(null);

    const trimmedValue = searchId.trim();
    if (!trimmedValue) {
      setLookupError("Please enter your reference ID.");
      return;
    }

    const matchedReference = trimmedValue.match(/^SUP-\d+$/i);
    if (!matchedReference) {
      setLookupError("Invalid reference ID. Please use a format like SUP-48291357.");
      return;
    }
    const normalizedReferenceId = trimmedValue.toUpperCase();

    setIsLoading(true);

    try {
      const response = await API.get(`reports/by-reference/${encodeURIComponent(normalizedReferenceId)}/`);
      const report = response.data;

      setReportResult({
        ...report,
        referenceId: report.reference_id || formatReferenceId(report.id),
        displayStatus: mapBackendStatus(report.status),
      });
    } catch (error) {
      const apiError = error?.response?.data;

      if (typeof apiError === "string" && apiError.trim()) {
        setLookupError(apiError);
      } else {
        setLookupError("We could not find a report for that reference ID.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderTimelineForReport = (reportItem) => {
    const activeIndex = getStatusIndex(reportItem.status);
    const assignedOfficer = reportItem.assigned_officer || "Officer Santos";
    const timelineItems = STATUS_STEPS.slice(0, activeIndex + 1).map((step, index) => ({
      step,
      date: formatIsoDate(reportItem.date_reported || reportItem.dateReported, index),
      description:
        step === "Assigned" || step === "In Progress"
          ? `${STATUS_DESCRIPTIONS[step]}`
          : STATUS_DESCRIPTIONS[step],
    }));

    return (
      <div className="track-timeline">
        {timelineItems.map((item, index) => (
          <div key={item.step} className="track-timeline-item">
            <div className="track-timeline-rail">
              <span className={`track-timeline-node track-status-badge-${STATUS_COLORS[item.step]}`} />
              {index < timelineItems.length - 1 ? <span className="track-timeline-line" /> : null}
            </div>
            <div className="track-timeline-content">
              <div className="track-timeline-description">
                {item.step === "Assigned"
                  ? `Case assigned to ${assignedOfficer} for action.`
                  : item.step === "In Progress"
                    ? `Investigation in progress. Follow-up actions being taken.`
                    : STATUS_DESCRIPTIONS[item.step]}
              </div>
              <div className="track-timeline-meta">
                <span className="track-timeline-date">{item.date}</span>
                <span className={`track-status-pill track-status-pill-${STATUS_COLORS[item.step]}`}>
                  {item.step}
                </span>
                {item.step === "Assigned" || item.step === "In Progress" ? (
                  <span className="track-timeline-officer">{assignedOfficer}</span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStatusCard = () => {
    if (!reportResult) {
      return null;
    }

    const assignedOfficer = reportResult.assigned_officer || "Officer Santos";
    const sinceDate = formatDate(reportResult.date_reported || reportResult.dateReported);
    return (
      <>
        <section className="track-status-card">
          <div className="track-status-header">
            <div>
              <h2 className="track-panel-title">Report Status</h2>
              <div className="track-status-reference-text">Reference ID: {reportResult.referenceId}</div>
            </div>
            <div className="track-status-badge track-status-badge-green">Active</div>
          </div>

          <div className="track-current-status-label">Current Status</div>
          <div className="track-current-status-row">
            <div className={`track-status-badge track-status-badge-${STATUS_COLORS[reportResult.displayStatus]}`}>
              {reportResult.displayStatus}
            </div>
            <div className="track-current-status-since">Since {sinceDate}</div>
          </div>

          <div className="track-timeline-title">Timeline</div>
          {renderTimelineForReport(reportResult)}
        </section>

        <section className="track-details-card">
          <h2 className="track-panel-title">Report Details</h2>
          <div className="track-status-details">
            <div className="track-detail-block">
              <span className="track-detail-label">Violation Type</span>
              <span className="track-detail-value">{reportResult.violation_type}</span>
            </div>
            <div className="track-detail-block">
              <span className="track-detail-label">Date Reported</span>
              <span className="track-detail-value">{sinceDate}</span>
            </div>
            <div className="track-detail-block">
              <span className="track-detail-label">Location</span>
              <span className="track-detail-value">{reportResult.location}</span>
            </div>
            <div className="track-detail-block">
              <span className="track-detail-label">Assigned Officer</span>
              <span className="track-detail-value">{assignedOfficer}</span>
            </div>
          </div>
        </section>
      </>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .track-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          font-family: 'Inter', sans-serif;
          color: #111827;
        }

        .track-hero {
          text-align: center;
          padding: 72px 24px 98px;
          background: linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .track-hero-title {
          margin: 0 0 18px;
          font-size: clamp(42px, 5vw, 60px);
          line-height: 1.08;
          font-weight: 800;
          color: #0b0b0b;
        }

        .track-hero-text {
          max-width: 840px;
          margin: 0 auto;
          font-size: 17px;
          line-height: 1.55;
          color: #5b6472;
        }

        .track-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 36px 24px 64px;
        }

        .track-form-card,
        .track-status-card,
        .track-details-card {
          max-width: 760px;
          margin: 0 auto 34px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 16px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
          padding: 30px;
        }

        .track-form-card {
          max-width: 620px;
          margin: 0 auto 54px;
          text-align: center;
        }

        .track-form-title {
          margin: 0 0 34px;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }

        .track-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          text-align: left;
        }

        .track-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dee6;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: #111827;
          background: #ffffff;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .track-input:focus {
          border-color: #003d7f;
          box-shadow: 0 0 0 3px rgba(0, 61, 127, 0.12);
        }

        .track-help {
          margin-top: 10px;
          font-size: 13px;
          color: #5b6472;
          text-align: left;
        }

        .track-submit {
          margin-top: 16px;
          width: 100%;
          border: 1px solid #003d7f;
          border-radius: 8px;
          background: #003d7f;
          color: #ffffff;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .track-submit:disabled {
          opacity: 0.75;
          cursor: wait;
        }

        .track-error {
          margin-top: 14px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
        }

        .track-status-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 36px;
        }

        .track-panel-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0b0b0b;
        }

        .track-status-reference-text {
          margin-top: 4px;
          font-size: 14px;
          color: #475569;
        }

        .track-current-status-label,
        .track-timeline-title {
          font-size: 14px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 10px;
        }

        .track-current-status-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 42px;
        }

        .track-status-badge,
        .track-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .track-status-pill {
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 12px;
        }

        .track-status-badge-green { background: #dcfce7; color: #15803d; }
        .track-status-badge-blue, .track-status-pill-blue { background: #dbeafe; color: #1d4ed8; }
        .track-status-badge-yellow, .track-status-pill-yellow { background: #fef3c7; color: #b45309; }
        .track-status-badge-purple, .track-status-pill-purple { background: #f3e8ff; color: #7e22ce; }
        .track-status-badge-orange, .track-status-pill-orange { background: #ffedd5; color: #c2410c; }
        .track-status-badge-green, .track-status-pill-green { background: #dcfce7; color: #15803d; }

        .track-current-status-since {
          font-size: 14px;
          color: #475569;
        }

        .track-timeline {
          display: grid;
          gap: 18px;
        }

        .track-timeline-item {
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 12px;
        }

        .track-timeline-rail {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .track-timeline-node {
          width: 10px;
          height: 10px;
          display: flex;
          border-radius: 50%;
          margin-top: 4px;
        }

        .track-timeline-line {
          width: 1px;
          flex: 1;
          background: #d1d5db;
          margin-top: 6px;
        }

        .track-timeline-description {
          font-size: 15px;
          line-height: 1.5;
          color: #0b0b0b;
          margin-bottom: 6px;
        }

        .track-timeline-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .track-timeline-date,
        .track-timeline-officer {
          font-size: 12px;
          color: #64748b;
        }

        .track-status-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .track-detail-block {
          border-radius: 12px;
          padding: 8px 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .track-detail-label {
          font-size: 14px;
          color: #475569;
        }

        .track-detail-value {
          font-size: 16px;
          line-height: 1.45;
          color: #0b0b0b;
        }

        .track-my-reports-section {
          max-width: 760px;
          margin: 0 auto 54px;
        }

        .track-my-reports-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 24px;
          text-align: center;
        }

        .my-report-card {
          margin-bottom: 24px;
        }

        .track-clickable-card {
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .track-clickable-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 44px rgba(90, 108, 166, 0.18);
          border-color: #003d7f;
        }

        .track-timeline-wrap-compact .track-timeline-item {
          margin-bottom: 8px;
        }

        .track-faq-wrap {
          background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.42) 100%);
          padding: 26px 0 78px;
        }

        .track-faq-title {
          margin: 0 0 30px;
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          color: #0b0b0b;
        }

        .track-faq-list {
          max-width: 770px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }

        .track-faq-item {
          background: #ffffff;
          border: 1px solid #e4e4e4;
          border-radius: 14px;
          overflow: hidden;
        }

        .track-faq-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 18px;
          border: 0;
          background: #ffffff;
          color: #0b0b0b;
          font-size: 16px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
        }

        .track-faq-arrow {
          flex-shrink: 0;
          font-size: 18px;
          color: #0b0b0b;
          transition: transform 0.18s ease;
        }

        .track-faq-arrow.is-open {
          transform: rotate(-90deg);
        }

        .track-faq-content {
          padding: 0 18px 18px;
          font-size: 14px;
          line-height: 1.55;
          color: #5b6472;
          white-space: pre-line;
        }

        .track-footer-spacer {
          height: 60px;
          background: #ffffff;
        }

        .track-footer {
          background: #003D7F;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .track-footer-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .track-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .track-footer-about {
          line-height: 1.7;
        }

        .track-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .track-footer-links li a {
          color: #b8c8e0;
          text-decoration: none;
          transition: color 0.15s;
        }

        .track-footer-links li a:hover {
          color: #fff;
        }

        .track-footer-contact {
          line-height: 1.9;
        }

        .track-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 20px 0;
          font-size: 0;
          color: transparent;
          text-align: center;
        }

        .track-footer-bottom::after {
          content: "© 2026 HapsayDalan. All rights reserved.";
          font-size: 13px;
          color: #8fa3be;
        }

        @media (max-width: 900px) {
          .track-status-details,
          .track-footer-grid {
            grid-template-columns: 1fr;
          }

          .track-status-header {
            flex-direction: column;
          }
        }

        @media (max-width: 768px) {
          .track-hero {
            padding: 56px 20px 72px;
          }

          .track-form-card,
          .track-status-card {
            padding: 22px;
          }

          .track-faq-trigger {
            font-size: 15px;
          }
        }
      `}</style>

      <div className="track-page">
        <Navbar currentPage="track" />

        <header className="track-hero">
          <h1 className="track-hero-title">Track My Report</h1>
          <p className="track-hero-text">
            Check the status of your submitted report in HapsayDalan using your reference ID.
            Get real-time updates on review, assignment, and resolution progress.
          </p>
        </header>

        <main className="track-shell">
          <section className="track-form-card">
            <h2 className="track-form-title">Enter Your Reference ID</h2>

            <form onSubmit={lookupReport}>
              <label className="track-label" htmlFor="reference-id">
                Reference ID *
              </label>
              <input
                id="reference-id"
                className="track-input"
                placeholder="e.g., SUP-48291357"
                value={referenceId}
                onChange={(event) => {
                  setReferenceId(event.target.value);
                  setLookupError("");
                }}
              />
              <div className="track-help">You received this ID when you submitted your report</div>
              <button type="submit" className="track-submit" disabled={isLoading}>
                {isLoading ? "Checking..." : "View Status"}
              </button>
              {lookupError ? <div className="track-error">{lookupError}</div> : null}
            </form>
          </section>

          {renderStatusCard()}

          {myReports.length > 0 && !reportResult && (
            <div className="track-my-reports-section">
              <h2 className="track-my-reports-title">My Recent Reports</h2>
              <div className="track-my-reports-grid">
                {myReports.map((report) => {
                  const liveData = myReportsData[report.referenceId];
                  return (
                    <section
                      key={report.referenceId}
                      className="track-status-card my-report-card track-clickable-card"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setReferenceId(report.referenceId);
                        setReportResult(null);
                        setLookupError("");
                      }}
                    >
                      <div className="track-status-header">
                        <div>
                          <h3 className="track-panel-title">{report.violation_type || "Violation Report"}</h3>
                          <div className="track-status-reference-text">Reference ID: {report.referenceId}</div>
                        </div>
                        {liveData && (
                          <div className={`track-status-badge track-status-badge-${STATUS_COLORS[liveData.displayStatus]}`}>
                            {liveData.displayStatus}
                          </div>
                        )}
                      </div>

                      <div className="track-detail-block" style={{ marginBottom: '24px' }}>
                        <span className="track-detail-label">Location</span>
                        <span className="track-detail-value">{report.location || "Location provided"}</span>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <section className="track-faq-wrap">
          <h2 className="track-faq-title">Frequently Asked Questions</h2>
          <div className="track-faq-list">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index;

              return (
                <div key={item.question} className="track-faq-item">
                  <button
                    type="button"
                    className="track-faq-trigger"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <span>{item.question}</span>
                    <span className={`track-faq-arrow ${isOpen ? "is-open" : ""}`}>▶</span>
                  </button>
                  {isOpen ? <div className="track-faq-content">{item.answer}</div> : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="track-footer-spacer" />

        <footer className="track-footer">
          <div className="track-footer-grid">
            <div>
              <div className="track-footer-col-title">About</div>
              <p className="track-footer-about">
                HapsayDalan helps keep Surigao City's roads safe by making traffic violation
                reporting faster, clearer, and easier for the community.
              </p>
            </div>
            <div>
              <div className="track-footer-col-title">Quick Links</div>
              <ul className="track-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="track-footer-col-title">Support</div>
              <ul className="track-footer-links">
                <li><a href="/faqs">FAQs</a></li>
                <li><a href="/contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="track-footer-col-title">Contact CTMO</div>
              <p className="track-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="track-footer-bottom">
            <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
