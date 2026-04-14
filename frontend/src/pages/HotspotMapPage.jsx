import React from "react";
import Navbar from "../components/reusablecode/Navbar";
import HotspotMap from "../components/HotspotMap";

export default function HotspotMapPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .hotspot-page {
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          min-height: 100vh;
        }

        .hotspot-hero {
          padding: 74px 24px 54px;
          text-align: center;
          background: linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .hotspot-hero-inner,
        .hotspot-section-inner,
        .hotspot-footer-grid,
        .hotspot-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
        }

        .hotspot-hero-inner {
          max-width: 760px;
        }

        .hotspot-hero-title {
          margin: 0 0 16px;
          font-size: clamp(38px, 5vw, 54px);
          line-height: 1.08;
          font-weight: 800;
          color: #111827;
        }

        .hotspot-hero-text {
          margin: 0;
          font-size: 18px;
          line-height: 1.65;
          color: #5f6b7a;
        }

        .hotspot-section {
          padding: 12px 24px 64px;
        }

        .hotspot-muted-section {
          background: rgba(255, 255, 255, 0.62);
          backdrop-filter: blur(8px);
          padding: 64px 24px;
        }

        .hotspot-grid-two,
        .hotspot-grid-three {
          display: grid;
          gap: 28px;
        }

        .hotspot-grid-two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 960px;
          margin: 0 auto;
          gap: 0;
        }

        .hotspot-grid-three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          max-width: 980px;
          margin: 0 auto;
        }

        .hotspot-info-title,
        .hotspot-impact-title {
          margin: 0 0 18px;
          color: #111827;
          font-size: 28px;
          font-weight: 800;
          text-align: center;
        }

        .hotspot-impact-text {
          max-width: 680px;
          margin: 0 auto 36px;
          text-align: center;
          font-size: 16px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .hotspot-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 18px;
          padding: 18px 16px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
        }

        .hotspot-card h3 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          line-height: 1.25;
        }

        .hotspot-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }

        .hotspot-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 13px;
          line-height: 1.62;
          color: #5f6b7a;
        }

        .hotspot-list li span:last-child {
          flex: 1;
          min-width: 0;
        }

        .hotspot-list-number {
          color: #0f4c97;
          font-weight: 800;
          flex-shrink: 0;
          width: 16px;
          display: inline-flex;
          justify-content: center;
          margin-top: 1px;
        }

        .hotspot-list-icon {
          flex-shrink: 0;
          width: 16px;
          display: inline-flex;
          justify-content: center;
          margin-top: 3px;
        }

        .hotspot-list-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
        }

        .hotspot-list-dot-marker {
          background: #f97316;
        }

        .hotspot-list-dot-high {
          background: #ef4444;
        }

        .hotspot-list-dot-medium {
          background: #facc15;
        }

        .hotspot-list-dot-low {
          background: #3b82f6;
        }

        .hotspot-impact-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
        }

        .hotspot-impact-card-title {
          margin: 0 0 10px;
          color: #111827;
          font-size: 20px;
          font-weight: 800;
        }

        .hotspot-impact-card-text {
          margin: 0;
          color: #5f6b7a;
          font-size: 14px;
          line-height: 1.7;
        }

        .hotspot-footer {
          background: #003d7f;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .hotspot-footer-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .hotspot-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .hotspot-footer-about,
        .hotspot-footer-contact {
          line-height: 1.8;
        }

        .hotspot-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hotspot-footer-links a {
          color: #b8c8e0;
          text-decoration: none;
        }

        .hotspot-footer-links a:hover {
          color: #ffffff;
        }

        .hotspot-footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 900px) {
          .hotspot-grid-two,
          .hotspot-grid-three,
          .hotspot-footer-grid {
            grid-template-columns: 1fr;
          }

          .hotspot-grid-two {
            gap: 18px;
          }
        }

        @media (max-width: 640px) {
          .hotspot-hero {
            padding: 56px 20px 44px;
          }

          .hotspot-section,
          .hotspot-muted-section {
            padding-left: 14px;
            padding-right: 14px;
          }

          .hotspot-grid-two,
          .hotspot-grid-three {
            gap: 18px;
          }

          .hotspot-card,
          .hotspot-impact-card {
            border-radius: 16px;
            padding: 18px 14px;
          }

          .hotspot-card h3,
          .hotspot-impact-card-title {
            font-size: 18px;
            line-height: 1.25;
          }

          .hotspot-list {
            gap: 10px;
          }

          .hotspot-list li,
          .hotspot-impact-card-text {
            font-size: 13px;
            line-height: 1.7;
          }

          .hotspot-impact-title {
            font-size: 24px;
          }

          .hotspot-impact-text,
          .hotspot-hero-text {
            font-size: 15px;
          }

          .hotspot-footer {
            padding-left: 16px;
            padding-right: 16px;
          }
        }
      `}</style>

      <div className="hotspot-page">
        <Navbar currentPage="map" />

        <section className="hotspot-hero">
          <div className="hotspot-hero-inner">
            <h1 className="hotspot-hero-title">Violation Hotspot Map</h1>
            <p className="hotspot-hero-text">
              Public insights on reported road and traffic violations in Surigao City.
              See where violations are concentrated and understand community patterns.
            </p>
          </div>
        </section>

        <section className="hotspot-section">
          <div className="hotspot-section-inner">
            <HotspotMap />
          </div>
        </section>

        <section className="hotspot-muted-section">
          <div className="hotspot-grid-two">
            <div className="hotspot-card">
              <h3>How to Use the Map</h3>
              <ul className="hotspot-list">
                <li><span className="hotspot-list-number">1</span><span>Select a violation type from the dropdown to filter hotspots.</span></li>
                <li><span className="hotspot-list-number">2</span><span>Click on markers or cards to view detailed hotspot information.</span></li>
                <li><span className="hotspot-list-number">3</span><span>Check color intensity to understand the severity of each area.</span></li>
                <li><span className="hotspot-list-number">4</span><span>Use insights to stay alert and report violations safely.</span></li>
              </ul>
            </div>

            <div className="hotspot-card">
              <h3>What the Data Shows</h3>
              <ul className="hotspot-list">
                <li><span className="hotspot-list-icon"><span className="hotspot-list-dot hotspot-list-dot-marker" /></span><span><strong>Hotspot Markers:</strong> Aggregated data from reported violations.</span></li>
                <li><span className="hotspot-list-icon"><span className="hotspot-list-dot hotspot-list-dot-high" /></span><span><strong>Red / High:</strong> Areas with frequent violations.</span></li>
                <li><span className="hotspot-list-icon"><span className="hotspot-list-dot hotspot-list-dot-medium" /></span><span><strong>Yellow / Medium:</strong> Areas with moderate violation frequency.</span></li>
                <li><span className="hotspot-list-icon"><span className="hotspot-list-dot hotspot-list-dot-low" /></span><span><strong>Blue / Low:</strong> Areas with fewer reports.</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="hotspot-section">
          <div className="hotspot-section-inner">
            <h2 className="hotspot-impact-title">Data-Driven Safety</h2>
            <p className="hotspot-impact-text">
              This map helps CTMO allocate resources effectively and helps citizens avoid
              high-risk areas.
            </p>

            <div className="hotspot-grid-three">
              <div className="hotspot-impact-card">
                <h3 className="hotspot-impact-card-title">Better Enforcement</h3>
                <p className="hotspot-impact-card-text">
                  CTMO uses hotspot data to place officers in high-risk areas where they can make the most impact.
                </p>
              </div>

              <div className="hotspot-impact-card">
                <h3 className="hotspot-impact-card-title">Community Awareness</h3>
                <p className="hotspot-impact-card-text">
                  Citizens see problem areas and adjust their behavior accordingly, preventing violations before they happen.
                </p>
              </div>

              <div className="hotspot-impact-card">
                <h3 className="hotspot-impact-card-title">Measurable Progress</h3>
                <p className="hotspot-impact-card-text">
                  Track trends over time to see which areas are improving and where continued attention is needed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="hotspot-footer">
          <div className="hotspot-footer-grid">
            <div>
              <div className="hotspot-footer-col-title">About</div>
              <p className="hotspot-footer-about">
                Together, we keep Surigao City's roads safe. Report violations and help achieve
                faster CTMO response.
              </p>
            </div>
            <div>
              <div className="hotspot-footer-col-title">Quick Links</div>
              <ul className="hotspot-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/hotspot-map">Hotspot Map</a></li>
              </ul>
            </div>
            <div>
              <div className="hotspot-footer-col-title">Support</div>
              <ul className="hotspot-footer-links">
                <li><a href="/#faqs">FAQs</a></li>
                <li><a href="/#contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="hotspot-footer-col-title">Contact CTMO</div>
              <p className="hotspot-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="hotspot-footer-bottom">
            <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
