import { useEffect, useRef, useState } from "react";
import API from "../services/api";

export default function useAutomaticReportRoute({ enabled, origin, destination }) {
  const [state, setState] = useState({ route: null, loading: false, error: "" });
  const [attempt, setAttempt] = useState(0);
  const routeCache = useRef(new Map());
  // Ignore small GPS jitter and debounce changes to preserve the free quota.
  const startLat = origin ? Number(origin.latitude.toFixed(4)) : null;
  const startLng = origin ? Number(origin.longitude.toFixed(4)) : null;
  const endLat = destination ? Number(destination.latitude.toFixed(6)) : null;
  const endLng = destination ? Number(destination.longitude.toFixed(6)) : null;
  const samePoint = startLat !== null && endLat !== null &&
    Math.abs(startLat - endLat) < 0.0001 && Math.abs(startLng - endLng) < 0.0001;

  useEffect(() => {
    setState({ route: null, loading: false, error: "" });
    if (!enabled || startLat === null || endLat === null || samePoint) return undefined;
    const cacheKey = `${startLat},${startLng}:${endLat},${endLng}`;
    const cached = routeCache.current.get(cacheKey);
    if (cached && Date.now() - cached.savedAt < 300000) {
      setState({ route: cached.route, loading: false, error: "" });
      return undefined;
    }
    const controller = new AbortController();
    setState({ route: null, loading: true, error: "" });
    const timer = setTimeout(async () => {
      try {
        const { data } = await API.get("public-report-route/", {
          signal: controller.signal, timeout: 20000,
          params: { start_lat: startLat, start_lng: startLng, end_lat: endLat, end_lng: endLng, preference: "shortest" },
        });
        if (!controller.signal.aborted) {
          routeCache.current.delete(cacheKey);
          routeCache.current.set(cacheKey, { route: data, savedAt: Date.now() });
          if (routeCache.current.size > 50) routeCache.current.delete(routeCache.current.keys().next().value);
          setState({ route: data, loading: false, error: "" });
        }
      } catch (failure) {
        if (!controller.signal.aborted) setState({ route: null, loading: false,
          error: failure.response?.data?.detail || "Could not load the shortest route. Check your connection and retry." });
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, startLat, startLng, endLat, endLng, samePoint, attempt]);

  return { ...state, samePoint, retry: () => setAttempt((value) => value + 1) };
}
