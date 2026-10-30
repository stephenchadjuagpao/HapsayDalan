import ResponsiveSelect from "./ResponsiveSelect";
import React, { useEffect, useRef, useState } from "react";
import API from "../services/api";
import loadLeafletAssets from "../utils/leafletAssets";
import { MAP_TILE_URL, MAP_TILE_OPTIONS } from "../utils/mapTiles";
import "./ReportDirections.css";

export function validPoint(lat, lng) {
  return lat !== null && lat !== undefined && lat !== "" && lng !== null && lng !== undefined && lng !== "" &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
const distance = (meters) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

export default function ReportDirections({ latitude, longitude, label = "Reported location" }) {
  const [open, setOpen] = useState(false);
  if (!validPoint(latitude, longitude)) return <p className="rd-note">Directions unavailable: this report has no valid map coordinates.</p>;
  return <section className="rd-shell" aria-label="Directions to reported location">
    <button type="button" className="rd-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? "Hide directions" : "Get directions to this location"}
    </button>
    {open ? <DirectionsMap key={`${latitude},${longitude}`} latitude={Number(latitude)} longitude={Number(longitude)} label={label} /> : null}
  </section>;
}

function DirectionsMap({ latitude, longitude, label }) {
  const host = useRef(null);
  const map = useRef(null);
  const originMarker = useRef(null);
  const routeLayer = useRef(null);
  const request = useRef(null);
  const gpsAttempt = useRef(0);
  const [origin, setOrigin] = useState(null);
  const [preference, setPreference] = useState("shortest");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(null);

  const clearRoute = () => {
    request.current?.abort();
    setBusy(false);
    setRoute(null);
    if (routeLayer.current && map.current) map.current.removeLayer(routeLayer.current);
    routeLayer.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    let resize;
    loadLeafletAssets().then((L) => {
      if (cancelled || !host.current) return;
      const instance = L.map(host.current, { scrollWheelZoom: false }).setView([latitude, longitude], 16);
      map.current = instance;
      L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(instance);
      L.marker([latitude, longitude]).addTo(instance).bindTooltip("Reported location");
      instance.on("click", ({ latlng }) => {
        gpsAttempt.current += 1;
        setLocating(false);
        setOrigin({ lat: latlng.lat, lng: latlng.lng, source: "Selected starting point" });
      });
      if (window.ResizeObserver) {
        resize = new ResizeObserver(() => instance.invalidateSize());
        resize.observe(host.current);
      }
      setReady(true);
    }).catch((failure) => { if (!cancelled) setError(failure.message); });
    return () => {
      cancelled = true;
      gpsAttempt.current += 1;
      request.current?.abort();
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    request.current?.abort();
    setBusy(false);
    setRoute(null);
    setError("");
    if (routeLayer.current && map.current) map.current.removeLayer(routeLayer.current);
    routeLayer.current = null;
    if (!ready || !origin) return;
    if (originMarker.current) map.current.removeLayer(originMarker.current);
    originMarker.current = window.L.circleMarker([origin.lat, origin.lng], {
      radius: 8, color: "#fff", fillColor: "#2563eb", fillOpacity: 1, weight: 3,
    }).addTo(map.current).bindTooltip("Starting point");
  }, [origin, preference, ready]);

  const useLocation = () => {
    clearRoute();
    if (!window.isSecureContext || !navigator.geolocation) {
      setError("Device location requires HTTPS and location support. You can click the map to select a starting point instead.");
      return;
    }
    const attempt = ++gpsAttempt.current;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((fix) => {
      if (attempt !== gpsAttempt.current) return;
      setLocating(false);
      if (!validPoint(fix.coords.latitude, fix.coords.longitude)) {
        setError("Device returned an invalid location. Choose a starting point on the map.");
        return;
      }
      setOrigin({ lat: fix.coords.latitude, lng: fix.coords.longitude,
        source: `Your device location (about ${Math.ceil(fix.coords.accuracy)} m accuracy)` });
    }, () => {
      if (attempt !== gpsAttempt.current) return;
      setLocating(false);
      setError("Location unavailable. Allow location access or click the map to choose your starting point.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };

  const findRoute = async () => {
    if (!origin || busy) return;
    clearRoute();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const { data } = await API.get("report-route/", { signal: controller.signal, timeout: 20000,
        params: { start_lat: origin.lat, start_lng: origin.lng, end_lat: latitude, end_lng: longitude, preference } });
      if (controller.signal.aborted || !map.current) return;
      routeLayer.current = window.L.geoJSON({ type: "Feature", geometry: data.geometry, properties: {} }, {
        style: { color: "#2563eb", weight: 6, opacity: 0.85 },
      }).addTo(map.current);
      map.current.fitBounds(routeLayer.current.getBounds(), { padding: [24, 24] });
      setRoute(data);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.detail || "Could not load directions. Please try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <div className="rd-content">
    <h4>Directions to {label}</h4>
    <p className="rd-note">Choose your starting point on the map or use your current location. The report pin stays fixed.</p>
    <div ref={host} className="rd-map" aria-label="Route map" />
    <div className="rd-controls">
      <button type="button" onClick={useLocation} disabled={!ready || locating}>{locating ? "Finding location..." : "Use my current location"}</button>
      <label>Route preference<ResponsiveSelect aria-label="Route preference" value={preference} onChange={(event) => setPreference(event.target.value)}>
        <option value="shortest">Shortest distance</option><option value="fastest">Fastest estimated drive</option>
      </ResponsiveSelect></label>
      <button type="button" onClick={findRoute} disabled={!ready || !origin || busy || locating}>{busy ? "Finding route..." : "Show driving route"}</button>
    </div>
    {origin ? <p className="rd-note">From: {origin.source} ({origin.lat.toFixed(5)}, {origin.lng.toFixed(5)})</p> : null}
    {error ? <p className="rd-error" role="alert">{error}</p> : null}
    {route ? <div className="rd-result" aria-live="polite">
      <strong>{distance(route.distance)} · About {Math.max(1, Math.ceil(route.duration / 60))} min</strong>
      <p>{route.preference === "shortest" ? "Shortest driving distance" : "Fastest estimated driving route"} using mapped roads. Routes may end at the nearest accessible road.</p>
      <details><summary>Turn-by-turn directions</summary><ol>{route.steps.map((step, index) =>
        <li key={index}>{step.instruction} <span>({distance(step.distance)})</span></li>)}</ol></details>
    </div> : null}
    <p className="rd-note">Routing by <a href="https://openrouteservice.org/" target="_blank" rel="noreferrer">openrouteservice</a> / HeiGIT, using OpenStreetMap data. Travel times exclude live traffic. Route coordinates are sent to the routing provider when you request directions.</p>
  </div>;
}
