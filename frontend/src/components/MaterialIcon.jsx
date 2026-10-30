import React from "react";
import materialIcons from "./materialIconPaths";
import "./MaterialIcon.css";

export default function MaterialIcon({ name, className = "", size = 20, title }) {
  return <svg className={`material-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"
    aria-hidden={title ? undefined : true} role={title ? "img" : undefined} aria-label={title} focusable="false">
    {materialIcons[name] || materialIcons.help_outline}
  </svg>;
}
