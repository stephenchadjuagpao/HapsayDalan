import React, { useEffect, useState } from "react";
import patrolTruckImg from "../assets/patrol-truck-clean.png";
import hapsayLogoImg from "../assets/hapsaydalan-logo-clean.png";
import "./PageLoadingScreen.css";

export default function PageLoadingScreen({
  active = false,
  duration = 680,
  onComplete,
}) {
  const [visible, setVisible] = useState(active);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    if (!active) {
      if (visible && !isExiting) {
        setIsExiting(true);
        const exitTimer = setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
          setProgress(25);
        }, 180);
        return () => clearTimeout(exitTimer);
      }
      return;
    }

    setVisible(true);
    setIsExiting(false);
    setProgress(30);

    const step1 = setTimeout(() => setProgress(75), duration * 0.45);
    const finish = setTimeout(() => {
      setProgress(100);
      setIsExiting(true);
      setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
        if (onComplete) onComplete();
      }, 180);
    }, duration);

    return () => {
      clearTimeout(step1);
      clearTimeout(finish);
    };
  }, [active, duration, onComplete, visible, isExiting]);

  if (!visible) return null;

  return (
    <div
      className={`hapsay-loader-overlay ${isExiting ? "is-exiting" : "is-entering"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="hapsay-loader-wrap">
        {/* Combined Hero: Patrol Truck (Duyog Motion) + HapsayDalan Platform Logo */}
        <div className="hapsay-brand-combo">
          <div className="hapsay-truck-wrapper">
            <img
              src={patrolTruckImg}
              alt="Toyota Hilux CTMO Patrol Truck"
              className="hapsay-patrol-truck"
            />
            <div className="hapsay-truck-shadow" aria-hidden="true" />
          </div>

          <div className="hapsay-logo-wrapper">
            <img
              src={hapsayLogoImg}
              alt="HapsayDalan Platform Logo"
              className="hapsay-platform-logo"
            />
          </div>
        </div>

        {/* Minimalist Slim Progress Line */}
        <div className="hapsay-minimal-progress" aria-hidden="true">
          <div
            className="hapsay-progress-indicator"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
