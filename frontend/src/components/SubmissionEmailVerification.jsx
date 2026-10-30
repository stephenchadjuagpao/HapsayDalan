import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import { formatWaitDuration } from "../utils/rateLimitMessage";
import "./ReportCaptcha.css";

export default function SubmissionEmailVerification({ challenge, onClose, onResend, onConfirm, busy, submissionError, canSubmit }) {
  const dialog = useRef(null);
  const [code, setCode] = useState("");
  const [proof, setProof] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const locked = busy || verifying;
  const channel = challenge.channel || "email";
  const destination = challenge.destination || challenge.email;
  const resendWait = Math.max(0, Math.ceil((challenge.receivedAt + challenge.resend_after * 1000 - now) / 1000));
  const expired = proof ? now >= proof.until : now >= challenge.receivedAt + challenge.expires_in * 1000;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  const confirm = async (event) => {
    event.preventDefault();
    if (locked || expired) return;
    if (proof) { await onConfirm(proof.value); return; }
    setVerifying(true);
    setError("");
    try {
      const csrf = await API.get("csrf/", { timeout: 15000 });
      const { data } = await API.post("submission-email/verify/", { challenge_id: challenge.challenge_id, code }, {
        timeout: 15000, headers: { "X-CSRFToken": csrf.data.csrfToken },
      });
      setProof({ value: data.email_verification_token, until: Date.now() + data.expires_in * 1000 });
      await onConfirm(data.email_verification_token);
    } catch (failure) {
      setError(failure.response?.data?.detail || "Could not verify the code. Please check it and try again.");
    } finally { setVerifying(false); }
  };

  const handleKeys = (event) => {
    if (event.key === "Escape" && !locked) onClose();
    if (event.key !== "Tab") return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <div className="report-captcha-backdrop">
    <section ref={dialog} className="report-captcha-dialog" role="dialog" aria-modal="true" aria-labelledby="submission-email-title" onKeyDown={handleKeys}>
      <div className="report-captcha-header"><div><span className="report-captcha-eyebrow">VERIFY YOUR {channel === "phone" ? "PHONE" : "EMAIL"}</span>
        <h2 id="submission-email-title">Enter your verification code</h2></div>
        <button type="button" className="report-captcha-close" aria-label="Close verification" disabled={locked} onClick={onClose}>&times;</button>
      </div>
      <p>A 6-digit code was sent by {channel === "phone" ? "text message to" : "email to"} <strong>{destination}</strong>. {channel === "phone" ? "Check your text messages." : "Check your inbox and spam folder."} Your report has not been submitted yet.</p>
      <form onSubmit={confirm}>
        <label htmlFor="submission-email-code">6-digit verification code</label>
        <input id="submission-email-code" className="submission-email-code" autoFocus inputMode="numeric" autoComplete="one-time-code"
          required pattern="[0-9]{6}" maxLength={6} value={code} disabled={locked || !!proof || expired}
          onChange={(event) => { setCode(event.target.value.replace(/[^0-9]/g, "")); setError(""); }} />
        <p className="submission-email-note">The code expires in 10 minutes. You have up to 5 attempts.</p>
        {proof && !expired ? <p role="status" className="submission-email-note">{channel === "phone" ? "Phone number" : "Email address"} verified. Ready to submit your report.</p> : null}
        {expired ? <p role="alert" className="report-captcha-error">Verification expired. Request a new code.</p> : null}
        {error || submissionError ? <p role="alert" className="report-captcha-error">{error || submissionError}</p> : null}
        {!canSubmit ? <p role="status" className="submission-email-note">Your verified code is saved. Location may need a refresh; press the button below to retry location and continue.</p> : null}
        <div className="report-captcha-actions">
          <button type="button" disabled={locked} onClick={onClose}>Back to report</button>
        <button type="submit" disabled={locked || expired || (!proof && code.length !== 6)}>
            {busy ? "Submitting..." : verifying ? "Verifying code..." : proof ? (canSubmit ? "Submit verified report" : "Refresh location to continue") : "Verify & Submit Report"}
          </button>
        </div>
      </form>
      <button type="button" className="report-captcha-retry" disabled={locked || resendWait > 0} onClick={onResend}>
        {resendWait > 0 ? `Request a new code in ${formatWaitDuration(resendWait)}` : "Request a new code"}
      </button>
    </section>
  </div>;
}
