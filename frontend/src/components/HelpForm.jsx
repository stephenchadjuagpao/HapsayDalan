import { useState } from "react";

const INITIAL_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export default function HelpForm() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    setFormData(INITIAL_FORM);
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
            required
          />
        </div>

        <div className="help-form-actions">
          <button type="submit" className="help-form-submit">
            Send Message
          </button>
          {submitted ? (
            <div className="help-form-success">
              Your message has been noted. Please contact CTMO directly for urgent concerns.
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
