import React, { useEffect, useState } from "react";
import patrolTruckImg from "../assets/patrol-truck-clean.png";
import hapsayLogoImg from "../assets/hapsaydalan-logo-clean.png";
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
        {/* Subtle Circular Radar / Patrol Orbit Ring */}
        <div className="hapsay-orbit-ring" aria-hidden="true" />

        {/* Center: HapsayDalan Platform Logo */}
        <div className="hapsay-center-logo">
          <img
            src={hapsayLogoImg}
            alt="HapsayDalan Platform Logo"
            className="hapsay-logo-img"
          />
        </div>

        {/* Orbiting Toyota Hilux CTMO Patrol Truck with Duyog Motion */}
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
