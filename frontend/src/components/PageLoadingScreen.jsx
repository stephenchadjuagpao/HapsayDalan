import React, { useEffect, useRef, useState } from "react";
import shieldLogoImg from "../assets/ctmo-shield-logo-transparent.png";
import "./PageLoadingScreen.css";

export default function PageLoadingScreen({
  active = false,
  duration = 750,
  onComplete,
}) {
  const [visible, setVisible] = useState(active);
  const [isExiting, setIsExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let finishTimer;
    let exitTimer;
    const finish = (notify) => {
      setIsExiting(true);
      exitTimer = setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
        if (notify) onCompleteRef.current?.();
      }, 200);
    };
    if (active) {
      setVisible(true);
      setIsExiting(false);
      finishTimer = setTimeout(() => finish(true), duration);
    } else {
      finish(false);
    }

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(exitTimer);
    };
  }, [active, duration]);

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
