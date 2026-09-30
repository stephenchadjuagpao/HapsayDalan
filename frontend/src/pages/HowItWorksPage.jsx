import Navbar from "../components/reusablecode/Navbar";

const WORKFLOW_STEPS = [
  {
    number: "1",
    title: "You Submit a Report",
    text:
      "Capture the violation with clear photos or videos. Provide the violation type, description, date, time, and location. Optionally include the plate number if safely visible. Use our AI-powered voice-to-text feature to submit your description hands-free, and let AI automatically detect violation types from your images.",
    bullets: [
      "Multiple file uploads supported",
      "GPS location tagging",
      "AI image analysis for violation detection (new)",
      "Anonymous reporting available",
    ],
    image:
      "https://cdn.b12.io/client_media/WvzF5MmB/0aebfc66-0e71-11f1-91ba-0242ac110002-h4J2Bw__I4dy5bU2LQw1g.jpg",
    alt: "Citizen submitting report",
    reverse: false,
  },
  {
    number: "2",
    title: "CTMO Reviews & Verifies",
    text:
      "Our team examines your report in detail. We verify the evidence, check for completeness, and ensure all information is valid. This typically takes 24-48 hours.",
    bullets: [
      "Evidence validation",
      "Plate verification",
      "Location confirmation",
    ],
    image:
      "https://cdn.b12.io/client_media/WvzF5MmB/0ae6d628-0e71-11f1-b423-0242ac110002-pEJ7Y2Ge6M31PtbXDEj02.jpg",
    alt: "CTMO reviewing report",
    reverse: true,
  },
  {
    number: "3",
    title: "Case Assignment",
    text:
      "Verified reports are assigned to CTMO officers based on priority and location. Officers receive all necessary information to take action.",
    bullets: [
      "Priority-based assignment",
      "Geographic distribution",
      "Officer notification",
    ],
    image:
      "https://cdn.b12.io/client_media/WvzF5MmB/0afcefcf-0e71-11f1-9b97-0242ac110002-NVCDWidAcz2TYR9c9YxxX.jpg",
    alt: "Case assignment",
    reverse: false,
  },
  {
    number: "4",
    title: "Action & Follow-up",
    text:
      "Officers take appropriate action - apprehension, citation, or warning depending on the violation. You receive updates throughout the process.",
    bullets: [
      "Real-time status updates",
      "Action taken notification",
      "Case resolution confirmation",
    ],
    image:
      "https://cdn.b12.io/client_media/WvzF5MmB/0b3417f1-0e71-11f1-8650-0242ac110002-LcyL7IussUyYbUt93Eonv.jpg",
    alt: "City safety",
    reverse: true,
  },
];

const SECURITY_ITEMS = [
  {
    icon: "LOCK",
    title: "Encrypted Storage",
    text: "All data is encrypted and stored securely in our online database with military-grade protection.",
  },
  {
    icon: "PRIV",
    title: "Privacy Protected",
    text: "Your contact information is kept confidential. Anonymous reporting is available for safety.",
  },
  {
    icon: "COMP",
    title: "Compliance",
    text: "We comply with all local data protection regulations and best practices for information security.",
  },
];

const TIMELINE_ITEMS = [
  {
    time: "Immediately",
    sub: "Upon submission",
    title: "You receive a reference ID",
    text: "Use this to track your report.",
  },
  {
    time: "1-3 minutes",
    sub: "Review phase",
    title: "Evidence verified",
    text: "CTMO checks and validates your report.",
  },
  {
    time: "3-5 minutes",
    sub: "Assignment",
    title: "Case assigned to officer",
    text: "You receive assignment notification.",
  },
  {
    time: "5-10 minutes",
    sub: "Action phase",
    title: "Action taken",
    text: "Officer apprehends, cites, or warns the violator.",
  },
  {
    time: "Ongoing",
    sub: "Follow-up",
    title: "Case closure",
    text: "You receive final status and case closure notification.",
  },
];

