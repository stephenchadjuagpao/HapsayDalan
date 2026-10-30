import MaterialIcon from "../MaterialIcon";

const names = { home: "home", report: "assignment", track: "search", map: "map", how: "settings",
  faqs: "help_outline", contact: "headset_mic", admin: "verified_user", arrow: "chevron_right", menu: "menu", close: "close" };

export default function NavIcon({ name, className = "" }) {
  return <MaterialIcon name={names[name] || "home"} className={`sc-nav-icon ${className}`} />;
}