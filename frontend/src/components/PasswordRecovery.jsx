import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "./MaterialIcon";
import ThemeToggle from "./ThemeToggle";
import logo from "../assets/ctmo-shield-logo-transparent.png";
import "./PasswordRecovery.css";

function RecoverySubmitButton({ busy, disabled, label, busyLabel, type = "submit" }) {
  return <div className="pr-submit-action">
    <button type={type} className={`pr-primary${busy ? " pr-primary-driving" : ""}`}
      disabled={disabled || busy} aria-label={busy ? busyLabel : label} aria-busy={busy}>
      {busy ? <span className="pr-drive-animation" aria-hidden="true">
        <span className="pr-drive-road" />
        <span className="pr-drive-track"><span className="pr-drive-car">
          <svg viewBox="0 0 68 38" focusable="false">
            <g className="pr-car-speed" fill="none" stroke="#d8e9ff" strokeWidth="2" strokeLinecap="round"><path d="M2 15h9M0 21h8M4 27h6" /></g>
            <g className="pr-car-body">
              <path d="M15 19l6-10a5 5 0 0 1 4-2h17a6 6 0 0 1 5 3l7 9 7 3v9H12v-9z" fill="#fff" />
              <path d="M25 10h7v9H19zm10 0h7l7 9H35z" fill="#80b4ed" />
              <rect x="29" y="3" width="10" height="4" rx="2" fill="#ffce59" />
              <path d="M15 23h43" stroke="#b5d3f4" strokeWidth="2" />
              <rect x="56" y="22" width="5" height="4" rx="1" fill="#ffce59" />
              <rect x="12" y="23" width="3" height="4" rx="1" fill="#ff9a91" />
              <circle cx="23" cy="30" r="6" fill="#173553" /><circle cx="50" cy="30" r="6" fill="#173553" />
              <g className="pr-car-wheel" fill="none" stroke="#e6f1ff" strokeWidth="2"><circle cx="23" cy="30" r="2.5" /><circle cx="50" cy="30" r="2.5" /></g>
            </g>
          </svg>
        </span></span>
      </span> : label}
    </button>
    {busy && <p className="pr-action-status" role="status">{busyLabel}</p>}
  </div>;
}

function PasswordField({ id, label, value, onChange }) {
  const [visible, setVisible] = useState(false);
  return <div className="pr-field">
    <label htmlFor={id}>{label}</label>
    <div className="pr-password">
      <input id={id} type={visible ? "text" : "password"} value={value} onChange={onChange}
        autoComplete="new-password" minLength={8} maxLength={128} required />
      <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={visible} aria-controls={id} onClick={() => setVisible(!visible)}>
        <MaterialIcon name={visible ? "visibility_off" : "visibility"} />
      </button>
    </div>
  </div>;
}

function errorMessage(error) {
  const data = error.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const messages = Object.values(data).flat().filter((value) => typeof value === "string");
    if (messages.length) return messages.join(" ");
  }
  return "Unable to connect. Please try again in a moment.";
}

