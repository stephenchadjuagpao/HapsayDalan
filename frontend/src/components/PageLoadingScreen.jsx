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
      <div className="hapsay-street-stage">
        {/* Soft Ambient Glow */}
        <div className="hapsay-street-glow" aria-hidden="true" />

        {/* Top: Prominent HapsayDalan Platform Logo */}
        <div className="hapsay-street-brand">
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

        {/* Bottom: Toyota Hilux CTMO Patrol Truck driving with "Duyog" along a Street Line */}
        <div className="hapsay-street-drive-scene">
          {/* Patrol Truck Chassis with authentic Suspension Duyog */}
          <div className="hapsay-street-truck-box">
            <img
              src={patrolTruckImg}
              alt="Toyota Hilux CTMO Patrol Truck"
              className="hapsay-street-truck"
            />
            {/* Dynamic Tire Ground Shadow */}
            <div className="hapsay-street-truck-shadow" aria-hidden="true" />
          </div>

          {/* Straight Street Line with moving highway stripes */}
          <div className="hapsay-street-road-line" aria-hidden="true">
            <div className="hapsay-street-asphalt">
              <div className="hapsay-street-dashes" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
