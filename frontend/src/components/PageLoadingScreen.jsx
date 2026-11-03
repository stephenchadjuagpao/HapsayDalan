import React, { useEffect, useState } from "react";
import patrolTruckImg from "../assets/patrol-truck-clean.png";
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
        }, 180);
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
      }, 180);
    }, duration);

    return () => clearTimeout(finishTimer);
  }, [active, duration, onComplete, visible, isExiting]);

  if (!visible) return null;

  return (
    <div
      className={`hapsay-loader-overlay ${isExiting ? "is-exiting" : "is-entering"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="hapsay-circle-stage">
        {/* Ambient Center Glow */}
        <div className="hapsay-stage-glow" aria-hidden="true" />

        {/* Enhanced High-Tech Orbital Rings */}
        <div className="hapsay-orbit-outer-ring" aria-hidden="true" />
        <div className="hapsay-orbit-radar-sweep" aria-hidden="true" />
        <div className="hapsay-orbit-inner-dashed" aria-hidden="true" />

        {/* Center: Prominent, High-Resolution HapsayDalan Platform Logo */}
        <div className="hapsay-center-brand">
          <div className="hapsay-brand-lockup">
            <img
              src={shieldLogoImg}
              alt="HapsayDalan Platform Logo"
              className="hapsay-brand-shield"
            />
            <div className="hapsay-brand-text">
              <div className="hapsay-brand-name">
                <span className="brand-blue">Hapsay</span>
                <span className="brand-green">Dalan</span>
              </div>
              <div className="hapsay-brand-desc">
                City Road Violation Reporting Platform
              </div>
            </div>
          </div>
        </div>

        {/* Orbiting Toyota Hilux CTMO Patrol Truck (Scaled Down & Circling with Duyog) */}
        <div className="hapsay-orbit-track">
          <div className="hapsay-orbit-anchor">
            <div className="hapsay-truck-duyog-box">
              <img
                src={patrolTruckImg}
                alt="Toyota Hilux CTMO Patrol Truck"
                className="hapsay-orbiting-truck"
              />
              <div className="hapsay-truck-orbit-shadow" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
