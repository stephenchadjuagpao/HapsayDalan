import MaterialIcon from "./MaterialIcon";
import "./ContactQuickActions.css";

const actions = [
  { label: "Facebook", icon: "facebook", href: "https://www.facebook.com/surigaoctmo/", external: true },
  { label: "Email CTMO", icon: "mail", href: "mailto:ctmo@surigaocity.gov.ph" },
  { label: "Call CTMO", icon: "phone", href: "tel:+63862319999" },
  { label: "Office Location", icon: "place", href: "https://www.google.com/maps/search/?api=1&query=Surigao%20City%20Traffic%20Management%20Office%2C%20City%20Hall%20Complex%2C%20Surigao%20City", external: true },
  { label: "Send Message", icon: "assignment", href: "#contact-form" },
];

export default function ContactQuickActions({ variant = "default", messageHref = "#contact-form" }) {
  return (
    <nav className={`contact-expand-links${variant === "footer" ? " contact-expand-links--footer" : ""}`} aria-label="Contact CTMO directly">
      {actions.map(({ label, icon, href, external }) => (
        <a key={label} className="contact-expand-link" href={href === "#contact-form" ? messageHref : href} aria-label={external ? `${label} (opens in a new tab)` : label}
          target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          <span className="contact-expand-icon" aria-hidden="true">
            {icon === "facebook" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46H15.2c-1.25 0-1.64.78-1.64 1.57V12h2.79l-.45 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" /></svg> :
            icon === "phone" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7 3 3 5-3 2a14 14 0 0 0 7 7l2-3 5 3v3a2 2 0 0 1-2 2C9 22 2 15 2 5a2 2 0 0 1 2-2h3Z" /></svg> : <MaterialIcon name={icon} size={22} />}
          </span>
          <span className="contact-expand-label">{label}</span>
        </a>
      ))}
    </nav>
  );
}