export default function PasswordRecovery({ initialEmail = "", resetLink, onBack }) {
  const [step, setStep] = useState(resetLink ? "password" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState("");
  const [proof, setProof] = useState(resetLink);
  const [code, setCode] = useState(Array(6).fill(""));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const digits = useRef([]);
  const title = useRef(null);
  const requestInFlight = useRef(false);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const stage = step === "email" ? 1 : step === "code" ? 2 : 3;
  const strength = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;

  useEffect(() => {
    if (step === "code") digits.current[0]?.focus();
    else title.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!resendAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function run(action, kind) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true); setPendingAction(kind); setError(""); setNotice("");
    try { await action(); }
    catch (failure) {
      setError(errorMessage(failure));
      if (failure.response?.status === 429) {
        const delay = Number(failure.response.headers?.["retry-after"]) || 60;
        setResendAt(Date.now() + delay * 1000); setNow(Date.now());
      }
    } finally { requestInFlight.current = false; setBusy(false); setPendingAction(null); }
  }

  function sendCode(event) {
    event?.preventDefault();
    run(async () => {
      const { data } = await API.post("admin/password-reset/code/", { email: email.trim() });
      setChallenge(data.challenge_id); setCode(Array(6).fill(""));
      setResendAt(Date.now() + (data.resend_after || 60) * 1000); setNow(Date.now());
      setNotice(data.detail); setStep("code"); digits.current[0]?.focus();
    }, "send");
  }

  function verifyCode(value = code.join("")) {
    if (!/^[0-9]{6}$/.test(value)) { setError("Enter the complete 6-digit code."); return; }
    run(async () => {
      const { data } = await API.post("admin/password-reset/code/verify/", { challenge_id: challenge, code: value });
      setProof({ uid: data.uid, token: data.token }); setCode(Array(6).fill("")); setStep("password");
    }, "verify");
  }

  function enterDigits(index, value) {
    const numbers = value.replace(/\D/g, "").slice(0, 6);
    const next = [...code];
    if (!numbers) next[index] = "";
    else [...numbers].forEach((digit, offset) => { if (index + offset < 6) next[index + offset] = digit; });
    setCode(next); setError("");
    digits.current[Math.min(index + numbers.length, 5)]?.focus();
    if (next.every(Boolean)) verifyCode(next.join(""));
  }

  function savePassword(event) {
    event.preventDefault();
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    run(async () => {
      await API.post("admin/password-reset/confirm/", { ...proof, password });
      setPassword(""); setConfirmation(""); setProof(null);
      window.history.replaceState(null, "", window.location.pathname);
      setStep("success");
    }, "reset");
  }

  function back() {
    setError(""); setNotice("");
    if (step === "code") { setCode(Array(6).fill("")); setStep("email"); }
    else onBack();
  }

  const titles = { email: "Forgot password?", code: "Check your email", password: "Create new password", success: "Password updated!" };
  return <main className="password-recovery-page">
    <section className={`pr-card${step === "success" ? " pr-success" : ""}`} aria-labelledby="recovery-title">
      <header className="pr-card-header">
        <div className="pr-brand"><img src={logo} alt="CTMO shield" /><div><strong>HapsayDalan</strong><span>CTMO account recovery</span></div></div>
        <div className="pr-appearance"><ThemeToggle showLabel /></div>
      </header>
      {step !== "success" && <nav className="pr-progress" aria-label="Password recovery progress">
        <button type="button" className="pr-back" onClick={back} disabled={busy} aria-label="Go back"><MaterialIcon name="arrow_back" /></button>
        <ol>{["Email", "Verify", "New password"].map((label, index) => <li key={label} className={stage >= index + 1 ? "is-active" : ""}
          aria-current={stage === index + 1 ? "step" : undefined}><span>{label}</span></li>)}</ol>
        <span className="pr-step-count">{stage} / 3</span>
      </nav>}
      <div className="pr-recovery-body">
      <div className="pr-context">
      <div className="pr-stage-icon"><MaterialIcon size={32} name={step === "success" ? "check_circle" : step === "email" ? "lock" : step === "code" ? "mail" : "key"} /></div>
      <h1 id="recovery-title" ref={title} tabIndex={-1}>{titles[step]}</h1>
      <p className="pr-intro">{step === "email" ? "Enter your CTMO account email. We’ll send a code to help you get back in."
        : step === "code" ? <>If this email belongs to an active CTMO account, a 6-digit code will arrive at <strong>{email.trim()}</strong>.</>
          : step === "password" ? "Choose a new password you haven’t used before. You’ll use it the next time you log in."
            : "Your password has been changed. You can now log in to the CTMO portal with your new password."}</p>
      </div>
      <div className="pr-form-area">
      {error && <div className="pr-error" role="alert">{error}</div>}
      {notice && step === "code" && <p className="pr-notice" role="status">{notice}</p>}
      {step === "email" && <form onSubmit={sendCode} aria-busy={busy}>
        <div className="pr-field"><label htmlFor="recovery-email">Email Address</label>
          <input id="recovery-email" type="email" autoComplete="email" placeholder="Your account email" required maxLength={254}
            value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={busy} /></div>
        <RecoverySubmitButton busy={busy} disabled={remaining > 0}
          label={remaining ? `Try again in ${remaining}s` : "Send verification code"}
          busyLabel={`Sending a code to ${email.trim()}…`} />
      </form>}
      {step === "code" && <form className="pr-code-form" onSubmit={(event) => { event.preventDefault(); verifyCode(); }} aria-busy={busy}>
        <fieldset className="pr-code"><legend>Verification code</legend><div className="pr-code-digits">{code.map((digit, index) => <input key={index}
          ref={(element) => { digits.current[index] = element; }} aria-label={`Digit ${index + 1} of 6`} value={digit}
          type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} pattern="[0-9]*" maxLength={6}
          disabled={busy} onChange={(event) => enterDigits(index, event.target.value)} onFocus={(event) => event.target.select()}
          onPaste={(event) => { event.preventDefault(); enterDigits(index, event.clipboardData.getData("text")); }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index) { event.preventDefault(); const next = [...code]; next[index - 1] = ""; setCode(next); digits.current[index - 1]?.focus(); }
            if (event.key === "ArrowLeft" && index) { event.preventDefault(); digits.current[index - 1]?.focus(); }
            if (event.key === "ArrowRight" && index < 5) { event.preventDefault(); digits.current[index + 1]?.focus(); }
          }} />)}</div></fieldset>
        {pendingAction === "send" ? <RecoverySubmitButton type="button" busy label="Resend code"
          busyLabel={`Sending a new code to ${email.trim()}…`} />
          : <button className="pr-primary" disabled={busy || code.some((digit) => !digit)}>{busy ? "Verifying…" : "Verify code"}</button>}
        <p className="pr-help">The code expires in 10 minutes. Check Spam if it hasn’t arrived.</p>
        <div className="pr-resend"><span>Didn’t receive a code?</span><button type="button" onClick={sendCode} disabled={busy || remaining > 0}>{remaining ? `Resend in ${remaining}s` : "Resend code"}</button></div>
        <button className="pr-change-email" type="button" onClick={back} disabled={busy}>
          <MaterialIcon name="mail" size={18} /><span>Use a different email</span>
        </button>
      </form>}
      {step === "password" && <form onSubmit={savePassword} aria-busy={busy}>
        <PasswordField id="new-password" label="New Password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
        <PasswordField id="confirm-new-password" label="Confirm New Password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} />
        <div className="pr-strength" aria-label={`Password strength: ${password ? ["", "Weak", "Fair", "Good", "Strong"][strength] || "Weak" : "Not entered"}`}>
          <div>{[1, 2, 3, 4].map((value) => <span key={value} className={password && strength >= value ? "is-filled" : ""} />)}</div>
          <span>{password ? ["Weak", "Weak", "Fair", "Good", "Strong"][strength] : "Password strength"}</span>
        </div>
        <ul className="pr-requirements"><li className={password.length >= 8 ? "is-met" : ""}>At least 8 characters</li>
          <li className={password && password === confirmation ? "is-met" : ""}>Passwords match</li></ul>
        <p className="pr-help">Use a mix of letters, numbers, and symbols. Avoid your name or email.</p>
        <RecoverySubmitButton busy={busy} disabled={password.length < 8 || password !== confirmation}
          label="Reset password" busyLabel="Resetting your password…" />
        {error && <button className="pr-text-button" type="button" disabled={busy} onClick={() => { setProof(null); setPassword(""); setConfirmation(""); setError(""); setStep("email"); window.history.replaceState(null, "", window.location.pathname); }}>Request a new code</button>}
      </form>}
      {step === "success" && <button className="pr-primary" onClick={onBack}>Back to Log In</button>}
      {step !== "success" && <button type="button" className="pr-login-link" onClick={onBack} disabled={busy}>
        <MaterialIcon name="arrow_back" size={18} /><span>Back to Log In</span>
      </button>}
      </div>
      </div>
      <footer className="pr-footer">Secure access for authorized CTMO personnel.</footer>
    </section>
  </main>;
}
