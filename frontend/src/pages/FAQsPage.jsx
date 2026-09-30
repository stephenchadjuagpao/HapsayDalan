import { useEffect } from "react";
import Navbar from "../components/reusablecode/Navbar";

const FAQ_SECTIONS = [
  {
    title: "Reporting Violations",
    items: [
      {
        question: "What counts as a reportable traffic violation?",
        answer: (
          <>
            <p>Any traffic violation that endangers public safety can be reported, including:</p>
            <ul>
              <li>Illegal parking in no-parking zones or fire hydrants</li>
              <li>Speeding in residential or school areas</li>
              <li>Running red lights or ignoring traffic signals</li>
              <li>Reckless or dangerous driving</li>
              <li>Road obstruction or hazardous parking</li>
              <li>Missing or obscured license plates</li>
              <li>Other safety violations you witness</li>
            </ul>
            <p>
              <strong>Important:</strong> Only report violations you have direct evidence of. Do
              not report based on assumption or hearsay.
            </p>
          </>
        ),
      },
      {
        question: "Can I report violations anonymously?",
        answer: (
          <>
            <p>
              Yes. You can submit a report without providing your contact information. However,
              providing your name, email, or phone number allows us to:
            </p>
            <ul>
              <li>Send you status updates about your report</li>
              <li>Request additional information if needed</li>
              <li>Notify you when action is taken</li>
            </ul>
            <p>
              All contact information is kept confidential and only used for case follow-up. You
              can choose to remain anonymous if you prefer.
            </p>
          </>
        ),
      },
      {
        question: "What if I don't have the license plate number?",
        answer: (
          <>
            <p>The license plate number is optional. You can still report a violation with:</p>
            <ul>
              <li>Clear photos or videos of the vehicle and violation</li>
              <li>Description of the vehicle color, make, or model</li>
              <li>Exact date, time, and location</li>
              <li>Description of what happened</li>
            </ul>
            <p>
              Including the plate number, if safely visible, helps us process your report faster
              and identify the violator.
            </p>
          </>
        ),
      },
      {
        question: "What kind of evidence is acceptable?",
        answer: (
          <>
            <p>We accept photos or videos that clearly show:</p>
            <ul>
              <li>The vehicle involved in the violation</li>
              <li>The violation taking place</li>
              <li>Ideally, the license plate if safe and visible</li>
              <li>The date or time stamp, if available</li>
            </ul>
            <p>
              <strong>Quality matters:</strong> Clear, well-lit photos are processed faster than
              blurry or dark images. Please take the photo safely without endangering yourself or
              others.
            </p>
          </>
        ),
      },
      {
        question: "Can I report a violation that happened in the past?",
        answer: (
          <>
            <p>
              Yes, you can report violations even if they happened earlier. Reports are processed
              faster when submitted within 48 hours of the incident.
            </p>
            <ul>
              <li>Provide the exact date and time you witnessed the violation</li>
              <li>Be as specific as possible about the location</li>
              <li>Include all details you remember</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "Tracking Reports",
    items: [
      {
        question: "Where do I find my reference ID?",
        answer: (
          <>
            <p>
              Your reference ID is provided immediately after you submit your report. You will see
              it on the confirmation screen. If you provided an email address, you may also receive
              it through email.
            </p>
            <p>
              <strong>Format:</strong> Reference IDs start with <strong>SUP-</strong> followed by 8
              digits, like <strong>SUP-12345678</strong>.
            </p>
            <p>Save this ID somewhere safe so you can track your report anytime.</p>
          </>
        ),
      },
      {
        question: "How often does my report status update?",
        answer: (
          <>
            <p>Status updates happen whenever there is progress on your case:</p>
            <ul>
              <li>
                <strong>First update:</strong> 24-48 hours after submission
              </li>
              <li>
                <strong>Second update:</strong> Within 3 days when the case is assigned
              </li>
              <li>
                <strong>Ongoing updates:</strong> Every 2-3 days as action progresses
              </li>
              <li>
                <strong>Final update:</strong> When the case is resolved
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "What do the different status levels mean?",
        answer: (
          <>
            <p>
              <strong>Submitted:</strong> Your report has been received and registered in the
              system.
            </p>
            <p>
              <strong>Under Review:</strong> CTMO is verifying the evidence, details, and validity
              of your report.
            </p>
            <p>
              <strong>Assigned:</strong> The verified report has been assigned to a CTMO officer
              for action.
            </p>
            <p>
              <strong>In Progress:</strong> The officer is actively working on the case and taking
              appropriate action.
            </p>
            <p>
              <strong>Resolved:</strong> The case has been completed. Action was taken and
              documented.
            </p>
          </>
        ),
      },
      {
        question: "How long does it take to resolve a report?",
        answer: (
          <>
            <p>
              <strong>Average time:</strong> 3-7 business days from submission to resolution.
            </p>
            <p>
              <strong>Quick cases:</strong> Simple violations may be resolved in 1-2 days.
            </p>
            <p>
              <strong>Complex cases:</strong> More serious violations or cases requiring
              investigation may take 1-2 weeks.
            </p>
            <p>
              Timeframe depends on the violation type, location accessibility, and officer
              availability.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "Data & Privacy",
    items: [
      {
        question: "How is my personal information protected?",
        answer: (
          <ul>
            <li>All data is encrypted and stored securely</li>
            <li>Contact information is never shared with the public</li>
            <li>Only authorized CTMO staff can access your information</li>
            <li>We comply with local data protection regulations</li>
            <li>Anonymous reporting is available if you prefer privacy</li>
          </ul>
        ),
      },
      {
        question: "Who can see the violations map data?",
        answer: (
          <>
            <p>The Violation Hotspot Map shows aggregated, anonymous data only:</p>
            <ul>
              <li>General locations of violation clusters</li>
              <li>Types of violations and frequency</li>
              <li>No personal information is displayed</li>
              <li>Data is not linked to individual reporters</li>
            </ul>
            <p>This public information helps the community stay informed about road safety.</p>
          </>
        ),
      },
      {
        question: "Can my report information be used against me legally?",
        answer: (
          <>
            <p>
              Your report can be used as evidence in legal proceedings related to the violation you
              reported. However:
            </p>
            <ul>
              <li>You cannot be held responsible for the violator's actions</li>
              <li>Providing a report is not a legal liability</li>
              <li>The violator may know who reported them in some cases</li>
              <li>If concerned about safety, choose anonymous reporting</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "General Questions",
    items: [
      {
        question: "Is there a fee to submit a report?",
        answer: (
          <p>
            No. Reporting is completely free. This is a public service to help keep Surigao City's
            roads safe.
          </p>
        ),
      },
      {
        question: "Can I report the same violation multiple times?",
        answer: (
          <>
            <p>Each report is reviewed individually. If you witness the same violation repeatedly:</p>
            <ul>
              <li>You can submit multiple reports for different incidents</li>
              <li>Include different times and dates for each report</li>
              <li>Provide new evidence for each submission</li>
            </ul>
            <p>This helps CTMO identify repeat violators and take stronger action.</p>
          </>
        ),
      },
      {
        question: "What should I do if I need to report a serious traffic safety issue right now?",
        answer: (
          <>
            <p>If there is an immediate danger to public safety:</p>
            <ul>
              <li>
                <strong>Call 911 or your emergency hotline</strong> for life-threatening situations
              </li>
              <li>
                <strong>Contact CTMO directly</strong> at <strong>(086) 231-9999</strong> for
                urgent traffic matters
              </li>
              <li>Use our report form for non-emergency violations</li>
            </ul>
            <p>
              This system is designed for documenting violations that have already occurred or are
              ongoing.
            </p>
          </>
        ),
      },
    ],
  },
];

export default function FAQsPage() {
  useEffect(() => {
    document.title = "HapsayDalan | FAQs";
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .faq-page {
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          color: #111827;
        }

        .faq-hero {
          padding: 72px 24px 58px;
          background: linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .faq-hero-inner,
        .faq-content,
        .faq-cta-inner,
        .faq-footer-grid,
        .faq-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
        }

        .faq-hero-copy {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }

        .faq-hero-title {
          margin: 0 0 16px;
          font-size: clamp(38px, 5vw, 54px);
          line-height: 1.08;
          font-weight: 800;
          color: #111827;
        }

        .faq-hero-text {
          margin: 0;
          font-size: 18px;
          line-height: 1.65;
          color: #5f6b7a;
        }

        .faq-main {
          padding: 58px 24px;
        }

        .faq-content {
          max-width: 920px;
          display: grid;
          gap: 40px;
        }

        .faq-section-title {
          margin: 0 0 18px;
          font-size: 30px;
          font-weight: 800;
          color: #111827;
        }

        .faq-accordion {
          display: grid;
          gap: 14px;
        }

        .faq-item {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 18px;
          box-shadow: 0 14px 34px rgba(90, 108, 166, 0.1);
          overflow: hidden;
        }

        .faq-summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px;
          font-size: 18px;
          font-weight: 800;
          color: #111827;
        }

        .faq-summary::-webkit-details-marker {
          display: none;
        }

        .faq-arrow {
          flex-shrink: 0;
          font-size: 18px;
          color: #003d7f;
          transition: transform 0.2s ease;
        }

        .faq-item[open] .faq-arrow {
          transform: rotate(180deg);
        }

        .faq-answer {
          padding: 0 24px 24px;
          font-size: 15px;
          line-height: 1.75;
          color: #5f6b7a;
        }

        .faq-answer p {
          margin: 0 0 12px;
        }

        .faq-answer p:last-child {
          margin-bottom: 0;
        }

        .faq-answer ul {
          margin: 0 0 12px;
          padding-left: 20px;
          display: grid;
          gap: 8px;
        }

        .faq-answer strong {
          color: #111827;
        }

        .faq-cta {
          background:
            radial-gradient(circle at 18% 22%, rgba(214, 222, 235, 0.12) 0, transparent 22%),
            radial-gradient(circle at 80% 74%, rgba(214, 224, 239, 0.1) 0, transparent 24%),
            linear-gradient(180deg, #f3f5f8 0%, #edf1f6 50%, #f3f5f8 100%);
          color: #111827;
          padding: 58px 24px;
        }

        .faq-cta-inner {
          text-align: center;
          max-width: 720px;
        }

        .faq-cta-title {
          margin: 0 0 12px;
          font-size: 34px;
          font-weight: 800;
          color: #111827;
        }

        .faq-cta-text {
          margin: 0 0 24px;
          font-size: 16px;
          line-height: 1.7;
          color: #5f6b7a;
        }

        .faq-cta-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 170px;
          padding: 14px 26px;
          border-radius: 12px;
          background: #003d7f;
          color: #ffffff;
          text-decoration: none;
          font-weight: 700;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .faq-cta-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(10, 31, 82, 0.1);
        }

        .faq-footer-spacer {
          height: 60px;
          background: #ffffff;
        }

        .faq-footer {
          background: #003d7f;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .faq-footer-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .faq-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .faq-footer-about,
        .faq-footer-contact {
          line-height: 1.8;
        }

        .faq-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .faq-footer-links a {
          color: #b8c8e0;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .faq-footer-links a:hover {
          color: #fff;
        }

        .faq-footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 900px) {
          .faq-footer-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .faq-hero {
            padding: 56px 20px 48px;
          }

          .faq-main,
          .faq-cta,
          .faq-footer {
            padding-left: 20px;
            padding-right: 20px;
          }

          .faq-section-title {
            font-size: 26px;
          }

          .faq-summary {
            padding: 18px 18px;
            font-size: 16px;
          }

          .faq-answer {
            padding: 0 18px 18px;
            font-size: 14px;
          }

          .faq-footer-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
        }
      `}</style>

      <div className="faq-page">
        <Navbar currentPage="faqs" />

        <header className="faq-hero">
          <div className="faq-hero-inner">
            <div className="faq-hero-copy">
              <h1 className="faq-hero-title">Frequently Asked Questions</h1>
              <p className="faq-hero-text">
                Find answers to common questions about reporting, tracking, and our traffic
                violation system.
              </p>
            </div>
          </div>
        </header>

        <main className="faq-main">
          <div className="faq-content">
            {FAQ_SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="faq-section-title">{section.title}</h2>
                <div className="faq-accordion">
                  {section.items.map((item) => (
                    <details className="faq-item" key={item.question}>
                      <summary className="faq-summary">
                        <span>{item.question}</span>
                        <span className="faq-arrow">▼</span>
                      </summary>
                      <div className="faq-answer">{item.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>

        <section className="faq-cta">
          <div className="faq-cta-inner">
            <h2 className="faq-cta-title">Still have questions?</h2>
            <p className="faq-cta-text">Contact our support team for additional help.</p>
            <a href="/contact" className="faq-cta-link">
              Contact Us
            </a>
          </div>
        </section>

        <div className="faq-footer-spacer" />

        <footer className="faq-footer">
          <div className="faq-footer-grid">
            <div>
              <div className="faq-footer-col-title">About</div>
              <p className="faq-footer-about">
                HapsayDalan helps keep Surigao City's roads safe by making traffic violation
                reporting faster, clearer, and easier for the community.
              </p>
            </div>
            <div>
              <div className="faq-footer-col-title">Quick Links</div>
              <ul className="faq-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="faq-footer-col-title">Support</div>
              <ul className="faq-footer-links">
                <li><a href="/faqs">FAQs</a></li>
                <li><a href="/contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="faq-footer-col-title">Contact CTMO</div>
              <p className="faq-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="faq-footer-bottom">© 2026 HapsayDalan. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
