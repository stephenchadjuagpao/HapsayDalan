import MaterialIcon from "./MaterialIcon";

const names = { menu: "menu", close: "close", home: "home", logout: "logout", overview: "dashboard",
  reports: "assignment", officers: "local_police", analytics: "assessment", map: "map", arrow: "arrow_forward",
  check: "check", clock: "schedule", flag: "flag", download: "file_download", bell: "notifications",
  refresh: "refresh", shield: "verified_user" };

export default function AdminIcon({ name, className = "" }) {
  return <MaterialIcon name={names[name] || "assignment"} className={`admin-icon ${className}`} />;
}