import React, { useEffect, useState, useMemo } from "react";
import loadingCarImg from "../assets/loading-car.png";
import "./PageLoadingScreen.css";

const ROUTE_LABELS = {
  "/": "Nagkarga sa Panid sa Panimalay...",
  "/report": "Nag-andam sa Violation Report Form...",
  "/track": "Nagkarga sa Report Tracking...",
  "/hotspot-map": "Nagkarga sa Community Hotspot Map...",
  "/how-it-works": "Nagkarga sa Giya sa Pagreport...",
  "/faqs": "Nagkarga sa mga Kanunayng Gipangutana...",
  "/contact": "Nagkarga sa Tabang ug Suporta...",
  "/admin-ctmo": "Nag-andam sa CTMO Portal...",
  "/admin": "Nagkarga sa CTMO Admin Dashboard...",
  "/admin-dashboard": "Nagkarga sa CTMO Admin Dashboard...",
};

export default function PageLoadingScreen({
  active = false,
  targetPath = "",
  duration = 750,
  onComplete,
}) {
  const [visible, setVisible] = useState(active);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(15);

  const statusMessage = useMemo(() => {
    if (targetPath && ROUTE_LABELS[targetPath]) {
      return ROUTE_LABELS[targetPath];
    }
    return "Nagkarga sa HapsayDalan...";
  }, [targetPath]);

  useEffect(() => {
    if (!active) {
      if (visible && !isExiting) {
        setIsExiting(true);
        const exitTimer = setTimeout(() => {
          setVisible(false);
          setIsExiting(false);
          setProgress(15);
        }, 220);
        return () => clearTimeout(exitTimer);
      }
      return;
    }

    setVisible(true);
    setIsExiting(false);
    setProgress(20);

    const step1 = setTimeout(() => setProgress(65), duration * 0.35);
    const step2 = setTimeout(() => setProgress(95), duration * 0.7);
    const finish = setTimeout(() => {
      setProgress(100);
      setIsExiting(true);
      setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
        if (onComplete) onComplete();
      }, 220);
    }, duration);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(finish);
    };
  }, [active, duration, onComplete, visible, isExiting]);

  if (!visible) return null;

  return (
    <div
      className={`hapsay-loader-backdrop ${isExiting ? "is-exiting" : "is-entering"}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="hapsay-loader-card">
        {/* Ambient Glow Elements */}
        <div className="hapsay-loader-ambient-glow" aria-hidden="true" />

        {/* Speed Wind / Road Streak Effects */}
        <div className="hapsay-speed-streaks" aria-hidden="true">
          <span className="speed-streak streak-1" />
          <span className="speed-streak streak-2" />
          <span className="speed-streak streak-3" />
          <span className="speed-streak streak-4" />
        </div>

        {/* Vehicle Motion Scene */}
        <div className="hapsay-vehicle-scene">
          {/* Emergency Roof Siren Beacon Flares */}
          <div className="hapsay-siren-flares" aria-hidden="true">
            <span className="siren-beacon siren-red" />
            <span className="siren-beacon siren-blue" />
          </div>

          {/* Vehicle Body with 'Duyog' (Road Suspension Bounce & Rumble) */}
          <div className="hapsay-vehicle-chassis">
            <img
              src={loadingCarImg}
              alt="HapsayDalan CTMO Patrol Vehicle"
              className="hapsay-vehicle-image"
            />
          </div>

          {/* Dynamic Road Track with Moving Stripes */}
          <div className="hapsay-road-stage" aria-hidden="true">
            <div className="hapsay-vehicle-shadow" />
            <div className="hapsay-road-asphalt">
              <div className="hapsay-road-dashes" />
            </div>
          </div>
        </div>

        {/* Status Copy & Progress Bar */}
        <div className="hapsay-loader-info">
          <div className="hapsay-loader-status-row">
            <span className="hapsay-pulse-dot" aria-hidden="true" />
            <span className="hapsay-loader-status-text">{statusMessage}</span>
          </div>

          {/* High-Tech Shimmering Progress Bar */}
          <div className="hapsay-loader-progress-track">
            <div
              className="hapsay-loader-progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="hapsay-loader-progress-light" />
            </div>
          </div>

          <p className="hapsay-loader-tagline">
            Surigao City • City Traffic Management Office
          </p>
        </div>
      </div>
    </div>
  );
}