const BENEFITS = [
  {
    title: "Faster Response",
    text: "Violations are addressed in days instead of weeks or not at all.",
  },
  {
    title: "Data-Driven",
    text: "Resources are allocated based on actual violation patterns.",
  },
  {
    title: "Community Action",
    text: "Citizens actively participate in making roads safer.",
  },
  {
    title: "Measurable Results",
    text: "Track progress and see improvements over time.",
  },
  {
    title: "Accessible Reporting",
    text: "Voice-to-text feature lets you report violations hands-free while driving safely.",
  },
  {
    title: "AI Image Analysis",
    text: "Automatic violation detection from photos analyzes images and suggests violation types with high accuracy.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .how-page {
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          color: #111827;
        }

        .how-hero {
          padding: 72px 24px 58px;
          background: linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .how-hero-inner,
        .how-section-inner,
        .how-footer-grid,
        .how-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
        }

        .how-hero-copy {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }

        .how-hero-title {
          margin: 0 0 16px;
          font-size: clamp(38px, 5vw, 54px);
          line-height: 1.08;
          font-weight: 800;
          color: #111827;
        }

        .how-hero-text {
          margin: 0;
          font-size: 18px;
          line-height: 1.65;
          color: #5f6b7a;
        }

        .how-section {
          padding: 58px 24px;
        }

        .how-section-muted {
          padding: 58px 24px;
          background: rgba(255, 255, 255, 0.58);
          backdrop-filter: blur(8px);
        }

        .how-section-title {
          margin: 0 0 30px;
          text-align: center;
          font-size: 34px;
          font-weight: 800;
          color: #111827;
        }

        .how-workflow {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          gap: 48px;
        }

        .how-step {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 38px;
          align-items: center;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 24px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
          padding: 30px;
        }

        .how-step.reverse .how-step-copy {
          order: 2;
        }

        .how-step.reverse .how-step-media {
          order: 1;
        }

        .how-step-badge {
          width: 64px;
          height: 64px;
          border-radius: 999px;
          background: #003d7f;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 18px;
        }

        .how-step-title {
          margin: 0 0 14px;
          font-size: 28px;
          font-weight: 800;
          color: #111827;
        }

        .how-step-text {
          margin: 0 0 18px;
          font-size: 15px;
          line-height: 1.72;
          color: #5f6b7a;
        }

        .how-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }

        .how-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 14px;
          line-height: 1.55;
          color: #5f6b7a;
        }

        .how-check {
          color: #0f4c97;
          font-weight: 800;
          flex-shrink: 0;
        }

        .how-step-image {
          width: 100%;
          height: 320px;
          object-fit: cover;
          border-radius: 18px;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
        }

        .how-grid-three,
        .how-grid-two {
          display: grid;
          gap: 24px;
        }

        .how-grid-three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          max-width: 920px;
          margin: 0 auto;
        }

        .how-grid-two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          max-width: 920px;
          margin: 0 auto;
        }

        .how-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
        }

        .how-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0f4c97 0%, #2d67cf 100%);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 14px;
        }

        .how-card-icon-emoji {
          font-size: 28px;
          letter-spacing: normal;
        }

        .how-card-title {
          margin: 0 0 10px;
          font-size: 19px;
          font-weight: 800;
          color: #111827;
        }

        .how-card-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: #5f6b7a;
        }

        .how-timeline {
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }

        .how-timeline-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 18px;
          align-items: stretch;
        }

        .how-timeline-time {
          text-align: right;
          padding-top: 12px;
        }

        .how-timeline-time strong {
          display: block;
          color: #0f4c97;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .how-timeline-time span {
          font-size: 12px;
          color: #6b7280;
        }

        .how-timeline-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 16px;
          padding: 18px 20px;
          box-shadow: 0 12px 28px rgba(90, 108, 166, 0.1);
        }

        .how-timeline-title {
          margin: 0 0 6px;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .how-timeline-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #5f6b7a;
        }

        .how-note {
          max-width: 920px;
          margin: 28px auto 0;
          background: rgba(15, 76, 151, 0.08);
          border: 1px solid rgba(15, 76, 151, 0.16);
          border-radius: 18px;
          padding: 20px 22px;
          font-size: 14px;
          line-height: 1.65;
          color: #1f2937;
        }

        .how-note strong {
          font-weight: 800;
        }

        .how-benefits {
          background:
            radial-gradient(circle at 18% 22%, rgba(219, 226, 237, 0.16) 0, transparent 22%),
            radial-gradient(circle at 80% 74%, rgba(219, 227, 240, 0.14) 0, transparent 24%),
            linear-gradient(180deg, #f1f4f8 0%, #ebf0f6 50%, #f1f4f8 100%);
          color: #111827;
        }

        .how-benefits .how-section-title {
          color: #111827;
        }

        .how-benefits .how-card {
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(221, 229, 243, 0.95);
          box-shadow: 0 14px 28px rgba(90, 108, 166, 0.08);
        }

        .how-benefit-title {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 800;
          color: #111827;
        }

        .how-benefit-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .how-footer {
          background: #003d7f;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .how-footer-spacer {
          width: 100%;
          height: 60px;
          background: #ffffff;
        }

        .how-footer-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .how-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .how-footer-about,
        .how-footer-contact {
          line-height: 1.8;
        }

        .how-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .how-footer-links a {
          color: #b8c8e0;
          text-decoration: none;
        }

        .how-footer-links a:hover {
          color: #ffffff;
        }

        .how-footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 900px) {
          .how-step,
          .how-grid-three,
          .how-grid-two,
          .how-footer-grid,
          .how-timeline-row {
            grid-template-columns: 1fr;
          }

          .how-step.reverse .how-step-copy,
          .how-step.reverse .how-step-media {
            order: initial;
          }

          .how-timeline-time {
            text-align: left;
            padding-top: 0;
          }
        }

        @media (max-width: 640px) {
          .how-hero {
            padding: 56px 18px 44px;
          }

          .how-section,
          .how-section-muted,
          .how-benefits,
          .how-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .how-step {
            padding: 20px;
          }

          .how-step-title {
            font-size: 24px;
          }

          .how-step-image {
            height: 240px;
          }
        }
      `}</style>

      <div className="how-page">
        <Navbar currentPage="how" />

        <section className="how-hero">
          <div className="how-hero-inner">
            <div className="how-hero-copy">
              <h1 className="how-hero-title">How It Works</h1>
              <p className="how-hero-text">
                A transparent, efficient system designed to get results. From your report to
                enforcement action in days, not weeks.
              </p>
            </div>
          </div>
        </section>

        <section className="how-section">
          <div className="how-section-inner">
            <div className="how-workflow">
              {WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.number}
                  className={`how-step ${step.reverse ? "reverse" : ""}`}
                >
                  <div className="how-step-copy">
                    <div className="how-step-badge">{step.number}</div>
                    <h2 className="how-step-title">{step.title}</h2>
                    <p className="how-step-text">{step.text}</p>
                    <ul className="how-list">
                      {step.bullets.map((bullet) => (
                        <li key={bullet}>
                          <span className="how-check">✓</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="how-step-media">
                    <img src={step.image} alt={step.alt} className="how-step-image" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="how-section-muted">
          <div className="how-section-inner">
            <h2 className="how-section-title">Secure Data Management</h2>
            <div className="how-grid-three">
              {SECURITY_ITEMS.map((item) => (
                <div key={item.title} className="how-card">
                  <div className="how-card-icon how-card-icon-emoji">
                    {item.icon === "LOCK" ? "🔒" : item.icon === "PRIV" ? "👁️" : "📋"}
                  </div>
                  <h3 className="how-card-title">{item.title}</h3>
                  <p className="how-card-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="how-section">
          <div className="how-section-inner">
            <h2 className="how-section-title">Typical Timeline</h2>
            <div className="how-timeline">
              {TIMELINE_ITEMS.map((item) => (
                <div key={item.title} className="how-timeline-row">
                  <div className="how-timeline-time">
                    <strong>{item.time}</strong>
                    <span>{item.sub}</span>
                  </div>
                  <div className="how-timeline-card">
                    <h3 className="how-timeline-title">{item.title}</h3>
                    <p className="how-timeline-text">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="how-note">
              <strong>Note:</strong> Timelines may vary based on violation type and
              complexity. Simple violations are often resolved faster, while more serious
              cases may require additional investigation.
            </div>
          </div>
        </section>

        <section className="how-section how-benefits">
          <div className="how-section-inner">
            <h2 className="how-section-title">Benefits to Our Community</h2>
            <div className="how-grid-two">
              {BENEFITS.map((item) => (
                <div key={item.title} className="how-card">
                  <h3 className="how-benefit-title">
                    {item.title === "Faster Response" && "⚡ "}
                    {item.title === "Data-Driven" && "📊 "}
                    {item.title === "Community Action" && "🤝 "}
                    {item.title === "Measurable Results" && "📈 "}
                    {item.title === "Accessible Reporting" && "🎙️ "}
                    {item.title === "AI Image Analysis" && "🤖 "}
                    {item.title}
                  </h3>
                  <p className="how-benefit-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="how-footer-spacer" />

        <footer className="how-footer">
          <div className="how-footer-grid">
            <div>
              <div className="how-footer-col-title">About</div>
              <p className="how-footer-about">
                Together, we keep Surigao City's roads safe. Report violations and help achieve
                faster CTMO response.
              </p>
            </div>
            <div>
              <div className="how-footer-col-title">Quick Links</div>
              <ul className="how-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="how-footer-col-title">Support</div>
              <ul className="how-footer-links">
                <li><a href="/faqs">FAQs</a></li>
                <li><a href="/contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="how-footer-col-title">Contact CTMO</div>
              <p className="how-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="how-footer-bottom">
            <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
