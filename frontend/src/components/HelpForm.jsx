import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import API from "../services/api";
import MaterialIcon from "./MaterialIcon";
import "./HelpForm.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export default function HelpForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const successDialog = useRef(null);

  useEffect(() => {
    if (!submitted) return;
    const dialog = successDialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [submitted]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setSubmitted(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    setSubmitted(false);
    try {
      await API.post("support/messages/", formData);
      setSubmitted(true);
      setFormData(INITIAL_FORM);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.detail || Object.values(data || {}).flat().join(" ") || "Could not send your message. Please retry.");
    } finally { setSending(false); }
  };

  return (
    <div className="help-form-card">
      <div className="help-form-intro">
        <h2 className="help-form-title">Send Us a Message</h2>
        <p className="help-form-text">
          Need help with reporting, tracking, or account concerns? Send your message here and the
          CTMO support team will review it.
        </p>
      </div>

      <form className="help-form-grid" onSubmit={handleSubmit}>
        <fieldset disabled={sending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}>
        <div className="help-form-row">
          <label className="help-form-label" htmlFor="help-name">
            Full Name
          </label>
          <input
            id="help-name"
            name="name"
            className="help-form-input"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
            required maxLength={120}
          />
        </div>

        <div className="help-form-row">
          <label className="help-form-label" htmlFor="help-email">
            Email Address
          </label>
          <input
            id="help-email"
            name="email"
            type="email"
            className="help-form-input"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required maxLength={254}
          />
        </div>

        <div className="help-form-row help-form-row-full">
          <label className="help-form-label" htmlFor="help-subject">
            Subject
          </label>
          <input
            id="help-subject"
            name="subject"
            className="help-form-input"
            value={formData.subject}
            onChange={handleChange}
            placeholder="How can we help?"
            maxLength={200}
            required
          />
        </div>

        <div className="help-form-row help-form-row-full">
          <label className="help-form-label" htmlFor="help-message">
            Message
          </label>
          <textarea
            id="help-message"
            name="message"
            className="help-form-textarea"
            value={formData.message}
            onChange={handleChange}
            placeholder="Write your question or concern here"
            maxLength={5000}
            required
          />
        </div>

        <div className="help-form-actions">
          <button type="submit" className="help-form-submit">
            {sending ? "Sending…" : "Send Message"}
          </button>
          {error && <p role="alert" style={{ color: "#c43b4d" }}>{error}</p>}
        </div>
        </fieldset>
      </form>
      {submitted && createPortal(
        <dialog ref={successDialog} className="help-success-dialog" aria-labelledby="help-success-title"
          aria-describedby="help-success-description" onClose={() => setSubmitted(false)}>
          <span className="help-success-icon"><MaterialIcon name="check_circle" size={40} /></span>
          <h2 id="help-success-title">Message sent successfully!</h2>
          <p id="help-success-description">Your message has been sent to the CTMO support team. Thank you for reaching out.</p>
          <button type="button" autoFocus onClick={() => setSubmitted(false)}>Done</button>
        </dialog>, document.body)}
    </div>
  );
}
