import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", href: "#home", active: true },
  { label: "Report a Violation", href: "#report" },
  { label: "Track My Report", href: "#track" },
  { label: "Hotspot Map", href: "#map" },
  { label: "How It Works", href: "#how" },
  { label: "FAQs", href: "#faqs" },
  { label: "Contact/Help", href: "#contact" },
  { label: "Admin/CTMO", href: "#admin" },
];

export default function Navbar() {
  const [activeLink, setActiveLink] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .sc-navbar {
          font-family: 'Inter', sans-serif;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 1000;
          width: 100%;
        }

        .sc-navbar-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sc-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .sc-logo-icon {
          width: 40px;
          height: 40px;
          background: #1e3a5f;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .sc-logo-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .sc-logo-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e3a5f;
        }

        .sc-logo-subtitle {
          font-size: 11px;
          font-weight: 400;
          color: #6b7280;
        }

        .sc-nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .sc-nav-links li a {
          display: block;
          padding: 6px 12px;
          font-size: 13.5px;
          font-weight: 400;
          color: #374151;
          text-decoration: none;
          border-radius: 6px;
          transition: background 0.15s ease, color 0.15s ease;
          white-space: nowrap;
        }

        .sc-nav-links li a:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .sc-nav-links li a.active {
          background: #e8edf5;
          color: #1e3a5f;
          font-weight: 500;
          border: 1px solid #c7d2e8;
        }

        .sc-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          cursor: pointer;
          padding: 4px;
          background: none;
          border: none;
        }

        .sc-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: #374151;
          border-radius: 2px;
          transition: all 0.2s;
        }

        .sc-mobile-menu {
          display: none;
          flex-direction: column;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
          padding: 8px 16px 16px;
        }

        .sc-mobile-menu.open {
          display: flex;
        }

        .sc-mobile-menu a {
          padding: 10px 12px;
          font-size: 14px;
          color: #374151;
          text-decoration: none;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }

        .sc-mobile-menu a:hover,
        .sc-mobile-menu a.active {
          background: #e8edf5;
          color: #1e3a5f;
          font-weight: 500;
        }

        @media (max-width: 1024px) {
          .sc-nav-links {
            display: none;
          }
          .sc-hamburger {
            display: flex;
          }
        }
      `}</style>

      <nav className="sc-navbar">
        <div className="sc-navbar-inner">
          {/* Logo */}
          <a href="#home" className="sc-logo">
            <div className="sc-logo-icon">SC</div>
            <div className="sc-logo-text">
              <span className="sc-logo-title">Surigao City</span>
              <span className="sc-logo-subtitle">Traffic Reports</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <ul className="sc-nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className={activeLink === link.label ? "active" : ""}
                  onClick={() => setActiveLink(link.label)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Hamburger */}
          <button
            className="sc-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`sc-mobile-menu ${menuOpen ? "open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={activeLink === link.label ? "active" : ""}
              onClick={() => {
                setActiveLink(link.label);
                setMenuOpen(false);
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}