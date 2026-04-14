import Navbar from "../components/reusablecode/Navbar";

// Inline map illustration (SVG-based, no external deps)
function MapIllustration() {
  return (
    <svg
      viewBox="0 0 560 420"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", maxHeight: 380 }}
    >
      {/* Background */}
      <rect width="560" height="420" fill="#f0f7f4" rx="12" />

      {/* Road grid - isometric-style */}
      {/* Horizontal main roads */}
      <rect x="0" y="155" width="560" height="42" fill="#f5c842" opacity="0.85" />
      <rect x="0" y="275" width="560" height="38" fill="#f5c842" opacity="0.75" />

      {/* Vertical main roads */}
      <rect x="200" y="0" width="44" height="420" fill="#f5c842" opacity="0.85" />
      <rect x="370" y="0" width="38" height="420" fill="#f5c842" opacity="0.75" />

      {/* City blocks */}
      <rect x="20" y="20" width="160" height="120" fill="#b2d8cc" rx="4" />
      <rect x="260" y="20" width="90" height="120" fill="#a8d5e2" rx="4" />
      <rect x="360" y="20" width="40" height="120" fill="none" />
      <rect x="420" y="20" width="120" height="120" fill="#b2d8cc" rx="4" />

      <rect x="20" y="215" width="160" height="45" fill="#a8d5e2" rx="4" />
      <rect x="260" y="215" width="90" height="45" fill="#b2d8cc" rx="4" />
      <rect x="420" y="215" width="120" height="45" fill="#a8d5e2" rx="4" />

      <rect x="20" y="330" width="160" height="75" fill="#b2d8cc" rx="4" />
      <rect x="260" y="330" width="90" height="75" fill="#a8d5e2" rx="4" />
      <rect x="420" y="330" width="120" height="75" fill="#b2d8cc" rx="4" />

      {/* Road lines / lane markers */}
      <line x1="0" y1="176" x2="560" y2="176" stroke="white" strokeWidth="1.5" strokeDasharray="14,10" opacity="0.6" />
      <line x1="222" y1="0" x2="222" y2="420" stroke="white" strokeWidth="1.5" strokeDasharray="14,10" opacity="0.6" />

      {/* Trees */}
      <circle cx="75" cy="75" r="10" fill="#52b788" />
      <circle cx="480" cy="370" r="9" fill="#52b788" />
      <circle cx="300" cy="370" r="8" fill="#52b788" />

      {/* Pin 1 - large orange */}
      <g transform="translate(222, 100)">
        <circle cx="0" cy="-22" r="16" fill="#e67e22" />
        <polygon points="-7,0 7,0 0,18" fill="#e67e22" />
        <circle cx="0" cy="-22" r="7" fill="white" />
      </g>

      {/* Pin 2 - medium orange */}
      <g transform="translate(390, 200)">
        <circle cx="0" cy="-20" r="14" fill="#e67e22" />
        <polygon points="-6,0 6,0 0,15" fill="#e67e22" />
        <circle cx="0" cy="-20" r="6" fill="white" />
      </g>

      {/* Pin 3 - smaller orange */}
      <g transform="translate(155, 260)">
        <circle cx="0" cy="-18" r="12" fill="#e67e22" />
        <polygon points="-5,0 5,0 0,14" fill="#e67e22" />
        <circle cx="0" cy="-18" r="5" fill="white" />
      </g>

      {/* Yellow accent line (top right, as seen in screenshot) */}
      <rect x="430" y="0" width="130" height="8" fill="#f5c842" rx="2" />
    </svg>
  );
}

