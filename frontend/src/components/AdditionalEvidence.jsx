import { useCallback, useEffect, useId, useRef, useState } from "react";
import API from "../services/api";
import ReportRecovery from "./ReportRecovery";
import "./AdditionalEvidence.css";

const errorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (typeof data === "string") return data;
  const value = data && Object.values(data).find((item) => typeof item === "string" || Array.isArray(item));
  return Array.isArray(value) ? value.join(" ") : value || fallback;
};
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "";

function EvidenceAttachment({ item, headers }) {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }[item.attachment_content_type] || "bin";
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const load = async () => {
    if (loading) return;
    setLoading(true); setError("");
    try {
      // Django returns a path rooted at /api/. Axios otherwise prefixes /api/
      // again, even when that path starts with a slash.
      const apiOrigin = new URL(API.defaults?.baseURL || "/api/", window.location.origin).origin;
      const response = await API.get(item.attachment_url, { baseURL: apiOrigin, headers, responseType: "blob" });
      if (mounted.current) setPreview(URL.createObjectURL(response.data));
    } catch (failure) {
      if (mounted.current) setError(failure.response?.status === 403 ? "Verify your report email again, then reload the attachment." : "Could not load the attachment. Please retry.");
    } finally { if (mounted.current) setLoading(false); }
  };
  return <div className="ae-attachment">
    {!preview ? <button type="button" className="ae-secondary" disabled={loading} onClick={load}>{loading ? "Loading attachment..." : item.attachment_content_type?.startsWith("video/") ? "View additional video" : "View additional photo"}</button>
      : <>{item.attachment_content_type?.startsWith("video/") ? <video src={preview} controls playsInline preload="metadata" /> : <img src={preview} alt="Additional evidence submitted by the reporter" />}
        <a className="ae-download" href={preview} download={`additional-evidence.${extension}`}>Download attachment</a></>}
    {error ? <p role="alert" className="ae-error">{error}</p> : null}
  </div>;
}

