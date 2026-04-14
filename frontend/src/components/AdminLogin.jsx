import React, { useState } from "react";
import API from "../services/api";
import ctmoShieldLogo from "../assets/ctmo-shield-logo.jpg";

export default function AdminLogin() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    rememberMe: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setMessage("");
    setError("");
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!formData.username.trim() || !formData.password) {
      setError("Please enter both email address and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfResponse = await API.get("csrf/");
      const csrfToken = csrfResponse?.data?.csrfToken;

      const response = await API.post("admin/login/", {
        username: formData.username.trim(),
        password: formData.password,
      }, {
        headers: csrfToken
          ? {
              "X-CSRFToken": csrfToken,
            }
          : undefined,
      });

      const adminBaseUrl = API.defaults.baseURL?.replace(/\/api\/?$/, "/") || "/";
      const adminUrl = response?.data?.admin_url || "/admin/";

      setMessage("Login successful. Opening CTMO admin portal...");
      window.location.href = new URL(adminUrl.replace(/^\//, ""), adminBaseUrl).toString();
    } catch (apiError) {
      const nextError =
        apiError?.response?.data?.detail ||
        "We could not log you in right now. Please try again.";
      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .admin-login-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          overflow-x: hidden;
          overflow-y: hidden;
          height: 100vh;
          height: 100dvh;
          padding: 18px 16px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          font-family: 'Inter', sans-serif;
        }

        .admin-login-page::before,
        .admin-login-page::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
        }

        .admin-login-page::before {
          width: 340px;
          height: 340px;
          top: -90px;
          left: -110px;
          background: radial-gradient(circle, rgba(84, 121, 255, 0.34) 0%, rgba(84, 121, 255, 0) 72%);
          filter: blur(10px);
        }

        .admin-login-page::after {
          width: 420px;
          height: 420px;
          right: -150px;
          bottom: -170px;
          background: radial-gradient(circle, rgba(182, 165, 255, 0.28) 0%, rgba(182, 165, 255, 0) 72%);
          filter: blur(10px);
        }

        .admin-login-card {
          margin: auto;
          width: min(100%, 500px);
          box-sizing: border-box;
          max-height: calc(100dvh - 24px);
          position: relative;
          z-index: 1;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(251, 252, 255, 0.94) 100%);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 26px;
          padding: 36px 30px 18px;
          box-shadow:
            0 28px 60px rgba(90, 108, 166, 0.18),
            0 8px 20px rgba(90, 108, 166, 0.08);
        }

        .admin-login-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 96px;
          background: linear-gradient(180deg, rgba(58, 104, 227, 0.14) 0%, rgba(58, 104, 227, 0.05) 58%, rgba(255, 255, 255, 0) 100%);
          pointer-events: none;
        }

        .admin-login-logo-shell {
          width: 92px;
          height: 92px;
          margin: 0 auto 10px;
          border-radius: 32px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(239, 244, 255, 0.9) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 16px 34px rgba(73, 99, 172, 0.16);
          position: relative;
          z-index: 1;
        }

        .admin-login-logo {
          width: 66px;
          height: 76px;
        }

        .admin-login-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 8px 14px rgba(33, 61, 134, 0.12));
        }

        .admin-login-title {
          margin: 0;
          text-align: center;
          color: #111827;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
          position: relative;
          z-index: 1;
        }

        .admin-login-subtitle {
          margin: 6px 0 18px;
          text-align: center;
          color: #59667a;
          font-size: 13px;
          line-height: 1.4;
          position: relative;
          z-index: 1;
        }

        .admin-login-label {
          display: block;
          margin-bottom: 6px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .admin-login-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3f1;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          color: #111827;
          padding: 12px 14px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, transform 0.15s ease;
          margin-bottom: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .admin-login-input::placeholder {
          color: #7b8794;
        }

        .admin-login-input:focus {
          border-color: #0f4c97;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(15, 76, 151, 0.12);
          transform: translateY(-1px);
        }

        .admin-login-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 2px 0 14px;
        }

        .admin-login-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #5f6b7a;
          font-size: 14px;
        }

        .admin-login-checkbox input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #0f4c97;
        }

        .admin-login-link {
          color: #0f4c97;
          font-size: 14px;
          text-decoration: none;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
        }

        .admin-login-link:hover {
          text-decoration: underline;
        }

        .admin-login-button {
          width: 100%;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #0f4c97 0%, #2d67cf 100%);
          color: #ffffff;
          padding: 12px 16px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 14px 26px rgba(34, 83, 173, 0.24);
          transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.12s ease;
        }

        .admin-login-button:hover {
          background: linear-gradient(135deg, #0c3f80 0%, #245bc0 100%);
          transform: translateY(-1px);
          box-shadow: 0 18px 30px rgba(34, 83, 173, 0.28);
        }

        .admin-login-button:disabled {
          cursor: wait;
          opacity: 0.78;
          transform: none;
          box-shadow: 0 12px 24px rgba(34, 83, 173, 0.16);
        }

        .admin-login-error,
        .admin-login-message {
          margin-top: 12px;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.5;
        }

        .admin-login-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .admin-login-message {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .admin-login-divider {
          margin: 16px 0 10px;
          border: none;
          border-top: 1px solid #dfe6f3;
        }

        .admin-login-footer {
          text-align: center;
          color: #5f6b7a;
          font-size: 12px;
          line-height: 1.45;
          padding-bottom: 2px;
        }

        .admin-login-footer strong,
        .admin-login-footer a {
          color: #0f4c97;
          text-decoration: none;
          font-weight: 500;
        }

        .admin-login-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 520px) {
          .admin-login-page {
            padding: 16px 18px 20px;
            justify-content: center;
            height: 100vh;
            height: 100dvh;
            min-height: 100vh;
            min-height: 100dvh;
            overflow: hidden;
          }

          .admin-login-card {
            width: min(100%, 420px);
            margin-inline: auto;
            border-radius: 18px;
            max-height: calc(100dvh - 20px);
            min-height: 470px;
            padding: 30px 16px 28px;
          }

          .admin-login-logo-shell {
            width: 62px;
            height: 62px;
            border-radius: 18px;
            margin-bottom: 14px;
          }

          .admin-login-logo {
            width: 42px;
            height: 48px;
          }

          .admin-login-title {
            font-size: 21px;
          }

          .admin-login-subtitle {
            margin: 6px 0 18px;
            font-size: 12px;
            line-height: 1.35;
          }

          .admin-login-label {
            margin-bottom: 6px;
            font-size: 12px;
          }

          .admin-login-input {
            padding: 9px 11px;
            font-size: 13px;
            border-radius: 12px;
            margin-bottom: 10px;
          }

          .admin-login-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 8px;
            margin: 2px 0 10px;
          }

          .admin-login-checkbox {
            font-size: 12px;
            gap: 6px;
            min-width: 0;
          }

          .admin-login-checkbox span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .admin-login-link {
            font-size: 12px;
            text-align: right;
            white-space: nowrap;
          }

          .admin-login-button {
            border-radius: 12px;
            padding: 10px 14px;
            font-size: 14px;
          }

          .admin-login-divider {
            margin: 22px 0 14px;
          }

          .admin-login-footer {
            font-size: 11px;
            line-height: 1.45;
          }

          .admin-login-error,
          .admin-login-message {
            margin-top: 10px;
            padding: 8px 10px;
            font-size: 11px;
          }
        }

        @media (max-width: 360px) {
          .admin-login-page {
            padding: 12px 14px 16px;
          }

          .admin-login-card {
            width: min(100%, 400px);
            max-height: calc(100dvh - 16px);
            min-height: 450px;
            padding: 24px 13px 22px;
          }

          .admin-login-row {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .admin-login-link {
            text-align: left;
          }
        }
      `}</style>

      <div className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleSubmit}>
          <div className="admin-login-logo-shell">
            <div className="admin-login-logo">
              <img src={ctmoShieldLogo} alt="CTMO shield logo" />
            </div>
          </div>

          <h1 className="admin-login-title">CTMO Portal</h1>
          <p className="admin-login-subtitle">Authorized Personnel Only</p>

          <label className="admin-login-label" htmlFor="username">
            Email Address
          </label>
          <input
            id="username"
            name="username"
            type="text"
            className="admin-login-input"
            placeholder="officer@ctmo.gov.ph"
            value={formData.username}
            onChange={handleChange}
          />

          <label className="admin-login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="admin-login-input"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />

          <div className="admin-login-row">
            <label className="admin-login-checkbox" htmlFor="rememberMe">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <span>Remember me</span>
            </label>

            <button type="button" className="admin-login-link">
              Forgot password?
            </button>
          </div>

          <button type="submit" className="admin-login-button" disabled={isSubmitting}>
            {isSubmitting ? "Logging In..." : "Log In"}
          </button>

          {error ? <div className="admin-login-error">{error}</div> : null}
          {message ? <div className="admin-login-message">{message}</div> : null}

          <hr className="admin-login-divider" />

          <div className="admin-login-footer">
            <div>This is a restricted system for CTMO personnel only.</div>
            <div>
              Need assistance? <a href="mailto:support@ctmo.gov.ph">Contact support</a>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
