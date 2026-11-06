import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import MaterialIcon from "./MaterialIcon";
import "./PhotoAnalysis.css";

export default function PhotoAnalysis({ file, onSelect, selectedType }) {
  const [available, setAvailable] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");
  const request = useRef(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    API.get("image-analysis/config/").then(({ data }) => { if (active) setAvailable(data.available === true); })
      .catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    generation.current += 1; request.current?.abort(); inFlight.current = false;
    setSuggestion(null); setError(""); setBusy(false); setConsent(false);
    return () => { generation.current += 1; request.current?.abort(); };
  }, [file]);

  async function analyze() {
    if (!file || !consent || inFlight.current) return;
    const current = generation.current;
    const controller = new AbortController(); request.current = controller;
    inFlight.current = true; setBusy(true); setError(""); setSuggestion(null);
    try {
      const payload = new FormData(); payload.append("image", file); payload.append("consent", "true");
      const { data } = await API.post("image-analysis/", payload, { signal: controller.signal, timeout: 55000 });
      if (current === generation.current) setSuggestion(data);
    } catch (failure) {
      if (current === generation.current && !controller.signal.aborted) setError(
        failure.response?.data?.detail || "Photo analysis is unavailable. You can still submit your report manually.");
    } finally { if (current === generation.current) { inFlight.current = false; setBusy(false); } }
  }

  const photo = file && !file.type.startsWith("video/") && !/\.(mp4|mov|webm|avi)$/i.test(file.name);
  return <section className="photo-analysis" aria-labelledby="photo-analysis-title">
    <div className="photo-analysis-heading">
      <h3 id="photo-analysis-title"><span className="photo-analysis-icon"><MaterialIcon name="smart_toy" /></span>AI photo assistant</h3>
      <span className="photo-analysis-badge">Optional</span>
    </div>
    <p className="photo-analysis-intro">Get a suggested violation from your photo. You review it; CTMO makes the final assessment.</p>
    {available === null ? <p role="status">Checking availability…</p> : !available ? <p>AI photo analysis is not enabled yet. Please choose the violation manually.</p>
      : !file ? <p className="photo-analysis-empty"><MaterialIcon name="photo_camera" size={18} /><span>Add a photo above to get started.</span></p> : !photo ? <p>AI analysis supports photos only. You can still submit your video normally.</p>
        : <>
          <label className="photo-analysis-consent"><input type="checkbox" checked={consent} disabled={busy}
            onChange={(event) => setConsent(event.target.checked)} />
            <span>I agree to send this photo to Google Gemini for AI analysis. The photo may contain faces or licence plates.</span></label>
          <button className="photo-analysis-button" type="button" onClick={analyze} disabled={!consent || busy}>
            <MaterialIcon name="smart_toy" />{busy ? "Analyzing photo…" : "Analyze photo"}
          </button>
          {busy && <p role="status">Looking for visible evidence. This can take up to 45 seconds; we automatically retry temporary connection errors.</p>}
        </>}
    {error && <p className="photo-analysis-error" role="alert">{error}</p>}
    {suggestion && <div className="photo-analysis-result" role="status">
      <strong>{suggestion.violation_type || "No clear violation identified"}</strong>
      <p>{suggestion.reason}</p>
      {suggestion.violation_type && <button className="photo-analysis-button" type="button"
        disabled={selectedType === suggestion.violation_type} onClick={() => onSelect(suggestion.violation_type)}>
        {selectedType === suggestion.violation_type ? "Suggestion selected" : "Use this suggestion"}
      </button>}
      <p className="photo-analysis-note">A single photo cannot establish every violation. Check the type, location, and description before submitting.</p>
    </div>}
    <div className="photo-analysis-tip"><MaterialIcon name="help_outline" size={18} />
      <p><strong>Photo tip:</strong> Use a clear, well-lit photo. Include the plate number only if safe.</p>
    </div>
  </section>;
}
