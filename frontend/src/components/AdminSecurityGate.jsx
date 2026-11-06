import React, { useState, useRef, useEffect, useCallback } from "react";
import MaterialIcon from "./MaterialIcon";
import ctmoShieldLogo from "../assets/ctmo-shield-logo-transparent.png";
import ThemeToggle from "./ThemeToggle";
import "./AdminSecurityGate.css";

const REQUIRED_PIN = "1016";

export default function AdminSecurityGate({ onUnlock }) {
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [status, setStatus] = useState("idle"); // "idle" | "error" | "unlocked"
  const [errorMessage, setErrorMessage] = useState("");
  const [showPin, setShowPin] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Focus first input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs[0]?.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleVerify = useCallback((code) => {
    if (code === REQUIRED_PIN) {
      setStatus("unlocked");
      setErrorMessage("");
      try {
        sessionStorage.setItem("ctmo_security_gate_unlocked", "true");
      } catch (err) {
        // sessionStorage optional
      }
      setTimeout(() => {
        if (typeof onUnlock === "function") {
          onUnlock();
        }
      }, 550);
    } else {
      setStatus("error");
      setErrorMessage("Incorrect Security PIN. Authorized CTMO personnel only.");
      setPinDigits(["", "", "", ""]);
      setTimeout(() => {
        inputRefs[0]?.current?.focus();
      }, 50);
    }
  }, [onUnlock]);

  const updateDigit = (index, char) => {
    if (!/^\d?$/.test(char)) return;

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
    if (status === "unlocked") return;

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
            <span aria-hidden="true">&larr;</span> Return to Homepage
          </a>
          <ThemeToggle showLabel={false} />
        </div>

        <div className="admin-gate-header">
          <div className="admin-gate-logo-badge">
            <img src={ctmoShieldLogo} alt="CTMO shield" className="admin-gate-logo" />
          </div>

          <div className={`admin-gate-lock-icon ${status}`}>
            <MaterialIcon
              name={status === "unlocked" ? "lock_open" : "lock"}
              size={36}
            />
          </div>

          <span className="admin-gate-pill">RESTRICTED ACCESS</span>
          <h1 className="admin-gate-title">CTMO Security Gate</h1>
          <p className="admin-gate-subtitle">
            Enter the 4-digit security PIN to unlock the CTMO Admin portal
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
            className={`admin-gate-digits ${status === "error" ? "shake" : ""}`}
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
                className={`admin-gate-digit-input ${digit ? "filled" : ""} ${
                  status === "error" ? "is-error" : ""
                } ${status === "unlocked" ? "is-success" : ""}`}
                value={digit}
                onChange={(e) => updateDigit(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`Security PIN digit ${idx + 1}`}
                autoComplete="off"
                disabled={status === "unlocked"}
              />
            ))}
          </div>

          <div className="admin-gate-toggle-wrap">
            <button
              type="button"
              className="admin-gate-toggle-visibility"
              onClick={() => setShowPin((prev) => !prev)}
              aria-label={showPin ? "Hide PIN digits" : "Show PIN digits"}
            >
              <MaterialIcon name={showPin ? "visibility_off" : "visibility"} size={16} />
              <span>{showPin ? "Hide PIN" : "Show PIN"}</span>
            </button>
          </div>

          {errorMessage && (
            <div className="admin-gate-error" role="alert">
              <span aria-hidden="true">⚠️</span> {errorMessage}
            </div>
          )}

          {status === "unlocked" && (
            <div className="admin-gate-success" role="status">
              <span aria-hidden="true">✅</span> Access granted. Unlocking CTMO Login...
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
                disabled={status === "unlocked"}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="admin-gate-key admin-gate-key-action"
              onClick={() => handleKeypadPress("clear")}
              disabled={status === "unlocked"}
              aria-label="Clear all digits"
            >
              C
            </button>
            <button
              type="button"
              className="admin-gate-key"
              onClick={() => handleKeypadPress(0)}
              disabled={status === "unlocked"}
            >
              0
            </button>
            <button
              type="button"
              className="admin-gate-key admin-gate-key-action"
              onClick={() => handleKeypadPress("backspace")}
              disabled={status === "unlocked"}
              aria-label="Delete last digit"
            >
              ⌫
            </button>
          </div>

          <button
            type="submit"
            className="admin-gate-submit-btn"
            disabled={status === "unlocked" || pinDigits.some((d) => d === "")}
          >
            {status === "unlocked" ? "Unlocking..." : "Unlock CTMO Portal"}
          </button>
        </form>

        <div className="admin-gate-footer">
          <small>
            Protected by City Traffic Management Office • Surigao City
          </small>
        </div>
      </div>
    </div>
  );
}

