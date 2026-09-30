import { useEffect } from "react";
import Navbar from "../components/reusablecode/Navbar";
import HelpForm from "../components/HelpForm";

const QUICK_HELP_ITEMS = [
  {
    icon: "📝",
    title: "Report a Violation",
    text: "Submit a new violation report",
    href: "/report",
  },
  {
    icon: "📍",
    title: "Track My Report",
    text: "Check status with reference ID",
    href: "/track",
  },
  {
    icon: "❓",
    title: "FAQs",
    text: "Common questions answered",
    href: "/faqs",
  },
  {
    icon: "⚙️",
    title: "How It Works",
    text: "Learn about our process",
    href: "/how-it-works",
  },
];

const RESOURCE_ITEMS = [
  {
    icon: "📚",
    title: "Traffic Rules",
    text: "Understand local traffic rules and regulations.",
    href: "/faqs",
  },
  {
    icon: "🛣️",
    title: "Road Safety",
    text: "Tips for safe driving and road awareness.",
    href: "/hotspot-map",
  },
  {
    icon: "📋",
    title: "Policies",
    text: "Privacy policy and terms of service.",
    href: "/faqs",
  },
];

export default function ContactHelpPage() {
  useEffect(() => {
    document.title = "HapsayDalan | Contact & Support";
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .contact-page {
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          color: #111827;
        }

        .contact-hero {
          padding: 72px 24px 58px;
          background: linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .contact-hero-inner,
        .contact-section-inner,
        .contact-footer-grid,
        .contact-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
        }

        .contact-hero-copy {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }

        .contact-hero-title {
          margin: 0 0 16px;
          font-size: clamp(38px, 5vw, 54px);
          line-height: 1.08;
          font-weight: 800;
          color: #111827;
        }

        .contact-hero-text {
          margin: 0;
          font-size: 18px;
          line-height: 1.65;
          color: #5f6b7a;
        }

        .contact-section {
          padding: 58px 24px;
        }

        .contact-section-muted {
          padding: 58px 24px;
          background: rgba(255, 255, 255, 0.58);
          backdrop-filter: blur(8px);
        }

        .contact-grid {
          max-width: 980px;
          margin: 0 auto 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
        }

        .contact-card,
        .contact-resource-card,
        .help-form-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 24px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
        }

        .contact-card {
          padding: 30px;
        }

        .contact-card-title {
          margin: 0 0 24px;
          font-size: 28px;
          font-weight: 800;
          color: #111827;
        }

        .contact-info-stack {
          display: grid;
          gap: 24px;
        }

        .contact-info-label {
          margin: 0 0 6px;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #758196;
        }

        .contact-info-value {
          margin: 0;
          color: #111827;
          line-height: 1.7;
        }

        .contact-info-link {
          font-size: 22px;
          font-weight: 800;
          color: #003d7f;
          text-decoration: none;
        }

        .contact-info-link:hover {
          text-decoration: underline;
        }

        .contact-hours {
          padding-top: 24px;
          border-top: 1px solid #e6ebf5;
        }

        .contact-hours p {
          margin: 0 0 8px;
          color: #111827;
          line-height: 1.7;
        }

        .contact-quick-links {
          display: grid;
          gap: 14px;
        }

        .contact-quick-link {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          border-radius: 18px;
          text-decoration: none;
          transition: background 0.18s ease, transform 0.18s ease;
        }

        .contact-quick-link:hover {
          background: rgba(241, 245, 255, 0.9);
          transform: translateY(-1px);
        }

        .contact-quick-icon {
          font-size: 28px;
          line-height: 1;
          flex-shrink: 0;
        }

        .contact-quick-title {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        .contact-quick-text {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .help-form-card {
          max-width: 980px;
          margin: 0 auto;
          padding: 30px;
        }

        .help-form-intro {
          margin-bottom: 26px;
        }

        .help-form-title {
          margin: 0 0 12px;
          font-size: 32px;
          font-weight: 800;
          color: #111827;
        }

        .help-form-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .help-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px 20px;
        }

        .help-form-row {
          display: grid;
          gap: 8px;
        }

        .help-form-row-full,
        .help-form-actions {
          grid-column: 1 / -1;
        }

        .help-form-label {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        .help-form-input,
        .help-form-textarea {
          width: 100%;
          border: 1px solid #d8e0ef;
          border-radius: 14px;
          background: #ffffff;
          color: #111827;
          font-size: 15px;
          padding: 14px 16px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .help-form-input:focus,
        .help-form-textarea:focus {
          border-color: #7b97d9;
          box-shadow: 0 0 0 4px rgba(26, 79, 160, 0.08);
        }

        .help-form-textarea {
          min-height: 150px;
          resize: vertical;
          font-family: inherit;
        }

        .help-form-submit {
          min-width: 170px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #003d7f 0%, #245ebe 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          padding: 14px 26px;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .help-form-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 22px rgba(22, 58, 132, 0.22);
        }

        .help-form-success {
          margin-top: 14px;
          font-size: 14px;
          color: #0f6f3e;
          font-weight: 600;
        }

        .contact-emergency-wrap {
          max-width: 980px;
          margin: 0 auto;
          border-left: 4px solid #dc2626;
          background: #fef2f2;
          border-radius: 0 22px 22px 0;
          padding: 0;
        }

        .contact-emergency-card {
          background: rgba(255, 255, 255, 0.97);
          border: 1px solid #fecaca;
          border-left: 0;
          border-radius: 0 22px 22px 0;
          padding: 28px 30px;
          display: flex;
          gap: 18px;
          align-items: flex-start;
          box-shadow: 0 14px 30px rgba(147, 60, 60, 0.08);
        }

        .contact-emergency-icon {
          font-size: 34px;
          line-height: 1;
          flex-shrink: 0;
        }

        .contact-emergency-title {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 800;
          color: #111827;
        }

        .contact-emergency-text {
          margin: 0 0 14px;
          color: #5f6b7a;
          line-height: 1.7;
        }

        .contact-emergency-call {
          margin: 0 0 8px;
          color: #dc2626;
          font-size: 20px;
          font-weight: 800;
        }

        .contact-emergency-note {
          margin: 0;
          color: #5f6b7a;
          line-height: 1.7;
        }

        .contact-section-title {
          margin: 0 0 30px;
          text-align: center;
          font-size: 34px;
          font-weight: 800;
          color: #111827;
        }

        .contact-resources {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
        }

        .contact-resource-card {
          padding: 28px 24px;
          text-align: center;
        }

        .contact-resource-icon {
          font-size: 34px;
          margin-bottom: 14px;
        }

        .contact-resource-title {
          margin: 0 0 10px;
          font-size: 20px;
          font-weight: 800;
          color: #111827;
        }

        .contact-resource-text {
          margin: 0 0 18px;
          font-size: 14px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .contact-resource-link {
          color: #003d7f;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .contact-resource-link:hover {
          text-decoration: underline;
        }

        .contact-feedback {
          background:
            radial-gradient(circle at 18% 22%, rgba(214, 222, 235, 0.12) 0, transparent 22%),
            radial-gradient(circle at 80% 74%, rgba(214, 224, 239, 0.1) 0, transparent 24%),
            linear-gradient(180deg, #f3f5f8 0%, #edf1f6 50%, #f3f5f8 100%);
          color: #111827;
          padding: 58px 24px;
        }

        .contact-feedback-inner {
          max-width: 720px;
          margin: 0 auto;
          text-align: center;
        }

        .contact-feedback-title {
          margin: 0 0 12px;
          font-size: 34px;
          font-weight: 800;
          color: #111827;
        }

        .contact-feedback-text {
          margin: 0 0 24px;
          font-size: 16px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .contact-feedback-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 180px;
          padding: 14px 26px;
          border-radius: 12px;
          background: #003d7f;
          color: #ffffff;
          text-decoration: none;
          font-weight: 700;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .contact-feedback-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(10, 31, 82, 0.1);
        }

        .contact-footer-spacer {
          height: 60px;
          background: #ffffff;
        }

        .contact-footer {
          background: #003d7f;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .contact-footer-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .contact-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .contact-footer-about,
        .contact-footer-contact {
          line-height: 1.8;
        }

        .contact-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .contact-footer-links a {
          color: #b8c8e0;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .contact-footer-links a:hover {
          color: #fff;
        }

        .contact-footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 980px) {
          .contact-grid,
          .contact-resources,
          .help-form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .contact-footer-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .contact-hero {
            padding: 56px 20px 48px;
          }

          .contact-section,
          .contact-section-muted,
          .contact-feedback,
          .contact-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .contact-card,
          .help-form-card,
          .contact-resource-card {
            padding: 24px 20px;
          }

          .contact-card-title,
          .help-form-title,
          .contact-section-title,
          .contact-feedback-title {
            font-size: 28px;
          }

          .contact-info-link {
            font-size: 18px;
            word-break: break-word;
          }

          .contact-emergency-card {
            padding: 24px 20px;
            border-radius: 0 18px 18px 0;
          }

          .contact-footer-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
        }
      `}</style>

      <div className="contact-page">
        <Navbar currentPage="contact" />

        <header className="contact-hero">
          <div className="contact-hero-inner">
            <div className="contact-hero-copy">
              <h1 className="contact-hero-title">Contact & Support</h1>
              <p className="contact-hero-text">
                We're here to help. Get in touch with the Surigao City Traffic Management Office
                for any questions or concerns.
              </p>
            </div>
          </div>
        </header>

        <section className="contact-section">
          <div className="contact-section-inner">
            <div className="contact-grid">
              <div className="contact-card">
                <h2 className="contact-card-title">Direct Contact</h2>

                <div className="contact-info-stack">
                  <div>
                    <p className="contact-info-label">Office Location</p>
                    <p className="contact-info-value">
                      <strong>Surigao City Traffic Management Office</strong>
                      <br />
                      City Hall Complex, Surigao City
                    </p>
                  </div>

                  <div>
                    <p className="contact-info-label">Phone</p>
                    <a href="tel:+63862319999" className="contact-info-link">
                      (086) 231-9999
                    </a>
                  </div>

                  <div>
                    <p className="contact-info-label">Email</p>
                    <a href="mailto:ctmo@surigaocity.gov.ph" className="contact-info-link">
                      ctmo@surigaocity.gov.ph
                    </a>
                  </div>

                  <div className="contact-hours">
                    <p className="contact-info-label">Office Hours</p>
                    <p>
                      <strong>Monday - Friday:</strong> 8:00 AM - 5:00 PM
                    </p>
                    <p>
                      <strong>Saturday:</strong> 9:00 AM - 12:00 PM
                    </p>
                    <p>
                      <strong>Sunday & Holidays:</strong> Closed
                    </p>
                  </div>
                </div>
              </div>

              <div className="contact-card">
                <h2 className="contact-card-title">Quick Help</h2>

                <div className="contact-quick-links">
                  {QUICK_HELP_ITEMS.map((item) => (
                    <a key={item.title} href={item.href} className="contact-quick-link">
                      <span className="contact-quick-icon">{item.icon}</span>
                      <div>
                        <p className="contact-quick-title">{item.title}</p>
                        <p className="contact-quick-text">{item.text}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact-form" className="contact-section-muted">
          <div className="contact-section-inner">
            <HelpForm />
          </div>
        </section>

        <section className="contact-section">
          <div className="contact-section-inner">
            <div className="contact-emergency-wrap">
              <div className="contact-emergency-card">
                <div className="contact-emergency-icon">🚨</div>
                <div>
                  <h2 className="contact-emergency-title">Emergency Situations</h2>
                  <p className="contact-emergency-text">
                    If you witness an immediate traffic safety hazard or dangerous situation:
                  </p>
                  <p className="contact-emergency-call">Call 911 or Emergency Services Hotline</p>
                  <p className="contact-emergency-note">
                    Report the situation immediately. Our online reporting system is for
                    non-emergency violations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="contact-section">
          <div className="contact-section-inner">
            <h2 className="contact-section-title">Additional Resources</h2>
            <div className="contact-resources">
              {RESOURCE_ITEMS.map((item) => (
                <div key={item.title} className="contact-resource-card">
                  <div className="contact-resource-icon">{item.icon}</div>
                  <h3 className="contact-resource-title">{item.title}</h3>
                  <p className="contact-resource-text">{item.text}</p>
                  <a href={item.href} className="contact-resource-link">
                    Learn more →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="contact-feedback">
          <div className="contact-feedback-inner">
            <h2 className="contact-feedback-title">Help Us Improve</h2>
            <p className="contact-feedback-text">
              Have feedback about our system? We'd love to hear from you. Your input helps us serve
              you better.
            </p>
            <a href="#contact-form" className="contact-feedback-link">
              Send Feedback
            </a>
          </div>
        </section>

        <div className="contact-footer-spacer" />

        <footer className="contact-footer">
          <div className="contact-footer-grid">
            <div>
              <div className="contact-footer-col-title">About</div>
              <p className="contact-footer-about">
                HapsayDalan helps keep Surigao City's roads safe by making traffic violation
                reporting faster, clearer, and easier for the community.
              </p>
            </div>
            <div>
              <div className="contact-footer-col-title">Quick Links</div>
              <ul className="contact-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="contact-footer-col-title">Support</div>
              <ul className="contact-footer-links">
                <li><a href="/faqs">FAQs</a></li>
                <li><a href="/contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="contact-footer-col-title">Contact CTMO</div>
              <p className="contact-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="contact-footer-bottom">© 2026 HapsayDalan. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