export default function AdditionalEvidence({ report, admin = false, accessToken = "", onVerified, onChanged }) {
  const id = useId();
  const [token, setToken] = useState(accessToken);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(!admin && !accessToken);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationFailed, setNotificationFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [responseText, setResponseText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [canReply, setCanReply] = useState(true);
  const fileInput = useRef(null);
  const closed = ["Resolved", "Rejected"].includes(report.status);
  const openRequest = requests.find((item) => !item.responded_at);
  useEffect(() => { setToken(accessToken); }, [accessToken]);

  const loadHistory = useCallback(async (isCurrent = () => true) => {
    if (!admin && !token) { setNeedsVerification(true); return; }
    setLoading(true); setError("");
    try {
      const result = await API.get(`reports/${report.id}/evidence/`, { headers: token ? { "X-Report-Access": token } : {} });
      if (isCurrent()) { setRequests(result.data.requests || []); setCanReply(result.data.can_reply !== false); setNeedsVerification(false); setHistoryReady(true); }
    } catch (failure) {
      if (isCurrent()) {
        setHistoryReady(false);
        setError(errorMessage(failure, "Could not load the evidence history. Please retry."));
        if (!admin && failure.response?.status === 403) { setNeedsVerification(true); setRequests([]); }
      }
    } finally { if (isCurrent()) setLoading(false); }
  }, [report.id, admin, token]);
  useEffect(() => { let current = true; loadHistory(() => current); return () => { current = false; }; }, [loadHistory]);

  const sendRequest = async (event) => {
    event.preventDefault();
    if (busy || !message.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await API.post(`reports/${report.id}/evidence/request/`, { message: message.trim() });
      setRequests((current) => [data.request, ...current]); setMessage("");
      setNotice(data.detail); setNotificationFailed(!data.notification_sent); onChanged?.("requested");
    } catch (failure) { setError(errorMessage(failure, "Could not request additional evidence. Please retry.")); }
    finally { setBusy(false); }
  };
  const sendReply = async (event) => {
    event.preventDefault();
    if (busy || !openRequest) return;
    if (!responseText.trim() && !attachment) { setError("Add a photo/video or written clarification before sending."); return; }
    if (attachment?.size > 50 * 1024 * 1024) { setError("The file must be 50 MB or smaller."); return; }
    setBusy(true); setError(""); setNotice("");
    const payload = new FormData();
    payload.append("response_text", responseText.trim());
    if (attachment) payload.append("attachment", attachment);
    try {
      const { data } = await API.post(`reports/${report.id}/evidence/${openRequest.id}/respond/`, payload, { headers: { "X-Report-Access": token } });
      setRequests((current) => current.map((item) => item.id === data.request.id ? data.request : item));
      setNotice(data.detail); setNotificationFailed(false); setResponseText(""); setAttachment(null);
      if (fileInput.current) fileInput.current.value = "";
      onChanged?.("submitted");
    } catch (failure) {
      setError(errorMessage(failure, "Could not submit additional evidence. Please retry."));
      if (failure.response?.status === 403) { setNeedsVerification(true); setRequests([]); }
    } finally { setBusy(false); }
  };

  return <section className="ae-panel" aria-labelledby={`${id}-title`}>
    <div className="ae-heading"><div><span className="ae-eyebrow">CASE FOLLOW-UP</span><h3 id={`${id}-title`}>Additional evidence</h3></div>
      {(admin || !needsVerification) ? <button type="button" className="ae-refresh" disabled={loading || busy} onClick={() => loadHistory()}>Refresh evidence</button> : null}</div>
    <p className="ae-intro">{admin ? "Ask the reporter for the specific evidence or clarification needed to review this case." : "CTMO has a follow-up on your report. Your original evidence is kept with this case."}</p>
    {error ? <p role="alert" className="ae-error">{error}</p> : null}
    {notice ? <p role="status" className={`ae-notice${notificationFailed ? " is-warning" : ""}`}>{notice}</p> : null}
    {needsVerification && !admin ? <ReportRecovery embedded verificationOnly onVerified={(value) => {
      setToken(value); setNeedsVerification(false); onVerified?.(value);
    }} /> : <>
      {loading ? <p className="ae-help" role="status">Loading evidence history...</p> : null}
      <div className="ae-history">{requests.map((item) => <article key={item.id} className={`ae-history-item${item.responded_at ? " is-submitted" : ""}`}>
        <div className="ae-request-meta"><strong>{item.responded_at ? "Response received" : admin ? "Awaiting reporter" : "Your response is needed"}</strong><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time></div>
        <p className="ae-message">{item.message}</p>
        {item.responded_at ? <div className="ae-response"><strong>Reporter response</strong>
          {item.response_text ? <p>{item.response_text}</p> : null}
          <time dateTime={item.responded_at}>Submitted {dateLabel(item.responded_at)}</time>
          {item.attachment_url ? <EvidenceAttachment item={item} headers={token ? { "X-Report-Access": token } : {}} /> : null}
        </div> : null}
      </article>)}</div>
      {admin && !closed && !openRequest && !loading && historyReady ? <form className="ae-form" onSubmit={sendRequest}>
        <label htmlFor={`${id}-request`}>What evidence is needed? <span aria-hidden="true">*</span></label>
        <textarea id={`${id}-request`} value={message} disabled={busy} onChange={(event) => setMessage(event.target.value)} required maxLength={1000} rows="3"
          placeholder="Example: Please provide a clearer photo showing the obstruction and the vehicle plate number." />
        <p className="ae-help">The reporter can see this message after verifying their email. Original evidence and case status are preserved.</p>
        <button type="submit" className="ae-primary" disabled={busy || !message.trim()}>{busy ? "Sending request..." : "Request additional evidence"}</button>
      </form> : null}
      {!admin && openRequest && canReply && !closed ? <form className="ae-form" onSubmit={sendReply}>
        <label htmlFor={`${id}-response`}>Additional details</label>
        <textarea id={`${id}-response`} maxLength={2000} rows="3" value={responseText} disabled={busy}
          onChange={(event) => setResponseText(event.target.value)} placeholder="Provide the details CTMO requested..." />
        <label htmlFor={`${id}-file`}>Additional photo or video</label>
        <input ref={fileInput} id={`${id}-file`} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm" disabled={busy}
          onChange={(event) => { setAttachment(event.target.files?.[0] || null); setError(""); }} />
        <p className="ae-help">Add written clarification, one photo/video, or both. JPG, PNG, WebP, GIF, MP4, MOV, or WebM; maximum 50 MB.</p>
        <button type="submit" className="ae-primary" disabled={busy || (!responseText.trim() && !attachment)}>{busy ? "Submitting evidence..." : "Submit additional evidence"}</button>
      </form> : null}
      {closed || !canReply ? <p className="ae-help">This case is closed. Additional evidence cannot be requested or submitted.</p> : null}
      {!admin && !openRequest && requests.length && !closed && canReply ? <p className="ae-help">Your response has been received and is awaiting CTMO review.</p> : null}
    </>}
  </section>;
}
