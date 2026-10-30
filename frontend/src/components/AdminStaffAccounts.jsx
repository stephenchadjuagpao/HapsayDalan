import { useEffect, useState } from "react";
import API from "../services/api";
import "./AdminStaffAccounts.css";

const errorText = (error, fallback) => {
  const data = error?.response?.data;
  return data?.email?.[0] || data?.name?.[0] || data?.detail || fallback;
};

export default function AdminStaffAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    API.get("admin/staff/")
      .then(({ data }) => { if (alive) setAccounts(data); })
      .catch((err) => { if (alive) setError(errorText(err, "Could not load CTMO accounts.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const invite = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await API.post("admin/staff/", { name: name.trim(), email: email.trim() });
      setAccounts((current) => [...current, data]);
      setName("");
      setEmail("");
      setNotice(`Invitation sent to ${data.email}. They can choose a password from the email link.`);
    } catch (err) {
      setError(errorText(err, "Could not send the invitation."));
    } finally {
      setSaving(false);
    }
  };

  const changeAccess = async (account) => {
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      const { data } = await API.patch(`admin/staff/${account.id}/`, { is_active: !account.is_active });
      setAccounts((current) => current.map((row) => row.id === data.id ? data : row));
      setNotice(`${data.name} is now ${data.is_active ? "active" : "disabled"}.`);
    } catch (err) {
      setError(errorText(err, "Could not update this account."));
    } finally {
      setBusyId(null);
    }
  };

  const resendInvite = async (account) => {
    setBusyId(account.id);
    setError("");
    setNotice("");
    try {
      await API.post(`admin/staff/${account.id}/invite/`);
      setNotice(`A new password setup link was sent to ${account.email}.`);
    } catch (err) {
      setError(errorText(err, "Could not send a new link."));
    } finally {
      setBusyId(null);
    }
  };

  return <section className="admin-panel-card staff-accounts" aria-label="CTMO staff accounts">
    <div className="admin-section-heading"><div><h2>CTMO Accounts</h2>
      <p>Give each staff member their own login. Only main administrators can manage access.</p></div></div>
    {error && <p className="staff-feedback is-error" role="alert">{error}</p>}
    {notice && <p className="staff-feedback is-success" role="status">{notice}</p>}
    <div className="staff-layout">
      <form className="staff-invite" onSubmit={invite}>
        <h3>Invite CTMO staff</h3>
        <p>They will receive a one-time link to choose their password. The link expires in 15 minutes.</p>
        <label htmlFor="staff-name">Full name</label>
        <input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required autoComplete="name" />
        <label htmlFor="staff-email">Work email</label>
        <input id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        <button type="submit" disabled={saving}>{saving ? "Sending invitation..." : "Send invitation"}</button>
        <p>If the link expires, staff can use <strong>Forgot password?</strong> on the CTMO login page.</p>
      </form>
      <div className="staff-list-wrap">
        <h3>People with CTMO access</h3>
        {loading ? <p>Loading accounts...</p> : !accounts.length ? <p>No CTMO accounts found.</p> :
          <ul className="staff-list">{accounts.map((account) => <li key={account.id}>
            <div><strong>{account.name}</strong><span>{account.email}</span>
              <small>{account.is_superuser ? "Main administrator" : account.is_active ? (account.last_login ? "Active staff" : "Invited · waiting for first login") : "Access disabled"}</small></div>
            {!account.is_superuser && <div className="staff-actions">
              {account.is_active && !account.last_login && <button type="button" disabled={busyId === account.id}
                onClick={() => resendInvite(account)}>{busyId === account.id ? "Sending..." : "Resend link"}</button>}
              <button type="button" disabled={busyId === account.id}
                onClick={() => changeAccess(account)}>{busyId === account.id ? "Saving..." : account.is_active ? "Disable access" : "Enable access"}</button>
            </div>}
          </li>)}</ul>}
      </div>
    </div>
  </section>;
}
