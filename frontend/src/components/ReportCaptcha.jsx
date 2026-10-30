import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import "./ReportCaptcha.css";

let captchaScript;
function loadCaptcha() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (captchaScript) return captchaScript;
  captchaScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => { script.remove(); reject(new Error("CAPTCHA took too long to load. Check your connection and retry.")); }, 20000);
    window.hapsayCaptchaReady = () => { clearTimeout(timeout); resolve(window.grecaptcha); };
    script.src = "https://www.google.com/recaptcha/api.js?onload=hapsayCaptchaReady&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error("Unable to load CAPTCHA. Check your connection or content blocker and retry.")); };
    document.head.appendChild(script);
  }).catch((error) => { captchaScript = null; throw error; });
  return captchaScript;
}

export default function ReportCaptcha({ onClose, onConfirm, busy, submissionError, canSubmit,
  confirmLabel = "Verify & Submit Report", busyLabel = "Submitting…",
  message = "Please complete the CAPTCHA to help prevent spam. Your report has not been submitted yet." }) {
  const host = useRef(null);
  const widget = useRef(null);
  const confirmButton = useRef(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; previousFocus?.focus(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setToken(""); setError(""); setLoading(true);
    const initialize = async () => {
      try {
        const { data } = await API.get("captcha-config/", { timeout: 15000 });
        if (!data.configured || !data.site_key) throw new Error("CAPTCHA is not configured yet. Please contact the administrator.");
        const captcha = await loadCaptcha();
        if (cancelled || !host.current) return;
        // Each render gets a new mount point; this also handles React StrictMode cleanup.
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        widget.current = captcha.render(mount, {
          sitekey: data.site_key,
          size: window.innerWidth < 380 ? "compact" : "normal",
          callback: (response) => { if (!cancelled) { setToken(response); setError(""); confirmButton.current?.focus(); } },
          "expired-callback": () => { if (!cancelled) { setToken(""); setError("CAPTCHA expired. Please complete it again."); } },
          "error-callback": () => { if (!cancelled) {
            setToken("");
            setError(`CAPTCHA is unavailable. If the widget says "Invalid domain for site key", the administrator must authorize ${window.location.hostname} in Google reCAPTCHA settings. Otherwise, check your connection and retry.`);
          } },
        });
      } catch (failure) {
        if (!cancelled) setError(failure.message || "CAPTCHA is unavailable. Please retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initialize();
    return () => {
      cancelled = true;
      if (widget.current !== null && window.grecaptcha) {
        try { window.grecaptcha.reset(widget.current); } catch (_) { /* widget may already be removed */ }
      }
      widget.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (!submissionError) return;
    setToken("");
    if (widget.current !== null && window.grecaptcha) window.grecaptcha.reset(widget.current);
  }, [submissionError]);

  return (
    <div className="report-captcha-backdrop">
      <section className="report-captcha-dialog" role="dialog" aria-modal="true" aria-labelledby="captcha-title">
        <div className="report-captcha-header"><div><span className="report-captcha-eyebrow">ONE LAST STEP</span>
          <h2 id="captcha-title">Verify your report</h2></div>
          <button className="report-captcha-close" type="button" aria-label="Close CAPTCHA" disabled={busy} onClick={onClose} autoFocus>×</button>
        </div>
        <p>{message}</p>
        {loading ? <p role="status">Loading CAPTCHA…</p> : null}
        <div className="report-captcha-widget" ref={host} />
        {error || submissionError ? <p className="report-captcha-error" role="alert">{submissionError || error}</p> : null}
        {!canSubmit ? <p className="report-captcha-error" role="status">A recent device location and confirmed violation pin are required. Keep location enabled, or return to the report to confirm your pin.</p> : null}
        {error ? <button className="report-captcha-retry" type="button" disabled={busy} onClick={() => setRetry((current) => current + 1)}>Retry CAPTCHA</button> : null}
        <div className="report-captcha-actions">
          <button type="button" disabled={busy} onClick={onClose}>Back to report</button>
          <button type="button" ref={confirmButton} disabled={!token || busy || !canSubmit}
            onClick={() => onConfirm(token)}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
