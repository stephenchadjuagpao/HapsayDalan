import ResponsiveSelect from "./ResponsiveSelect";
import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import ReportDirections from "./ReportDirections";
import MaterialIcon from "./MaterialIcon";
import { MAP_TILE_URL, MAP_TILE_OPTIONS } from "../utils/mapTiles";

const MAP_CENTER = [9.7843, 125.4888];
const VIOLATION_OPTIONS = [
  "Arrogant Driver / Discourteous",
  "No Parking / Wrong Parking",
  "No U-Turn / Illegal Turn",
  "Involved in Traffic Accident",
  "No Muffler / Silencer",
  "Obstruction",
  "Driving Under the Influence of Liquor",
  "Wearing Slipper / Sleeveless & Shorts",
  "Failure / Or No Crash Helmet (R.A. 4136)",
  "No Seatbelt (R.A. 8750)",
  "Illegal Terminal (Ord. #134 S, '98)",
  "Non Payment of Terminal Fee (Ord. #134 S, '98)",
  "Driving W/Out a License / Unaccompanied by Licensed Driver",
  "Deffective Signal / Break / Tail Lights",
  "No Loading / No Unloading",
  "Allowing Passenger on Top of MV",
  "Other Violation/s (Specify)",
];
const SURIGAO_CITY_BOUNDS = {
  north: 9.818,
  south: 9.755,
  east: 125.515,
  west: 125.455,
};

let leafletAssetsPromise = null;

const loadLeafletAssets = () => {
  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletAssetsPromise) {
    return leafletAssetsPromise;
  }

  leafletAssetsPromise = new Promise((resolve, reject) => {
    const existingStylesheet = document.querySelector('link[data-hotspot-leaflet="true"]');
    if (!existingStylesheet) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.dataset.hotspotLeaflet = "true";
      document.head.appendChild(stylesheet);
    }

    const existingScript = document.querySelector('script[data-hotspot-leaflet="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L));
      existingScript.addEventListener("error", () => reject(new Error("Leaflet failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.hotspotLeaflet = "true";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load."));
    document.head.appendChild(script);
  });

  return leafletAssetsPromise;
};

const getSeverityColor = (severity) => {
  if (severity === "High") return "#dc2626";
  if (severity === "Medium") return "#f59e0b";
  return "#2563eb";
};

const getSeverityFromCount = (count) => {
  if (count >= 5) return "High";
  if (count >= 3) return "Medium";
  return "Low";
};

const normalizeLocation = (location) => String(location || "").trim().toLowerCase();

const getTitleFromLocation = (location) => {
  const cleaned = String(location || "").trim();
  if (!cleaned) return "Unknown Location";

  const firstPart = cleaned
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  return firstPart || cleaned;
};

