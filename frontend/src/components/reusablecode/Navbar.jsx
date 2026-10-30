import { useEffect, useRef, useState } from "react";
import NavIcon from "./NavIcon";
import ThemeToggle from "../ThemeToggle";
import logoSrc from "../../assets/ctmo-shield-logo-transparent.png";
import "./Navbar.css";


const NAV_LINKS = [
  { label: "Home", href: "/", page: "home" },
  { label: "Report a Violation", href: "/report", page: "report" },
  { label: "Track My Report", href: "/track", page: "track" },
  { label: "Hotspot Map", href: "/hotspot-map", page: "map" },
  { label: "How It Works", href: "/how-it-works", page: "how" },
  { label: "FAQs", href: "/faqs", page: "faqs" },
  { label: "Contact/Help", href: "/contact", page: "contact" },
  { label: "Admin/CTMO", href: "/admin-ctmo", page: "admin" },
];

export default function Navbar({ currentPage = "home" }) {
  const [activeLink, setActiveLink] = useState(currentPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef(null);
  const navigation = useRef(null);

  useEffect(() => setActiveLink(currentPage), [currentPage]);
  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width:901px)");
    const closeOnDesktop = (event) => { if (event.matches) setMenuOpen(false); };
    desktop?.addEventListener("change", closeOnDesktop);
    return () => desktop?.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") { setMenuOpen(false); toggle.current?.focus(); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const selectLink = (page) => { setActiveLink(page); setMenuOpen(false); };
  const resetMagnet = (event) => {
    event.currentTarget.style.removeProperty("--dock-x");
    event.currentTarget.style.removeProperty("--dock-y");
  };
  const moveMagnet = (event) => {
    if (event.pointerType !== "mouse" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--dock-x", `${(event.clientX - bounds.left - bounds.width / 2) * 0.1}px`);
    event.currentTarget.style.setProperty("--dock-y", `${(event.clientY - bounds.top - bounds.height / 2) * 0.1}px`);
  };
  const mobileLink = (link, secondary = false) => <a key={link.page} href={link.href}
    className={`sc-menu-link${activeLink === link.page ? " active" : ""}`}
    aria-current={activeLink === link.page ? "page" : undefined} onClick={() => selectLink(link.page)}>
    <span className="sc-menu-icon"><NavIcon name={link.page} /></span><span>{link.label}</span>
    {secondary ? <NavIcon name="arrow" /> : null}
  </a>;

  return <>
    {menuOpen ? <div className="sc-menu-backdrop" aria-hidden="true" onClick={() => {
      setMenuOpen(false); toggle.current?.focus();
    }} /> : null}
    <nav ref={navigation} className="sc-navbar" aria-label="Main navigation" onBlur={(event) => {
      if (event.relatedTarget && !navigation.current?.contains(event.relatedTarget)) setMenuOpen(false);
    }}>
      <div className="sc-navbar-inner">
        <a href="/" className="sc-logo" aria-label="HapsayDalan home">
          <img src={logoSrc} alt="HapsayDalan Logo" className="sc-logo-img" />
          <span className="sc-logo-text"><span className="sc-logo-title">
            <span className="sc-logo-title-blue">Hapsay</span><span className="sc-logo-title-green">Dalan</span>
          </span><span className="sc-logo-subtitle">City Road Violation Reporting Platform</span></span>
        </a>
        <ul className="sc-nav-links">{NAV_LINKS.map((link) => <li key={link.page}>
          <a href={link.href} className={activeLink === link.page ? "active" : ""} aria-label={link.label}
            aria-current={activeLink === link.page ? "page" : undefined} onClick={() => selectLink(link.page)}
            onPointerMove={moveMagnet} onPointerLeave={resetMagnet} onBlur={resetMagnet}>
            <NavIcon name={link.page} /><span className="sc-dock-label">{link.label}</span>
          </a>
        </li>)}</ul>
        <div className="sc-nav-actions"><ThemeToggle />
        <button ref={toggle} type="button" className="sc-hamburger" onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="sc-mobile-navigation">
          <NavIcon name={menuOpen ? "close" : "menu"} /><span>{menuOpen ? "Close" : "Menu"}</span>
        </button>
        </div>
      </div>
      <div id="sc-mobile-navigation" className={`sc-mobile-menu${menuOpen ? " open" : ""}`} hidden={!menuOpen}
        role="region" aria-labelledby="sc-menu-title">
        <div className="sc-menu-heading"><strong id="sc-menu-title">Explore HapsayDalan</strong><span>NAVIGATION</span></div>
        <div className="sc-menu-primary">{NAV_LINKS.slice(0, 4).map((link) => mobileLink(link))}</div>
        <div className="sc-menu-group-label">HELP & INFORMATION</div>
        <div className="sc-menu-secondary">{NAV_LINKS.slice(4, 7).map((link) => mobileLink(link, true))}</div>
        <div className="sc-menu-staff"><a href="/admin-ctmo" className={`sc-menu-link${activeLink === "admin" ? " active" : ""}`}
          aria-label="Admin/CTMO" aria-current={activeLink === "admin" ? "page" : undefined} onClick={() => selectLink("admin")}>
          <span className="sc-menu-icon"><NavIcon name="admin" /></span><span><strong>Admin/CTMO</strong><small>Authorized personnel</small></span><NavIcon name="arrow" />
        </a></div>
        <div className="sc-menu-theme"><ThemeToggle showLabel /></div>
      </div>
    </nav>
  </>;
}
