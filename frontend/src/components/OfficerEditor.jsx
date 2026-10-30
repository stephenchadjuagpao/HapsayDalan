import { useState } from "react";
import API from "../services/api";

export default function OfficerEditor({ officer, deleting, onClose, onSaved }) {
  const [values, setValues] = useState({ name: officer?.name || "", badge: officer?.badge || "", unit: officer?.unit || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = deleting ? `Delete ${officer.name}?` : officer ? "Edit Officer" : "Add Officer";
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (deleting) await API.delete(`admin/officers/${officer.id}/`);
      else if (officer) await API.patch(`admin/officers/${officer.id}/`, values);
      else await API.post("admin/officers/", values);
      onSaved(deleting ? "Officer deleted." : "Officer saved.");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.name?.[0] || data?.badge?.[0] || data?.unit?.[0] || data?.detail || "Could not save the officer. Please try again.");
    } finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop">
    <section className="admin-modal admin-officer-editor" role={deleting ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="officer-editor-title">
      <form onSubmit={save}>
        <div className="admin-modal-header"><h3 id="officer-editor-title" className="admin-modal-title">{title}</h3>
          <button type="button" className="admin-modal-close-btn" aria-label="Close officer form" disabled={busy} onClick={onClose}>×</button></div>
        <div className="admin-modal-body">
          {deleting ? <p>This removes the officer from the assignment list. Officers with active cases must have those cases reassigned or resolved first. Closed case records and activity history are kept.</p> : <>
            {[['name', 'Officer name', 120], ['badge', 'Badge number', 40], ['unit', 'Unit / team', 120]].map(([field, label, max]) =>
              <div className="admin-field-group" key={field}><label className="admin-field-label" htmlFor={`officer-${field}`}>{label} *</label>
                <input autoFocus={field === 'name'} id={`officer-${field}`} className="admin-modal-input" required maxLength={max}
                  placeholder={{ name: "e.g. Officer Juan Dela Cruz", badge: "e.g. CTMO-123", unit: "e.g. Traffic Enforcer Unit 1" }[field]}
                  value={values[field]} disabled={busy} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} /></div>)}
            {officer && <p>Updating the officer name also updates their existing case assignments.</p>}
          </>}
          {error && <p role="alert" className="admin-delete-error">{error}</p>}
        </div>
        <div className="admin-modal-footer">
          <button autoFocus={deleting} type="button" className="admin-modal-cancel" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={deleting ? "admin-modal-delete" : "admin-modal-save"} disabled={busy}>{busy ? "Saving..." : deleting ? "Delete Officer" : "Save Officer"}</button>
        </div>
      </form>
    </section>
  </div>;
}