export default function Homepage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .sc-homepage {
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          min-height: 100vh;
        }

        .sc-hero {
          max-width: 1280px;
          margin: 0 auto;
          padding: 64px 24px 80px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
        }

        .sc-hero-left {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sc-hero-title {
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 800;
          color: #111827;
          line-height: 1.15;
          letter-spacing: -0.5px;
        }

        .sc-hero-desc {
          font-size: 15px;
          color: #4b5563;
          line-height: 1.7;
          max-width: 480px;
        }

        .sc-hero-actions {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .sc-btn-primary {
          background: #1e3a5f;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 14px 28px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.18s ease, transform 0.12s ease;
          text-decoration: none;
          display: inline-block;
        }

        .sc-btn-primary:hover {
          background: #16304f;
          transform: translateY(-1px);
        }

        .sc-btn-secondary {
          background: transparent;
          color: #1e3a5f;
          border: 2px solid #1e3a5f;
          border-radius: 8px;
          padding: 13px 28px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.18s ease, transform 0.12s ease;
          text-decoration: none;
          display: inline-block;
        }

        .sc-btn-secondary:hover {
          background: #eef2f9;
          transform: translateY(-1px);
        }

        .sc-hero-right {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .sc-map-wrapper {
          width: 100%;
          max-width: 560px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(30, 58, 95, 0.12);
        }

        /* Yellow accent bar (top right) */
        .sc-accent-bar {
          position: absolute;
          top: -12px;
          right: -8px;
          width: 120px;
          height: 6px;
          background: #f5c842;
          border-radius: 3px;
        }

        @media (max-width: 768px) {
          .sc-hero {
            grid-template-columns: 1fr;
            padding: 40px 20px 60px;
            gap: 36px;
          }
          .sc-hero-right { order: -1; }
          .sc-accent-bar { display: none; }
        }

        /* How It Works */
        .sc-how {
          background: rgba(255, 255, 255, 0.58);
          backdrop-filter: blur(8px);
          padding: 74px 24px 68px;
          text-align: center;
        }
        .sc-section-title {
          font-size: 36px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 14px;
        }
        .sc-section-subtitle {
          font-size: 16px;
          color: #5b6472;
          margin-bottom: 52px;
        }
        .sc-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 72px;
          max-width: 1120px;
          margin: 0 auto;
        }
        .sc-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .sc-step-number {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #003D7F;
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sc-step-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
        }
        .sc-step-desc {
          font-size: 16px;
          color: #5b6472;
          line-height: 1.5;
          max-width: 340px;
        }

        /* Benefits */
        .sc-benefits {
          background: rgba(255, 255, 255, 0.6);
          padding: 36px 24px 72px;
        }
        .sc-benefit-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          max-width: 1220px;
          margin: 0 auto;
        }
        .sc-benefit-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #d9dee6;
          padding: 22px 28px 24px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .sc-benefit-icon { font-size: 40px; line-height: 1; }
        .sc-benefit-title { font-size: 20px; font-weight: 700; color: #111827; }
        .sc-benefit-desc { font-size: 16px; color: #5b6472; line-height: 1.5; max-width: 320px; }

        /* CTA Banner */
        .sc-cta {
          background: #1e3a5f;
          padding: 72px 24px;
          text-align: center;
        }
        .sc-cta-title { font-size: 30px; font-weight: 800; color: #fff; margin-bottom: 16px; }
        .sc-cta-desc { font-size: 15px; color: #b8c8e0; line-height: 1.7; max-width: 560px; margin: 0 auto 32px; }
        .sc-btn-white {
          background: #fff;
          color: #1e3a5f;
          border: none;
          border-radius: 8px;
          padding: 14px 32px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          text-decoration: none;
          display: inline-block;
          transition: background 0.18s, transform 0.12s;
        }
        .sc-btn-white:hover { background: #e8edf5; transform: translateY(-1px); }

        /* Community Impact */
        .sc-impact {
          background: rgba(255, 255, 255, 0.68);
          padding: 72px 24px 96px;
          text-align: center;
        }
        .sc-impact-title {
          font-size: 34px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 44px;
        }
        .sc-impact-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        .sc-impact-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sc-impact-value {
          font-size: 42px;
          font-weight: 800;
          line-height: 1;
          color: #0b4f99;
        }
        .sc-impact-label {
          font-size: 15px;
          color: #4b5563;
        }

        /* Footer */
        .sc-footer {
          background: #003D7F;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }
        .sc-footer-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }
        .sc-footer-col-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 14px; }
        .sc-footer-about { line-height: 1.7; }
        .sc-footer-links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .sc-footer-links li a { color: #b8c8e0; text-decoration: none; transition: color 0.15s; }
        .sc-footer-links li a:hover { color: #fff; }
        .sc-footer-contact { line-height: 1.9; }
        .sc-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 900px) {
          .sc-steps, .sc-benefit-cards { grid-template-columns: 1fr; max-width: 400px; }
          .sc-impact-grid { grid-template-columns: 1fr; gap: 28px; }
          .sc-footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .sc-footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="sc-homepage">
        <Navbar />

        {/* Hero Section */}
        <section className="sc-hero" id="home">
          <div className="sc-hero-left">
            <h1 className="sc-hero-title">
              Report Road &amp; Traffic Violations in Surigao City
            </h1>
            <p className="sc-hero-desc">
              Citizens submit reports with photo/video evidence, violation type,
              description, plate number (optional), date/time, and GPS/map pin to help
              achieve faster CTMO response.
            </p>
            <div className="sc-hero-actions">
              <a href="/report" className="sc-btn-primary">Report a Violation</a>
              <a href="/track" className="sc-btn-secondary">Track My Report</a>
            </div>
          </div>

          <div className="sc-hero-right">
            <div className="sc-accent-bar" />
            <div className="sc-map-wrapper">
              <MapIllustration />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="sc-how" id="how">
          <h2 className="sc-section-title">How It Works</h2>
          <p className="sc-section-subtitle">Three simple steps to report and track violations</p>
          <div className="sc-steps">
            <div className="sc-step">
              <div className="sc-step-number">1</div>
              <div className="sc-step-title">Submit Report</div>
              <p className="sc-step-desc">Upload photo/video evidence, provide violation details, and mark location on map.</p>
            </div>
            <div className="sc-step">
              <div className="sc-step-number">2</div>
              <div className="sc-step-title">CTMO Reviews</div>
              <p className="sc-step-desc">Our team verifies your report and assigns it to the appropriate officer.</p>
            </div>
            <div className="sc-step">
              <div className="sc-step-number">3</div>
              <div className="sc-step-title">Action &amp; Feedback</div>
              <p className="sc-step-desc">Track progress and receive updates as your case is resolved.</p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="sc-benefits">
          <div className="sc-benefit-cards">
            <div className="sc-benefit-card">
              <span className="sc-benefit-icon">⚡</span>
              <div className="sc-benefit-title">Faster Response</div>
              <p className="sc-benefit-desc">Reduced response times through streamlined verification and case assignment.</p>
            </div>
            <div className="sc-benefit-card">
              <span className="sc-benefit-icon">🔒</span>
              <div className="sc-benefit-title">Secure Storage</div>
              <p className="sc-benefit-desc">Your data is stored securely in our online database with privacy protection.</p>
            </div>
            <div className="sc-benefit-card">
              <span className="sc-benefit-icon">👥</span>
              <div className="sc-benefit-title">Community Action</div>
              <p className="sc-benefit-desc">Together, we keep Surigao City's roads safe for everyone.</p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="sc-cta">
          <h2 className="sc-cta-title">Help Keep Our City Safe</h2>
          <p className="sc-cta-desc">
            Report violations today and be part of the solution. Your contribution helps make Surigao City's roads safer for everyone.
          </p>
          <a href="/report" className="sc-btn-white">Get Started Now</a>
        </section>

        <section className="sc-impact" aria-labelledby="community-impact-title">
          <h2 className="sc-impact-title" id="community-impact-title">Community Impact</h2>
          <div className="sc-impact-grid">
            <div className="sc-impact-stat">
              <div className="sc-impact-value">2,450+</div>
              <div className="sc-impact-label">Reports Submitted</div>
            </div>
            <div className="sc-impact-stat">
              <div className="sc-impact-value">1,850+</div>
              <div className="sc-impact-label">Cases Resolved</div>
            </div>
            <div className="sc-impact-stat">
              <div className="sc-impact-value">24hrs</div>
              <div className="sc-impact-label">Average Response Time</div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="sc-footer">
          <div className="sc-footer-grid">
            <div>
              <div className="sc-footer-col-title">About</div>
              <p className="sc-footer-about">Together, we keep Surigao City's roads safe. Report violations and help achieve faster CTMO response.</p>
            </div>
            <div>
              <div className="sc-footer-col-title">Quick Links</div>
              <ul className="sc-footer-links">
                <li><a href="#home">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="sc-footer-col-title">Support</div>
              <ul className="sc-footer-links">
                <li><a href="#faqs">FAQs</a></li>
                <li><a href="#contact">Contact/Help</a></li>
                <li><a href="#privacy">Privacy Policy</a></li>
                <li><a href="#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="sc-footer-col-title">Contact CTMO</div>
              <p className="sc-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM – 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="sc-footer-bottom">
            <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
          </div>
        </footer>

      </div>
    </>
  );
}
