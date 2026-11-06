import React, { useState, useRef, useEffect, useCallback } from "react";
import MaterialIcon from "./MaterialIcon";
import ThemeToggle from "./ThemeToggle";
import "./AdminSecurityGate.css";

const REQUIRED_PIN = "1016";
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

const STORAGE_LOCKOUT_KEY = "ctmo_gate_lockout_until";
const STORAGE_ATTEMPTS_KEY = "ctmo_gate_failed_attempts";

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) {
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${s}s`;
}

export default function AdminSecurityGate({ onUnlock }) {
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [status, setStatus] = useState("idle"); // "idle" | "error" | "unlocked" | "locked_out"
  const [errorMessage, setErrorMessage] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_ATTEMPTS_KEY);
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [lockoutTimer, setLockoutTimer] = useState(() => {
    try {
      const until = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      if (until) {
        const remaining = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch {
      // localStorage optional
    }
    return 0;
  });

  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const isLockedOut = lockoutTimer > 0;

  // Initialize lockout state if active on mount
  useEffect(() => {
    if (lockoutTimer > 0) {
      setStatus("locked_out");
      setErrorMessage(`Too many failed attempts. Security gate locked. Please wait ${formatSeconds(lockoutTimer)}.`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutTimer <= 0) {
      if (status === "locked_out") {
        setStatus("idle");
        setErrorMessage("Lockout period completed. You may now enter the Security PIN.");
        setFailedAttempts(0);
        try {
          localStorage.removeItem(STORAGE_LOCKOUT_KEY);
          localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
        } catch {
          // ignore
        }
        setTimeout(() => inputRefs[0]?.current?.focus(), 50);
      }
      return;
    }

    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          return 0;
        }
        setErrorMessage(`Too many failed attempts. Security gate locked. Please wait ${formatSeconds(next)}.`);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTimer, status]);

  // Focus first input on mount if not locked out
  useEffect(() => {
    if (!isLockedOut) {
      const timer = setTimeout(() => {
        inputRefs[0]?.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLockedOut]);

  const handleVerify = useCallback((code) => {
    if (isLockedOut) return;

    if (code === REQUIRED_PIN) {
      setStatus("unlocked");
      setErrorMessage("");
      setFailedAttempts(0);
      try {
        localStorage.removeItem(STORAGE_LOCKOUT_KEY);
        localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
        sessionStorage.setItem("ctmo_security_gate_unlocked", "true");
      } catch (err) {
        // storage optional
      }
      setTimeout(() => {
        if (typeof onUnlock === "function") {
          onUnlock();
        }
      }, 550);
    } else {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setPinDigits(["", "", "", ""]);

      if (nextAttempts >= MAX_ATTEMPTS) {
        // Trigger lockout
        const until = Date.now() + LOCKOUT_SECONDS * 1000;
        try {
          localStorage.setItem(STORAGE_LOCKOUT_KEY, until.toString());
          localStorage.setItem(STORAGE_ATTEMPTS_KEY, nextAttempts.toString());
        } catch {
          // ignore
        }
        setLockoutTimer(LOCKOUT_SECONDS);
        setStatus("locked_out");
        setErrorMessage(`Too many failed attempts (${nextAttempts}/${MAX_ATTEMPTS}). Security gate locked for ${LOCKOUT_SECONDS}s.`);
      } else {
        const remaining = MAX_ATTEMPTS - nextAttempts;
        try {
          localStorage.setItem(STORAGE_ATTEMPTS_KEY, nextAttempts.toString());
        } catch {
          // ignore
        }
        setStatus("error");
        setErrorMessage(
          `Incorrect Security PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`
        );
        setTimeout(() => {
          inputRefs[0]?.current?.focus();
        }, 50);
      }
    }
  }, [failedAttempts, isLockedOut, onUnlock]);

  const updateDigit = (index, char) => {
    if (isLockedOut || !/^\d?$/.test(char)) return;

    setStatus("idle");
    setErrorMessage("");

    const next = [...pinDigits];
    next[index] = char;
    setPinDigits(next);

    if (char && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    }

    // Auto verify when 4th digit entered
    const fullCode = next.join("");
    if (fullCode.length === 4 && next.every((d) => d !== "")) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index, event) => {
    if (isLockedOut) return;

    if (event.key === "Backspace") {
      if (!pinDigits[index] && index > 0) {
        const next = [...pinDigits];
        next[index - 1] = "";
        setPinDigits(next);
        inputRefs[index - 1]?.current?.focus();
      } else {
        const next = [...pinDigits];
        next[index] = "";
        setPinDigits(next);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    } else if (event.key === "ArrowRight" && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handlePaste = (event) => {
    if (isLockedOut) return;
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").trim().replace(/\D/g, "");
    if (!pasted) return;

    const chars = pasted.slice(0, 4).split("");
    const next = ["", "", "", ""];
    chars.forEach((c, idx) => {
      if (idx < 4) next[idx] = c;
    });
    setPinDigits(next);

    if (chars.length === 4) {
      inputRefs[3]?.current?.focus();
      handleVerify(next.join(""));
    } else if (chars.length < 4) {
      inputRefs[chars.length]?.current?.focus();
    }
  };

  // On-screen keypad handlers
  const handleKeypadPress = (val) => {
    if (isLockedOut || status === "unlocked") return;

    if (val === "clear") {
      setPinDigits(["", "", "", ""]);
      setStatus("idle");
      setErrorMessage("");
      inputRefs[0]?.current?.focus();
      return;
    }

    if (val === "backspace") {
      const lastFilled = [...pinDigits].reverse().findIndex((d) => d !== "");
      if (lastFilled !== -1) {
        const targetIndex = 3 - lastFilled;
        const next = [...pinDigits];
        next[targetIndex] = "";
        setPinDigits(next);
        inputRefs[targetIndex]?.current?.focus();
      }
      return;
    }

    // Number pressed
    const firstEmpty = pinDigits.findIndex((d) => d === "");
    if (firstEmpty !== -1) {
      updateDigit(firstEmpty, String(val));
    }
  };

  return (
    <div className="admin-gate-page">
      <div className="admin-gate-card">
        <div className="admin-gate-topbar">
          <a href="/" className="admin-gate-back-link">
            <MaterialIcon name="arrow_back" size={16} className="admin-gate-inline-icon" />
            <span>Return to Homepage</span>
          </a>
          <ThemeToggle showLabel={false} />
        </div>

        <div className="admin-gate-header">
          <div
            className={`admin-gate-lock-icon ${status === "unlocked"
                ? "unlocked"
                : isLockedOut
                  ? "locked-out"
                  : status === "error"
                    ? "error"
                    : ""
              }`}
          >
            <MaterialIcon
              name={status === "unlocked" ? "lock_open" : "lock"}
              size={36}
            />
            {isLockedOut && (
              <span className="admin-gate-lockout-badge">
                <MaterialIcon name="timer" size={11} />
                <span>{formatSeconds(lockoutTimer)}</span>
              </span>
            )}
          </div>

          <div className="admin-gate-pill-group">
            <span className="admin-gate-pill">
              <MaterialIcon name="security" size={13} className="admin-gate-inline-icon" />
              <span>RESTRICTED ACCESS</span>
            </span>
            {failedAttempts > 0 && !isLockedOut && (
              <span className="admin-gate-attempt-pill">
                Attempt {failedAttempts}/{MAX_ATTEMPTS}
              </span>
            )}
          </div>

          <h1 className="admin-gate-title">CTMO Security Gate</h1>
          <p className="admin-gate-subtitle">
            {isLockedOut
              ? `Security cooldown active. Please wait ${formatSeconds(lockoutTimer)} before attempting again.`
              : "Enter the 4-digit security PIN to unlock the CTMO Admin portal"}
          </p>
        </div>

        <form
          className="admin-gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(pinDigits.join(""));
          }}
        >
          <div
            className={`admin-gate-digits ${status === "error" ? "shake" : ""} ${isLockedOut ? "is-disabled" : ""
              }`}
            onPaste={handlePaste}
          >
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                className={`admin-gate-digit-input ${digit ? "filled" : ""} ${status === "error" ? "is-error" : ""
                  } ${status === "unlocked" ? "is-success" : ""} ${isLockedOut ? "is-locked-out" : ""
                  }`}
                value={digit}
                onChange={(e) => updateDigit(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`Security PIN digit ${idx + 1}`}
                autoComplete="off"
                disabled={status === "unlocked" || isLockedOut}
              />
            ))}
          </div>

          <div className="admin-gate-toggle-wrap">
            <button
              type="button"
              className="admin-gate-toggle-visibility"
              onClick={() => setShowPin((prev) => !prev)}
              aria-label={showPin ? "Hide PIN digits" : "Show PIN digits"}
              disabled={isLockedOut}
            >
              <MaterialIcon name={showPin ? "visibility_off" : "visibility"} size={16} />
              <span>{showPin ? "Hide PIN" : "Show PIN"}</span>
            </button>
          </div>

          {errorMessage && (
            <div
              className={`admin-gate-error ${isLockedOut ? "lockout-alert" : ""}`}
              role="alert"
            >
              <MaterialIcon
                name={isLockedOut ? "timer" : "error_outline"}
                size={18}
                className="admin-gate-inline-icon"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === "unlocked" && (
            <div className="admin-gate-success" role="status">
              <MaterialIcon name="check_circle" size={18} className="admin-gate-inline-icon" />
              <span>Access granted. Unlocking CTMO Login...</span>
            </div>
          )}

          {/* Touch-friendly On-Screen Keypad */}
          <div className="admin-gate-keypad" aria-label="PIN Keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                className="admin-gate-key"
                onClick={() => handleKeypadPress(num)}
                disabled={status === "unlocked" || isLockedOut}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="admin-gate-key admin-gate-key-action admin-gate-key-clear"
              onClick={() => handleKeypadPress("clear")}
              disabled={status === "unlocked" || isLockedOut}
              aria-label="Clear all digits"
            >
              C
            </button>
            <button
              type="button"
              className="admin-gate-key"
              onClick={() => handleKeypadPress(0)}
              disabled={status === "unlocked" || isLockedOut}
            >
              0
            </button>
            <button
              type="button"
              className="admin-gate-key admin-gate-key-action admin-gate-key-backspace"
              onClick={() => handleKeypadPress("backspace")}
              disabled={status === "unlocked" || isLockedOut}
              aria-label="Delete last digit"
            >
              <MaterialIcon name="backspace" size={22} />
            </button>
          </div>

          <button
            type="submit"
            className="admin-gate-submit-btn"
            disabled={status === "unlocked" || isLockedOut || pinDigits.some((d) => d === "")}
          >
            {status === "unlocked"
              ? "Unlocking..."
              : isLockedOut
                ? `Locked (${formatSeconds(lockoutTimer)})`
                : "Unlock CTMO Portal"}
          </button>
        </form>

        <div className="admin-gate-footer">
          <small>
            Rate-limiting active • Max {MAX_ATTEMPTS} attempts • 60s cooldown • Protected by CTMO Surigao City
          </small>
        </div>
      </div>
    </div>
  );
}
