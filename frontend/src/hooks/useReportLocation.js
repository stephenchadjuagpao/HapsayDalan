import { useEffect, useRef, useState } from "react";

export const MAX_LOCATION_AGE_MS = 60000;
export const MAX_LOCATION_ACCURACY_METERS = 100;

export default function useReportLocation(enabled) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const entryRequestRef = useRef(null);

  const startOnEntry = () => {
    if (!window.isSecureContext || !navigator.geolocation?.getCurrentPosition) return;
    const request = { result: null, onResult: null };
    entryRequestRef.current = request;
    // Called directly from the Next Step tap so mobile browsers keep user activation.
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        request.result = { fix };
        request.onResult?.(fix, null);
      },
      (failure) => {
        request.result = { failure };
        request.onResult?.(null, failure);
      },
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 8000 },
    );
  };

  useEffect(() => {
    if (!enabled) return undefined;
    setPosition(null);
    setError("");
    if (!window.isSecureContext) {
      setError("Location requires HTTPS. Open the secure site, or use localhost on this computer.");
      return undefined;
    }
    if (!navigator.geolocation) {
      setError("This browser does not support location. Use a browser with location services enabled.");
      return undefined;
    }
    let cancelled = false;
    let permission;
    let latestPosition = null;
    let permissionDenied = false;
    let watchId = null;
    const deny = () => {
      permissionDenied = true;
      latestPosition = null;
      setPosition(null);
      setError("Location permission is required. Allow location in your browser's site settings, then try again.");
    };
    navigator.permissions?.query({ name: "geolocation" }).then((result) => {
      if (cancelled) return;
      permission = result;
      permission.onchange = () => {
        if (permission.state === "denied") deny();
        else if (permission.state === "granted") {
          // Restart both the initial fix and the watch after a browser setting changes.
          setAttempt((value) => value + 1);
        }
      };
    }).catch(() => {});
    const retryWhenVisible = () => {
      if (!permissionDenied || document.visibilityState === "hidden") return;
      if (!navigator.permissions?.query) {
        // Safari may not expose the Permissions API; retry after returning from Settings.
        setAttempt((value) => value + 1);
        return;
      }
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (!cancelled && result.state === "granted") setAttempt((value) => value + 1);
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", retryWhenVisible);
    window.addEventListener("focus", retryWhenVisible);
    const acceptPosition = (fix) => {
      if (cancelled || permissionDenied) return;
      const { latitude, longitude, accuracy } = fix.coords;
      if (![latitude, longitude, accuracy, fix.timestamp].every(Number.isFinite) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) {
        if (!latestPosition) setError("The device returned an invalid location. Please try again.");
        return;
      }
      const age = Date.now() - fix.timestamp;
      if (age < -5000 || age > MAX_LOCATION_AGE_MS) return;
      if (latestPosition && fix.timestamp < latestPosition.timestamp) return;
      setError("");
      setNow(Date.now());
      latestPosition = { latitude, longitude, accuracy, timestamp: fix.timestamp };
      setPosition(latestPosition);
    };
    const rejectPosition = (failure) => {
      if (cancelled) return;
      if (failure.code === 1) deny();
      else if (!latestPosition || Date.now() - latestPosition.timestamp > MAX_LOCATION_AGE_MS) setError(failure.code === 3
        ? "Location timed out. Turn on device location, move to an open area, and try again."
        : "Unable to get your location. Turn on device location and try again.");
    };
    // A recent cached / network fix can arrive much sooner than a fresh GPS
    // fix. Display it immediately while the high-accuracy watch improves it.
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
    const startWatch = () => {
      if (!cancelled && !permissionDenied && watchId === null) {
        watchId = navigator.geolocation.watchPosition(acceptPosition, rejectPosition, options);
      }
    };
    // Let one request handle the permission prompt. Concurrent requests can race
    // on mobile browsers and leave a successful fix ignored after a denial callback.
    const entryRequest = entryRequestRef.current;
    entryRequestRef.current = null;
    if (entryRequest) {
      const finishEntryRequest = (fix, failure) => {
        if (cancelled) return;
        if (failure) { rejectPosition(failure); if (failure.code !== 1) startWatch(); }
        else { acceptPosition(fix); startWatch(); }
      };
      entryRequest.onResult = finishEntryRequest;
      if (entryRequest.result) finishEntryRequest(entryRequest.result.fix, entryRequest.result.failure);
    } else if (navigator.geolocation.getCurrentPosition) {
      navigator.geolocation.getCurrentPosition(
        (fix) => { acceptPosition(fix); startWatch(); },
        (failure) => { rejectPosition(failure); if (failure.code !== 1) startWatch(); },
        { enableHighAccuracy: false, maximumAge: 15000, timeout: 8000 },
      );
    } else startWatch();
    // A stationary device may not trigger watchPosition again. Request a fresh
    // fix periodically so filling out the form does not leave submission blocked.
    const refreshTimer = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition?.(acceptPosition, rejectPosition, options);
    }, 30000);
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
      if (entryRequest) entryRequest.onResult = null;
      document.removeEventListener("visibilitychange", retryWhenVisible);
      window.removeEventListener("focus", retryWhenVisible);
      if (permission) permission.onchange = null;
    };
  }, [enabled, attempt]);

  const age = position ? now - position.timestamp : Infinity;
  const isReady = enabled && !!position && !error && age >= -5000 && age <= MAX_LOCATION_AGE_MS;
  const message = error || (!position ? "Allow location access. Waiting for your device location..."
    : age > MAX_LOCATION_AGE_MS ? "Your location is outdated. Waiting for a fresh location..."
      : position.accuracy > MAX_LOCATION_ACCURACY_METERS
        ? `Your device location is approximate (about ${Math.ceil(position.accuracy)} m accuracy). Click or tap the map to confirm the exact violation location before submitting.`
        : `Location active. Estimated accuracy: ${Math.ceil(position.accuracy)} m.`);
  return { position, isReady, message, retry: () => setAttempt((value) => value + 1), startOnEntry };
}
