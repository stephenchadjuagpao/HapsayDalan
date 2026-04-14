import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";

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

export default function HotspotMap() {
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
        const response = await API.get("reports/");
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
            setMapError("No report locations could be mapped yet from the current backend data.");
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
  }, []);

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

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(mapInstanceRef.current);

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
        color: "#ffffff",
        weight: 2,
        fillColor: getSeverityColor(hotspot.severity),
        fillOpacity: hotspot.id === selectedHotspotId ? 0.95 : 0.72,
      });

      marker.bindPopup(
        `<strong>${hotspot.title}</strong><br />${hotspot.violationType}<br />${hotspot.reports} reports`
      );
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

  return (
    <>
      <style>{`
        .hotspot-shell {
          display: grid;
          grid-template-columns: 1.4fr 0.9fr;
          gap: 24px;
          align-items: start;
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
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .hotspot-toolbar-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
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

        .hotspot-map-box {
          min-height: 460px;
          border-radius: 16px;
          overflow: hidden;
          background: #e9eef4;
          position: relative;
        }

        .hotspot-live-map {
          width: 100%;
          height: 460px;
          pointer-events: auto;
          touch-action: none;
        }

        .hotspot-live-map .leaflet-top,
        .hotspot-live-map .leaflet-bottom {
          z-index: 400;
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
          margin-bottom: 18px;
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
          padding-top: 18px;
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

      <div className="hotspot-shell">
        <div className="hotspot-map-panel">
          <div className="hotspot-toolbar">
            <div className="hotspot-toolbar-title">Community Hotspot Overview</div>
            <select
              className="hotspot-select"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              {violationTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All Violation Types" : type}
                </option>
              ))}
            </select>
          </div>

          <div className="hotspot-map-box">
            <div ref={mapContainerRef} className="hotspot-live-map" />
            {isLoading ? (
              <div className="hotspot-map-overlay">Loading hotspot data from backend reports...</div>
            ) : null}
            {!isLoading && mapError ? <div className="hotspot-map-overlay">{mapError}</div> : null}
          </div>
        </div>

        <aside className="hotspot-side-panel">
          <div className="hotspot-side-title">Reported Hotspots</div>
          <div className="hotspot-card-list">
            {filteredHotspots.length ? (
              filteredHotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={`hotspot-card ${hotspot.id === selectedHotspotId ? "is-active" : ""}`}
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

          {selectedHotspot ? (
            <div className="hotspot-detail">
              <div className="hotspot-side-title">Selected Hotspot Details</div>
              <div className="hotspot-card-text">{selectedHotspot.description}</div>
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
          ) : null}
        </aside>
      </div>
    </>
  );
}
