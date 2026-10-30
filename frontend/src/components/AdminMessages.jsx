import { useEffect, useState } from "react";
import API from "../services/api";
import "./AdminMessages.css";

export default function AdminMessages({ onRead }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        const { data } = await API.get("admin/messages/", { params: { page } });
        if (alive) { setRows(data.results); setCount(data.count); setError(""); }
      } catch { if (alive) setError("Could not load messages. Please retry."); }
      finally { if (alive) setLoading(false); }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [page, version]);

  const open = async (item) => {
    setSelected(item);
    if (item.read_at) return;
    try {
      const { data } = await API.patch(`admin/messages/${item.id}/read/`);
      setRows((current) => current.map((row) => row.id === data.id ? data : row));
      setSelected((current) => current?.id === data.id ? data : current);
      onRead?.();
    } catch { setError("Message opened, but could not mark it as read. Please retry."); }
  };
  return <section className="admin-panel-card support-inbox" aria-label="Support messages">
    <div className="admin-section-heading"><div><h2>Messages</h2><p>Questions and concerns sent through Contact & Support.</p></div>
      <button type="button" className="support-button" onClick={() => setVersion((v) => v + 1)}>Refresh messages</button></div>
    {error && <p role="alert">{error}</p>}
    <div className="support-layout">
      <div aria-busy={loading}>
        {loading ? <p role="status">Loading messages…</p> : !rows.length ? <p>No messages yet.</p> :
          <ul className="support-list">{rows.map((item) => <li key={item.id}><button type="button"
            className={`support-item${selected?.id === item.id ? " is-selected" : ""}`} onClick={() => open(item)}>
            <span className="support-item-top"><strong>{item.subject}</strong>{!item.read_at && <span className="support-unread">Unread</span>}</span>
            <span>{item.name}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
          </button></li>)}</ul>}
        <div className="support-pagination"><button type="button" className="support-button" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {Math.max(1, Math.ceil(count / 20))}</span>
          <button type="button" className="support-button" disabled={page * 20 >= count || loading} onClick={() => setPage((p) => p + 1)}>Next</button></div>
      </div>
      <article className="support-detail" aria-label="Message details">
        {selected ? <><h3>{selected.subject}</h3><p><strong>{selected.name}</strong></p>
          <a href={`mailto:${selected.email}`}>{selected.email}</a><time dateTime={selected.created_at}>{new Date(selected.created_at).toLocaleString()}</time>
          <p className="support-body">{selected.message}</p><p className="support-hint">Use the sender's email address to reply from your email app.</p></> : <p>Select a message to read its details.</p>}
      </article>
    </div>
  </section>;
}