const parseLatLngString = (location) => {
  const match = String(location || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
};

const isInsideSurigaoCity = (lat, lng) =>
  lat >= SURIGAO_CITY_BOUNDS.south &&
  lat <= SURIGAO_CITY_BOUNDS.north &&
  lng >= SURIGAO_CITY_BOUNDS.west &&
  lng <= SURIGAO_CITY_BOUNDS.east;

const getCoordinatesFromReport = (report) => {
  const lat = Number(report?.latitude);
  const lng = Number(report?.longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  if (!isInsideSurigaoCity(lat, lng)) {
    return null;
  }

  return { lat, lng };
};

const geocodeLocation = async (location) => {
  const parsed = parseLatLngString(location);
  if (parsed && isInsideSurigaoCity(parsed.lat, parsed.lng)) {
    return parsed;
  }

  const query = encodeURIComponent(`${location}, Surigao City, Philippines`);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=${SURIGAO_CITY_BOUNDS.west},${SURIGAO_CITY_BOUNDS.north},${SURIGAO_CITY_BOUNDS.east},${SURIGAO_CITY_BOUNDS.south}&q=${query}`
  );

  if (!response.ok) {
    throw new Error("Geocoding failed.");
  }

  const data = await response.json();
  const first = data?.[0];

  if (!first) {
    return null;
  }

  const lat = Number(first.lat);
  const lng = Number(first.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng) || !isInsideSurigaoCity(lat, lng)) {
    return null;
  }

  return { lat, lng };
};

export default function HotspotMap({ isEmbedded = false } = {}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [selectedType, setSelectedType] = useState("All");
  const [selectedHotspotId, setSelectedHotspotId] = useState(null);
  const [mapError, setMapError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hotspots, setHotspots] = useState([]);
  const [reportViolationTypes, setReportViolationTypes] = useState([]);

  useEffect(() => {
    let isCancelled = false;

    const loadHotspots = async () => {
      setIsLoading(true);
      setMapError("");

      try {
        const response = await API.get(isEmbedded ? "reports/" : "reports/hotspots/");
        const reports = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.results)
            ? response.data.results
            : [];

        const nextReportViolationTypes = Array.from(
          new Set(
            reports
              .map((report) => String(report?.violation_type || "").trim())
              .filter(Boolean)
          )
        );

        const groupedReports = reports.reduce((groups, report) => {
          const key = normalizeLocation(report.location);

          if (!key) {
            return groups;
          }

          if (!groups[key]) {
            groups[key] = {
              id: key,
              title: getTitleFromLocation(report.location),
              fullLocation: report.location,
              reports: [],
              violationCounts: {},
              latestReportedAt: report.date_reported,
            };
          }

          groups[key].reports.push(report);
          groups[key].violationCounts[report.violation_type] =
            (groups[key].violationCounts[report.violation_type] || 0) + 1;

          if (
            report.date_reported &&
            (!groups[key].latestReportedAt ||
              new Date(report.date_reported) > new Date(groups[key].latestReportedAt))
          ) {
            groups[key].latestReportedAt = report.date_reported;
          }

          return groups;
        }, {});

        const groupedEntries = Object.values(groupedReports);

        const resolvedHotspots = await Promise.all(
          groupedEntries.map(async (group) => {
            const coordinatesFromReport = group.reports
              .map((report) => getCoordinatesFromReport(report))
              .find(Boolean);

            const coordinates =
              coordinatesFromReport ||
              (await geocodeLocation(group.fullLocation).catch(() => null));

            if (!coordinates) {
              return null;
            }

            const sortedViolations = Object.entries(group.violationCounts).sort((a, b) => b[1] - a[1]);
            const [topViolationType = "Unknown", topViolationCount = 0] = sortedViolations[0] || [];
            const severity = getSeverityFromCount(group.reports.length);

            return {
              id: group.id,
              title: group.title,
              fullLocation: group.fullLocation,
              lat: coordinates.lat,
              lng: coordinates.lng,
              reports: group.reports.length,
              severity,
              violationType: topViolationType,
              topViolationCount,
              latestReportedAt: group.latestReportedAt,
              description: `${group.reports.length} report${group.reports.length === 1 ? "" : "s"} recorded here. Most common violation: ${topViolationType}.`,
            };
          })
        );

        const nextHotspots = resolvedHotspots
          .filter(Boolean)
          .sort((a, b) => b.reports - a.reports || a.title.localeCompare(b.title));

        if (!isCancelled) {
          setHotspots(nextHotspots);
          setReportViolationTypes(nextReportViolationTypes);
          setSelectedHotspotId(nextHotspots[0]?.id || null);

          if (!nextHotspots.length) {
            setMapError("No verified report locations are available yet. Reports appear here after admin verification.");
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setHotspots([]);
          setReportViolationTypes([]);
          setSelectedHotspotId(null);
          setMapError("We could not load hotspot data from the backend reports right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadHotspots();

    return () => {
      isCancelled = true;
    };
  }, [isEmbedded]);

  const violationTypes = useMemo(() => {
    const extraBackendTypes = reportViolationTypes.filter((type) => !VIOLATION_OPTIONS.includes(type));

    return ["All", ...VIOLATION_OPTIONS, ...extraBackendTypes];
  }, [reportViolationTypes]);

  const filteredHotspots = useMemo(() => {
    if (selectedType === "All") {
      return hotspots;
    }

    return hotspots.filter((item) => item.violationType === selectedType);
  }, [hotspots, selectedType]);

  useEffect(() => {
    if (!filteredHotspots.length) {
      setSelectedHotspotId(null);
      return;
    }

    const selectedStillVisible = filteredHotspots.some((item) => item.id === selectedHotspotId);
    if (!selectedStillVisible) {
      setSelectedHotspotId(filteredHotspots[0].id);
    }
  }, [filteredHotspots, selectedHotspotId]);

  useEffect(() => {
    let isCancelled = false;

    const initializeMap = async () => {
      if (!mapContainerRef.current) {
        return;
      }

      try {
        const L = await loadLeafletAssets();
        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapContainerRef.current, {
            center: MAP_CENTER,
            zoom: 14,
            scrollWheelZoom: true,
            dragging: true,
            doubleClickZoom: true,
            boxZoom: true,
            keyboard: true,
            touchZoom: true,
            zoomControl: true,
          });

          L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(mapInstanceRef.current);

          markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.scrollWheelZoom.enable();
          mapInstanceRef.current.dragging.enable();
          mapInstanceRef.current.doubleClickZoom.enable();
          mapInstanceRef.current.boxZoom.enable();
          mapInstanceRef.current.keyboard.enable();
          mapInstanceRef.current.touchZoom.enable();
          mapInstanceRef.current.invalidateSize();
        }
      } catch (error) {
        if (!isCancelled) {
          setMapError("We could not load the hotspot map right now.");
        }
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = window.L;

    if (!L || !mapInstanceRef.current || !markersLayerRef.current) {
      return;
    }

    markersLayerRef.current.clearLayers();

    filteredHotspots.forEach((hotspot) => {
      const marker = L.circleMarker([hotspot.lat, hotspot.lng], {
        radius: hotspot.severity === "High" ? 14 : hotspot.severity === "Medium" ? 11 : 9,
        color: hotspot.id === selectedHotspotId ? "#153f80" : "#ffffff",
        weight: hotspot.id === selectedHotspotId ? 4 : 2,
        fillColor: getSeverityColor(hotspot.severity),
        fillOpacity: hotspot.id === selectedHotspotId ? 0.95 : 0.72,
      });

      marker.bindPopup(
        `<strong>${hotspot.title}</strong><br />${hotspot.violationType}<br />${hotspot.reports} reports`
      );
      const tooltip = document.createElement("span");
      tooltip.textContent = `${hotspot.title} · Click to view hotspot`;
      marker.bindTooltip(tooltip, { direction: "top" });
      marker.on("click", () => {
        setSelectedHotspotId(hotspot.id);
      });

      markersLayerRef.current.addLayer(marker);
    });

    if (filteredHotspots.length) {
      const bounds = L.latLngBounds(filteredHotspots.map((item) => [item.lat, item.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    } else {
      mapInstanceRef.current.setView(MAP_CENTER, 14);
    }
  }, [filteredHotspots, selectedHotspotId]);

  const selectedHotspot =
    filteredHotspots.find((item) => item.id === selectedHotspotId) || filteredHotspots[0] || null;

  const formatDateTime = (value) => {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const hotspotDetails = selectedHotspot ? (
            <div className="hotspot-detail">
              <div className="hotspot-side-title">Selected Hotspot Details</div>
              <div className="hotspot-card-text">{selectedHotspot.description}</div>
              {isEmbedded ? <ReportDirections latitude={selectedHotspot.lat} longitude={selectedHotspot.lng}
                label={selectedHotspot.title} /> : null}
              <div className="hotspot-detail-grid">
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Most Common Violation</span>
                  <span className="hotspot-detail-value">{selectedHotspot.violationType}</span>
                </div>
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Severity</span>
                  <span className="hotspot-detail-value">{selectedHotspot.severity}</span>
                </div>
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Report Count</span>
                  <span className="hotspot-detail-value">{selectedHotspot.reports}</span>
                </div>
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Latest Report</span>
                  <span className="hotspot-detail-value">
                    {formatDateTime(selectedHotspot.latestReportedAt)}
                  </span>
                </div>
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Full Location</span>
                  <span className="hotspot-detail-value">{selectedHotspot.fullLocation}</span>
                </div>
                <div className="hotspot-detail-item">
                  <span className="hotspot-detail-label">Coordinates</span>
                  <span className="hotspot-detail-value">
                    {selectedHotspot.lat.toFixed(4)}, {selectedHotspot.lng.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          ) : null;

  return (
    <>
      <style>{`
        .hotspot-shell {
          display: grid;
          grid-template-columns: 1.4fr 0.9fr;
          gap: 24px;
          align-items: start;
        }

        .hotspot-shell.is-embedded {
          gap: 18px;
        }

        .hotspot-shell.is-embedded .hotspot-map-panel,
        .hotspot-shell.is-embedded .hotspot-side-panel {
          box-shadow: none;
          border: 1px solid #e2e8f0;
        }

        .hotspot-map-panel,
        .hotspot-side-panel {
          background: #ffffff;
          border: 1px solid #dde5ef;
          border-radius: 18px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
        }

        .hotspot-map-panel {
          padding: 20px;
        }

        .hotspot-toolbar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }

        .hotspot-toolbar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .hotspot-toolbar-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .hotspot-toolbar-filter {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .hotspot-select {
          min-width: 240px;
          border: 1px solid #d4dbe4;
          border-radius: 10px;
          background: #ffffff;
          color: #334155;
          padding: 12px 14px;
          font-size: 14px;
        }

        .hotspot-intensity-legend {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 5px 12px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .hotspot-intensity-legend:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
        }

        .hotspot-intensity-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          color: #1e293b;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          line-height: 1;
        }

        .hotspot-intensity-beacon-mini {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
          animation: pulse-dot 2s infinite ease-in-out;
        }

        .hotspot-intensity-levels {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hotspot-intensity-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          cursor: default;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
          user-select: none;
        }

        .hotspot-intensity-badge:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .hotspot-intensity-badge.high {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .hotspot-intensity-badge.medium {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #b45309;
        }

        .hotspot-intensity-badge.low {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }

        .hotspot-intensity-beacon {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 10px;
          height: 10px;
        }

        .hotspot-intensity-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          position: relative;
          z-index: 2;
        }

        .hotspot-intensity-dot.high {
          background: #dc2626;
        }

        .hotspot-intensity-dot.medium {
          background: #f59e0b;
        }

        .hotspot-intensity-dot.low {
          background: #2563eb;
        }

        .hotspot-intensity-ping {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          z-index: 1;
        }

        .hotspot-intensity-ping.high {
          background: rgba(220, 38, 38, 0.75);
          animation: ping-wave 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        .hotspot-intensity-ping.medium {
          background: rgba(245, 158, 11, 0.75);
          animation: ping-wave 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.3s;
        }

        .hotspot-intensity-ping.low {
          background: rgba(37, 99, 235, 0.75);
          animation: ping-wave 2.4s cubic-bezier(0, 0, 0.2, 1) infinite 0.6s;
        }

        .hotspot-intensity-label {
          line-height: 1;
        }

        .hotspot-intensity-count {
          font-size: 10px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 6px;
          line-height: 1.2;
        }

        .hotspot-intensity-badge.high .hotspot-intensity-count {
          background: #fee2e2;
          color: #991b1b;
        }

        .hotspot-intensity-badge.medium .hotspot-intensity-count {
          background: #fef3c7;
          color: #92400e;
        }

        .hotspot-intensity-badge.low .hotspot-intensity-count {
          background: #dbeafe;
          color: #1e40af;
        }

        @keyframes ping-wave {
          0% {
            transform: scale(0.9);
            opacity: 0.9;
          }
          75%, 100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }

        @keyframes pulse-dot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.85);
          }
        }

        .hotspot-map-box {
          min-height: 380px;
          border-radius: 16px;
          overflow: hidden;
          background: #e9eef4;
          position: relative;
          isolation: isolate;
          z-index: 1;
        }

        .hotspot-live-map {
          width: 100%;
          height: 380px;
          pointer-events: auto;
          touch-action: none;
          position: relative;
          isolation: isolate;
          z-index: 1;
        }

        .hotspot-live-map .leaflet-top,
        .hotspot-live-map .leaflet-bottom {
          z-index: 20;
        }

        .hotspot-live-map .leaflet-pane {
          z-index: 10;
        }

        .hotspot-live-map .leaflet-top .leaflet-control {
          margin-top: 18px;
        }

        .hotspot-live-map .leaflet-left .leaflet-control {
          margin-left: 18px;
        }

        .hotspot-live-map .leaflet-control-zoom {
          border: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
          overflow: hidden;
        }

        .hotspot-live-map .leaflet-control-zoom a {
          width: 34px;
          height: 34px;
          line-height: 34px;
          font-size: 22px;
          font-weight: 500;
          color: #0f172a;
        }

        .hotspot-map-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          color: #ffffff;
          background: rgba(15, 23, 42, 0.42);
          font-weight: 600;
          line-height: 1.7;
        }

        .hotspot-side-panel {
          padding: 20px;
        }

        .hotspot-side-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 16px;
        }

        .hotspot-card-list {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 4px;
          margin: 0 -4px;
          overscroll-behavior: contain;
        }

        .hotspot-card {
          width: 100%;
          text-align: left;
          border: 1px solid #d9e2ec;
          border-radius: 14px;
          background: #ffffff;
          padding: 14px;
          cursor: pointer;
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }

        .hotspot-card:hover {
          transform: translateY(-1px);
          border-color: #c0cddd;
        }

        .hotspot-card.is-active {
          border-color: #0f4c97;
          box-shadow: 0 0 0 3px rgba(15, 76, 151, 0.08);
        }

        .hotspot-selection-hint { display:flex; gap:9px; align-items:flex-start; margin:-4px 0 18px; color:#405b7c; font-size:13px; line-height:1.65; }
        .hotspot-selection-hint .material-icon { flex-shrink:0; margin-top:2px; }
        .hotspot-card-action { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; padding-top:11px; border-top:1px solid #bdcfe7; color:#245ba3; font-size:13px; font-weight:700; }
        .hotspot-card:focus-visible { outline:3px solid #3975c4; outline-offset:3px; }

        .hotspot-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .hotspot-card-title {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }

        .hotspot-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
        }

        .hotspot-pill.high {
          background: #fee2e2;
          color: #b91c1c;
        }

        .hotspot-pill.medium {
          background: #fef3c7;
          color: #b45309;
        }

        .hotspot-pill.low {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .hotspot-card-meta,
        .hotspot-card-text,
        .hotspot-empty {
          font-size: 13px;
          line-height: 1.6;
          color: #5b6472;
        }

        .hotspot-detail {
          border-top: 1px solid #e6edf5;
          margin-top: 20px;
          padding-top: 20px;
        }

        .hotspot-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 14px;
        }

        .hotspot-detail-item {
          border-radius: 12px;
          background: #f8fbff;
          padding: 12px;
        }

        .hotspot-detail-label {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .hotspot-detail-value {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .hotspot-card-list { max-height: 520px; }
          .hotspot-shell {
            grid-template-columns: 1fr;
          }

          .hotspot-map-box,
          .hotspot-live-map {
            min-height: 340px;
            height: 340px;
          }
        }

        @media (max-width: 560px) {
          .hotspot-map-panel,
          .hotspot-side-panel {
            padding: 16px;
          }

          .hotspot-toolbar {
            align-items: stretch;
          }

          .hotspot-toolbar-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .hotspot-intensity-legend {
            width: 100%;
            justify-content: flex-start;
          }

          .hotspot-select {
            min-width: 0;
            width: 100%;
          }

          .hotspot-detail-grid {
            grid-template-columns: 1fr;
          }

          .hotspot-live-map .leaflet-top .leaflet-control {
            margin-top: 12px;
          }

          .hotspot-live-map .leaflet-left .leaflet-control {
            margin-left: 12px;
          }

          .hotspot-live-map .leaflet-control-zoom a {
            width: 30px;
            height: 30px;
            line-height: 30px;
            font-size: 20px;
          }
        }
      `}</style>

      <div className={`hotspot-shell ${isEmbedded ? "is-embedded" : ""}`}>
        <div className="hotspot-map-panel">
          <div className="hotspot-toolbar">
            <div className="hotspot-toolbar-header">
              <div className="hotspot-toolbar-title">Community Hotspot Overview</div>
              <div className="hotspot-intensity-legend" aria-label="Hotspot intensity legend">
                <span className="hotspot-intensity-title">
                  <span className="hotspot-intensity-beacon-mini" aria-hidden="true" />
                  Intensity
                </span>
                <div className="hotspot-intensity-levels">
                  <div className="hotspot-intensity-badge high" title="High intensity: 5 or more reports">
                    <span className="hotspot-intensity-beacon" aria-hidden="true">
                      <span className="hotspot-intensity-ping high" />
                      <span className="hotspot-intensity-dot high" />
                    </span>
                    <span className="hotspot-intensity-label">High</span>
                    <span className="hotspot-intensity-count">5+</span>
                  </div>

                  <div className="hotspot-intensity-badge medium" title="Medium intensity: 3 to 4 reports">
                    <span className="hotspot-intensity-beacon" aria-hidden="true">
                      <span className="hotspot-intensity-ping medium" />
                      <span className="hotspot-intensity-dot medium" />
                    </span>
                    <span className="hotspot-intensity-label">Medium</span>
                    <span className="hotspot-intensity-count">3-4</span>
                  </div>

                  <div className="hotspot-intensity-badge low" title="Low intensity: 1 to 2 reports">
                    <span className="hotspot-intensity-beacon" aria-hidden="true">
                      <span className="hotspot-intensity-ping low" />
                      <span className="hotspot-intensity-dot low" />
                    </span>
                    <span className="hotspot-intensity-label">Low</span>
                    <span className="hotspot-intensity-count">1-2</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hotspot-toolbar-filter">
              <ResponsiveSelect
                className="hotspot-select"
                aria-label="Filter violation types" value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                {violationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "All" ? "All Violation Types" : type}
                  </option>
                ))}
              </ResponsiveSelect>
            </div>
          </div>

          <div className="hotspot-map-box">
            <div ref={mapContainerRef} className="hotspot-live-map" />
            {isLoading ? (
              <div className="hotspot-map-overlay">Loading hotspot data from backend reports...</div>
            ) : null}
            {!isLoading && mapError ? <div className="hotspot-map-overlay">{mapError}</div> : null}
          </div>
          {hotspotDetails}
        </div>

        <aside className="hotspot-side-panel">
          <div className="hotspot-side-title">Reported Hotspots</div>
          <p className="hotspot-selection-hint"><MaterialIcon name="place" /><span>Click a map pin or a location card to view its details. Your selection will be highlighted on the map.</span></p>
          <div className="hotspot-card-list">
            {filteredHotspots.length ? (
              filteredHotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={`hotspot-card ${hotspot.id === selectedHotspotId ? "is-active" : ""}`}
                  aria-pressed={hotspot.id === selectedHotspotId}
                  onClick={() => setSelectedHotspotId(hotspot.id)}
                >
                  <div className="hotspot-card-top">
                    <span className="hotspot-card-title">{hotspot.title}</span>
                    <span className={`hotspot-pill ${hotspot.severity.toLowerCase()}`}>
                      {hotspot.severity}
                    </span>
                  </div>
                  <div className="hotspot-card-meta">{hotspot.violationType}</div>
                  <div className="hotspot-card-text">{hotspot.reports} reports recorded</div>
                  <span className="hotspot-card-action"><span>{hotspot.id === selectedHotspotId ? "Selected hotspot" : "View hotspot details"}</span>
                    <MaterialIcon name={hotspot.id === selectedHotspotId ? "check_circle" : "arrow_forward"} /></span>
                </button>
              ))
            ) : (
              <div className="hotspot-empty">
                {isLoading
                  ? "Loading hotspot summaries..."
                  : "No hotspots match the selected violation type yet."}
              </div>
            )}
          </div>

        </aside>
      </div>
    </>
  );
}
