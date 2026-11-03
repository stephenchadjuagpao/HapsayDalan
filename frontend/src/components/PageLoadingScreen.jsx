import React, { useEffect, useState } from "react";
import shieldLogoImg from "../assets/ctmo-shield-logo-transparent.png";
import "./PageLoadingScreen.css";

export default function PageLoadingScreen({
  active = false,
  duration = 750,
  onComplete,
}) {
  const [visible, setVisible] = useState(active);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!active) {
      if (visible && !isExiting) {
        setIsExiting(true);
        const exitTimer = setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
        }, 200);
        return () => clearTimeout(exitTimer);
      }
      return;
    }

    setVisible(true);
    setIsExiting(false);

    const finishTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
        if (onComplete) onComplete();
      }, 200);
    }, duration);

    return () => clearTimeout(finishTimer);
  }, [active, duration, onComplete, visible, isExiting]);

  if (!visible) return null;

  return (
    <div
      className={`fez-loading-overlay ${isExiting ? "is-exiting" : "is-entering"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="fez-loading-wrapper">
        <div className="fez-spinner">
          <div className="fez-orbit-container" aria-hidden="true">
            <div className="fez-orbit-ring" />
            <div className="fez-orbit-ring" />
            <div className="fez-orbit-ring" />
          </div>
          <div className="fez-core">
            <img
              src={shieldLogoImg}
              alt="HapsayDalan Logo"
              className="fez-core-logo"
            />
          </div>
        </div>
        <div className="fez-loading-text">Loading...</div>
      </div>
    </div>
  );
}
