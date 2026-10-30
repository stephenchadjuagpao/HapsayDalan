import React from "react";
import useTheme from "../hooks/useTheme";
import "./ThemeToggle.css";

// Sun, clouds, moon, and stars adapted from the supplied FEZ theme toggle.
export default function ThemeToggle({ showLabel = false, className = "" }) {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return <label className={`theme-toggle ${className}`} title={`Switch to ${dark ? "light" : "dark"} mode`}>
    {showLabel && <span className="theme-toggle-label">Appearance<span>{dark ? "Dark mode" : "Light mode"}</span></span>}
    <span className="theme-toggle-control">
      <input type="checkbox" role="switch" aria-label="Dark mode" checked={dark}
        onChange={(event) => setTheme(event.target.checked ? "dark" : "light")} />
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-stars" /><span className="theme-toggle-shooting" />
        <span className="theme-toggle-clouds"><span /><span /></span>
        <span className="theme-toggle-orb"><i /><i /><i /></span>
      </span>
    </span>
  </label>;
}
