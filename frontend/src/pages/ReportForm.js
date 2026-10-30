import ResponsiveSelect from "../components/ResponsiveSelect";
import React, { useEffect, useRef, useState } from "react";
import Navbar from "../components/reusablecode/Navbar";
import MaterialIcon from "../components/MaterialIcon";
import API from "../services/api";
import useReportLocation, { MAX_LOCATION_ACCURACY_METERS } from "../hooks/useReportLocation";
import ReportCaptcha from "../components/ReportCaptcha";
import useAutomaticReportRoute from "../hooks/useAutomaticReportRoute";
import ViolationGuide, { VIOLATION_GUIDE } from "../components/ViolationGuide";
import SubmissionEmailVerification from "../components/SubmissionEmailVerification";
import { MAP_TILE_URL, MAP_TILE_OPTIONS } from "../utils/mapTiles";

const STEP_TITLES = [
  "Violation Details",
  "Upload Evidence",
  "Location & Contact Info",
];

const VIOLATION_OPTIONS = VIOLATION_GUIDE.map((item) => item.value);

const WHAT_TO_INCLUDE = [
  { icon: "check", text: "Clear photos or videos of the violation" },
  { icon: "check", text: "License plate number (if visible)" },
  { icon: "check", text: "Date, time, and exact location" },
  { icon: "check", text: "Detailed description of the violation" },
  { icon: "ai", text: "New: AI image analysis automatically detects violation type from your photos" },
];

const WHAT_HAPPENS_NEXT = [
  "Your report is received and assigned a reference ID",
  "CTMO reviews and verifies the evidence",
  "Case is assigned to an officer for action",
  "You receive updates via your reference ID",
];

const formatReferenceId = (value) => `SUP-${String(value).padStart(8, "0")}`;
const CAMERA_ASPECT_RATIO = 3 / 4;
const getPortraitVideoConstraints = () => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS Safari rotates the camera frame after applying sensor dimensions.
  return isIOS
    ? { width: { ideal: 960 }, height: { ideal: 720 } }
    : { aspectRatio: { ideal: CAMERA_ASPECT_RATIO }, width: { ideal: 720 }, height: { ideal: 960 } };
};
const formatReportDate = (value) => {
  if (!value) return "MM/DD/YYYY";
  const [year, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
};
const formatReportTime = (value) => {
  if (!value) return "--:-- --";
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
};
const DEFAULT_MAP_CENTER = { lat: 9.7843, lng: 125.4888 };
const mediaExtension = /\.(?:jpe?g|png|webp|gif|heic|heif|mp4|mov|webm|m4v|3gp)$/i;
const videoExtension = /\.(?:mp4|mov|webm|m4v|3gp)$/i;
const isPhotoOrVideo = (file) => /^(?:image|video)\//.test(file.type) ||
  ((!file.type || file.type === "application/octet-stream") && mediaExtension.test(file.name));


let leafletAssetsPromise = null;

const loadLeafletAssets = () => {
  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (leafletAssetsPromise) {
    return leafletAssetsPromise;
  }

  leafletAssetsPromise = new Promise((resolve, reject) => {
    const existingStylesheet = document.querySelector('link[data-leaflet="true"]');
    if (!existingStylesheet) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.dataset.leaflet = "true";
      document.head.appendChild(stylesheet);
    }

    const existingScript = document.querySelector('script[data-leaflet="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L));
      existingScript.addEventListener("error", () => reject(new Error("Leaflet failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leaflet = "true";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load."));
    document.head.appendChild(script);
  });

  return leafletAssetsPromise;
};

function ReportForm() {
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingCanvasStreamRef = useRef(null);
  const recordingFrameRef = useRef(null);
  const saveRecordingRef = useRef(false);
  const recordedChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const evidenceInputRef = useRef(null);
  const successCardRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const mapAccuracyRef = useRef(null);
  const mapRouteRef = useRef(null);
  const mapDeviceRef = useRef(null);
  const lastGeocodeRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [manualPin, setManualPin] = useState(null);
  const [step, setStep] = useState(1);
  const previousStepRef = useRef(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [emailChallenge, setEmailChallenge] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [submittedReferenceId, setSubmittedReferenceId] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [captureMode, setCaptureMode] = useState("photo");
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState("");
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [formData, setFormData] = useState({
    violation_type: "",
    description: "",
    plate_number: "",
    date: "",
    time: "",
    image: null,
    location: "",
    latitude: "",
    longitude: "",
    reporter_name: "",
    reporter_email: "",
    reporter_phone: "",
  });

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const connectCameraPreview = (stream) => {
    const video = videoPreviewRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = true;
    try {
      Promise.resolve(video.play()).catch(() => {
        if (streamRef.current === stream) {
          setCameraError("Camera preview did not start. Close and reopen the camera to try again.");
        }
      });
    } catch (error) {
      if (streamRef.current === stream) {
        setCameraError("Camera preview did not start. Close and reopen the camera to try again.");
      }
    }
  };

  const stopRecordingCanvas = () => {
    if (recordingFrameRef.current !== null) {
      cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }
    recordingCanvasStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingCanvasStreamRef.current = null;
  };

  useEffect(() => () => {
    saveRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    stopRecordingCanvas();
    stopCameraStream();
  }, []);

  useEffect(() => {
    if (videoPreviewRef.current && streamRef.current && videoPreviewRef.current.srcObject !== streamRef.current) {
      connectCameraPreview(streamRef.current);
    }
  }, [isCameraModalOpen, selectedCameraId]);

  const deviceLocation = useReportLocation(step === 3 && !submittedReferenceId);
  const reportPosition = manualPin || deviceLocation.position;
  useEffect(() => {
    if (previousStepRef.current !== step) {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      document.querySelector(".report-progress-wrap")?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      previousStepRef.current = step;
    }
  }, [step]);
  useEffect(() => {
    if (!submittedReferenceId) return;
    const card = successCardRef.current;
    card?.focus({ preventScroll: true });
    card?.scrollIntoView?.({ behavior: "auto", block: "center" });
  }, [submittedReferenceId]);
  useEffect(() => {
    if (!isCameraModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isCameraModalOpen]);
  const automaticRoute = useAutomaticReportRoute({
    enabled: step === 3 && !submittedReferenceId && deviceLocation.isReady,
    origin: deviceLocation.position,
    destination: manualPin,
  });

  useEffect(() => {
    if (step !== 3 || submittedReferenceId || !mapContainerRef.current) return undefined;
    let cancelled = false;
    setIsMapLoading(true);
    setMapError("");
    const initializeMap = async () => {
      try {
        const L = await loadLeafletAssets();
        if (cancelled) return;
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], zoom: 13,
          scrollWheelZoom: true, touchZoom: true,
        });
        L.tileLayer(MAP_TILE_URL, MAP_TILE_OPTIONS).addTo(mapInstanceRef.current);
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.on("click", (event) => {
          setManualPin({ latitude: event.latlng.lat, longitude: event.latlng.lng });
          lastGeocodeRef.current = null;
        });
        setMapReady(true);
      } catch (error) {
        if (!cancelled) setMapError("We could not load the map. Your device coordinates can still be captured.");
      } finally {
        if (!cancelled) setIsMapLoading(false);
      }
    };
    initializeMap();
    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      mapMarkerRef.current = null;
      mapAccuracyRef.current = null;
      mapRouteRef.current = null;
      mapDeviceRef.current = null;
      lastGeocodeRef.current = null;
      setMapReady(false);
    };
  }, [step, submittedReferenceId]);

  useEffect(() => {
    mapRouteRef.current?.remove();
    mapRouteRef.current = null;
    if (!mapReady || !mapInstanceRef.current || !automaticRoute.route) return;
    const layer = window.L.geoJSON({ type: "Feature", geometry: automaticRoute.route.geometry, properties: {} }, {
      style: { color: "#2563eb", weight: 6, opacity: 0.9 },
      attribution: 'Routing &copy; <a href="https://openrouteservice.org/">openrouteservice</a> / HeiGIT',
    }).addTo(mapInstanceRef.current);
    mapRouteRef.current = layer;
    mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 18 });
  }, [automaticRoute.route, mapReady]);

  useEffect(() => {
    const position = reportPosition;
    if (!mapReady || !mapInstanceRef.current || !position) return;
    const point = [position.latitude, position.longitude];
    if (!mapMarkerRef.current) {
      mapMarkerRef.current = window.L.marker(point, { draggable: false }).addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView(point, 17);
    } else {
      mapMarkerRef.current.setLatLng(point);
      if (!manualPin) mapInstanceRef.current.panTo(point);
    }
    const device = deviceLocation.position;
    if (device) {
      const devicePoint = [device.latitude, device.longitude];
      if (!mapDeviceRef.current) {
        mapDeviceRef.current = window.L.circleMarker(devicePoint, {
          radius: 7, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1,
        }).addTo(mapInstanceRef.current);
      } else mapDeviceRef.current.setLatLng(devicePoint);
      if (!mapAccuracyRef.current) {
        mapAccuracyRef.current = window.L.circle(devicePoint, {
          radius: device.accuracy, color: "#003d7f", fillOpacity: 0.12,
        }).addTo(mapInstanceRef.current);
      } else mapAccuracyRef.current.setLatLng(devicePoint).setRadius(device.accuracy);
    } else {
      mapDeviceRef.current?.remove();
      mapDeviceRef.current = null;
      mapAccuracyRef.current?.remove();
      mapAccuracyRef.current = null;
    }
  }, [reportPosition, deviceLocation.position, manualPin, mapReady]);

  useEffect(() => {
    const position = reportPosition;
    if (!position) {
      setFormData((current) => ({ ...current, location: "", latitude: "", longitude: "" }));
      lastGeocodeRef.current = null;
      mapMarkerRef.current?.remove();
      mapAccuracyRef.current?.remove();
      mapMarkerRef.current = null;
      mapAccuracyRef.current = null;
      return undefined;
    }
    const { latitude, longitude } = position;
    const fallback = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    // Save coordinates immediately; address lookup must never delay or replace the GPS fix.
    setFormData((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
    const previous = lastGeocodeRef.current;
    if (previous && Date.now() - previous.time < 5000) return undefined;
    const distanceChanged = !previous || Math.abs(previous.latitude - latitude) > 0.0002 ||
      Math.abs(previous.longitude - longitude) > 0.0002;
    if (!distanceChanged && Date.now() - previous.time < 30000) return undefined;
    lastGeocodeRef.current = { latitude, longitude, time: Date.now() };
    setFormData((current) => ({ ...current, location: fallback }));
    API.get("reverse-geocode/", { params: { lat: latitude, lng: longitude } }).then((response) => {
      // Ignore an address that belongs to an earlier position.
      if (lastGeocodeRef.current?.latitude === latitude && lastGeocodeRef.current?.longitude === longitude) {
        setFormData((current) => ({ ...current, location: response.data.location || fallback }));
      }
    }).catch(() => {});
    return undefined;
  }, [reportPosition]);

  useEffect(() => () => {
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
  }, [uploadedPreviewUrl]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (invalidField === name || invalidField === event.target.id) {
      setInvalidField("");
      setSubmitError("");
    }
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const attachEvidence = (file) => {
    const previewUrl = file ? URL.createObjectURL(file) : "";
    setSubmitError("");
    setInvalidField("");
    setUploadedPreviewUrl(previewUrl);
    setFormData((current) => ({
      ...current,
      image: file,
    }));
  };

  const removeEvidence = () => {
    if (evidenceInputRef.current) evidenceInputRef.current.value = "";
    attachEvidence(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !isPhotoOrVideo(file)) {
      event.target.value = "";
      setSubmitError("Please choose a photo or video from your device.");
      return;
    }
    attachEvidence(file);
  };

  const openCameraModal = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    setCameraError("");
    setCaptureMode("photo");
    setIsCameraModalOpen(true);
    setIsCameraLoading(true);

    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, ...getPortraitVideoConstraints() },
        audio: false,
      });

      streamRef.current = initialStream;
      connectCameraPreview(initialStream);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(videoInputs);
      const activeDeviceId = initialStream.getVideoTracks()[0]?.getSettings?.().deviceId;
      setSelectedCameraId(videoInputs.find((device) => device.deviceId === activeDeviceId)?.deviceId ?? videoInputs[0]?.deviceId ?? "");
    } catch (error) {
      setCameraError("We could not access your device camera. Please allow camera permission.");
      setIsCameraModalOpen(false);
      stopCameraStream();
    } finally {
      setIsCameraLoading(false);
    }
  };

  const switchCamera = async (deviceId) => {
    setSelectedCameraId(deviceId);
    setCameraError("");
    setIsCameraLoading(true);

    try {
      stopCameraStream();
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, ...getPortraitVideoConstraints() }
          : { facingMode: { ideal: "environment" }, ...getPortraitVideoConstraints() },
        audio: captureMode === "video",
      });

      streamRef.current = nextStream;
      connectCameraPreview(nextStream);
    } catch (error) {
      setCameraError("We could not switch to that camera.");
    } finally {
      setIsCameraLoading(false);
    }
  };

  const closeCameraModal = () => {
    saveRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsVideoRecording(false);
    setIsCameraModalOpen(false);
    setCameraError("");
    stopCameraStream();
  };

  const applyCapturedFile = (file) => {
    attachEvidence(file);
    closeCameraModal();
  };

  const capturePhoto = () => {
    const video = videoPreviewRef.current;
    if (!video || !streamRef.current) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const cropWidth = sourceRatio > CAMERA_ASPECT_RATIO ? sourceHeight * CAMERA_ASPECT_RATIO : sourceWidth;
    const cropHeight = sourceRatio > CAMERA_ASPECT_RATIO ? sourceHeight : sourceWidth / CAMERA_ASPECT_RATIO;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("We could not capture the photo.");
      return;
    }

    context.drawImage(video,
      (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight,
      0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("We could not capture the photo.");
        return;
      }

      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      applyCapturedFile(file);
    }, "image/jpeg", 0.92);
  };

  const startVideoRecording = async () => {
    try {
      if (!streamRef.current) {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: selectedCameraId
            ? { deviceId: { exact: selectedCameraId }, ...getPortraitVideoConstraints() }
            : { facingMode: { ideal: "environment" }, ...getPortraitVideoConstraints() },
          audio: true,
        });
        streamRef.current = nextStream;
        connectCameraPreview(nextStream);
      }

      const video = videoPreviewRef.current;
      if (!video?.videoWidth || !video?.videoHeight || !HTMLCanvasElement.prototype.captureStream) {
        setCameraError("Camera preview is not ready for portrait video yet. Please try again.");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = video.videoHeight > video.videoWidth
        ? Math.round(canvas.width * video.videoHeight / video.videoWidth)
        : 960;
      const context = canvas.getContext("2d");
      if (!context) {
        setCameraError("We could not prepare portrait video recording.");
        return;
      }

      // Keep the entire camera frame visible inside a portrait recording.
      const drawFrame = () => {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (sourceWidth && sourceHeight) {
          const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
          const width = sourceWidth * scale;
          const height = sourceHeight * scale;
          context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        }
        recordingFrameRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();
      const canvasStream = canvas.captureStream(24);
      recordingCanvasStreamRef.current = canvasStream;
      const recordingStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...streamRef.current.getAudioTracks(),
      ]);
      const mimeType = ["video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported?.(type));
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const shouldSave = saveRecordingRef.current;
        saveRecordingRef.current = false;
        mediaRecorderRef.current = null;
        stopRecordingCanvas();
        if (!shouldSave) return;
        const recordedType = recorder.mimeType || mimeType || "video/webm";
        const extension = recordedType.startsWith("video/mp4") ? "mp4" : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: recordedType });
        if (!blob.size) {
          setCameraError("The recording was empty. Please try again.");
          return;
        }
        applyCapturedFile(new File([blob], `camera-video-${Date.now()}.${extension}`, { type: recordedType }));
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setCameraError("");
      setIsVideoRecording(true);
    } catch (error) {
      stopRecordingCanvas();
      setCameraError("We could not start video recording on this device.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      saveRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      setIsVideoRecording(false);
    }
  };

  const firstRequiredField = () => {
    if (step === 1) {
      if (!formData.violation_type.trim()) return ["violation_type", "Choose a violation type."];
      if (!formData.description.trim()) return ["description", "Enter a description of what you witnessed."];
      if (!formData.date) return ["date", "Choose the date of the violation."];
      if (!formData.time) return ["time", "Choose the time of the violation."];
    }

    if (step === 2) {
      if (!formData.image) return ["image", "Add a photo or video of the violation."];
    }

    if (step === 3) {
      if (!deviceLocation.isReady || !formData.location.trim()) {
        return ["location", "Enable location or select the violation location on the map."];
      }
      if (!formData.reporter_email.trim()) return ["reporter-email", "Enter your email address."];
      if (document.getElementById("reporter-email")?.validity.typeMismatch) {
        return ["reporter-email", "Enter a valid email address."];
      }
      if (!formData.reporter_phone.trim()) return ["reporter-phone", "Enter your phone number."];
    }
    return null;
  };

  const showRequiredField = ([field, message]) => {
    setInvalidField(field);
    setSubmitError(message);
    const target = document.getElementById(field === "image" ? "image-drop-zone" : field);
    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target?.focus?.({ preventScroll: true });
  };

  const goToNextStep = () => {
    const missing = firstRequiredField();
    if (missing) {
      showRequiredField(missing);
      return;
    }

    setSubmitError("");
    setInvalidField("");
    if (step === 2) deviceLocation.startOnEntry?.();
    setStep((current) => Math.min(current + 1, STEP_TITLES.length));
  };

  const goToPreviousStep = () => {
    setSubmitError("");
    setInvalidField("");
    setStep((current) => Math.max(current - 1, 1));
  };

  const requestSubmissionCode = async (captchaToken) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const csrf = await API.get("csrf/", { timeout: 15000 });
      const email = formData.reporter_email.trim().toLowerCase();
      const phone = formData.reporter_phone.trim();
      const { data } = await API.post("submission-email/request/", {
        email, phone, channel: "email", captcha_token: captchaToken,
      }, {
        timeout: 30000, headers: { "X-CSRFToken": csrf.data.csrfToken },
      });
      setEmailChallenge({ ...data, email, phone, receivedAt: Date.now() });
      setShowCaptcha(false);
    } catch (failure) {
      setSubmitError(failure.response?.data?.detail || failure.response?.data?.phone?.[0] ||
        failure.response?.data?.email?.[0] || "Could not send the verification code. Complete the CAPTCHA again and retry.");
    } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (event, emailToken = "") => {
    event?.preventDefault();

    if (step !== 3 || !deviceLocation.isReady ||
        Date.now() - deviceLocation.position.timestamp > 60000) {
      setSubmitError(`${deviceLocation.message} Use Enable / Retry Location above the map, then submit again once location is active.`);
      setInvalidField("location");
      const status = document.getElementById("submit-location-status");
      status?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      status?.focus?.({ preventScroll: true });
      deviceLocation.retry();
      return;
    }

    const missing = firstRequiredField();
    if (missing) {
      showRequiredField(missing);
      return;
    }

    setInvalidField("");

    if (deviceLocation.position.accuracy > MAX_LOCATION_ACCURACY_METERS && !manualPin) {
      setSubmitError("Your device location is approximate. Click or tap the map to confirm the exact violation location, then submit again.");
      return;
    }

    if (!emailToken) {
      setSubmitError("");
      setShowCaptcha(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const payload = new FormData();
    payload.append("email_verification_token", emailToken);
    payload.append("violation_type", formData.violation_type);
    payload.append("occurred_at", new Date(`${formData.date}T${formData.time}:00+08:00`).toISOString());

    const descriptionParts = [
      formData.description,
      formData.plate_number ? `Plate Number: ${formData.plate_number}` : "",
      formData.date ? `Date: ${formData.date}` : "",
      formData.time ? `Time: ${formData.time}` : "",
      formData.reporter_name ? `Reporter Name: ${formData.reporter_name}` : "",
    ].filter(Boolean);

    payload.append("description", descriptionParts.join("\n"));
    payload.append("location", formData.location);
    payload.append("reporter_email", formData.reporter_email.trim());
    payload.append("reporter_phone", formData.reporter_phone.trim());

    payload.append("latitude", reportPosition.latitude.toFixed(6));
    payload.append("longitude", reportPosition.longitude.toFixed(6));
    payload.append("location_source", manualPin ? "manual" : "gps");
    payload.append("reporter_latitude", deviceLocation.position.latitude.toFixed(6));
    payload.append("reporter_longitude", deviceLocation.position.longitude.toFixed(6));
    payload.append("location_accuracy", deviceLocation.position.accuracy);
    payload.append("location_captured_at", new Date(deviceLocation.position.timestamp).toISOString());

    if (formData.image) {
      payload.append("image", formData.image);
    }

    try {
      const csrfResponse = await API.get("csrf/", { timeout: 15000 });
      const csrfToken = csrfResponse?.data?.csrfToken;

      const response = await API.post("reports/", payload, {
        timeout: 60000,
        headers: csrfToken
          ? {
              "X-CSRFToken": csrfToken,
            }
          : undefined,
      });
      const referenceId =
        response?.data?.reference_id ||
        response?.data?.referenceId ||
        (response?.data?.id ? formatReferenceId(response.data.id) : "");

      const finalReferenceId = String(referenceId || formatReferenceId(1));
      setSubmittedReferenceId(finalReferenceId);
      setShowCaptcha(false);
      setEmailChallenge(null);

      try {
        const saved = JSON.parse(localStorage.getItem("hapsaydalan_my_reports") || "[]");
        const newReport = {
          referenceId: finalReferenceId,
          violation_type: formData.violation_type,
          location: formData.location,
          date_reported: new Date().toISOString()
        };
        localStorage.setItem("hapsaydalan_my_reports", JSON.stringify([newReport, ...saved]));
      } catch (err) {
        console.error("Failed to save report to local storage", err);
      }
    } catch (error) {
      const apiError = error?.response?.data;

      if (typeof apiError === "string" && apiError.trim()) {
        setSubmitError(apiError);
        return;
      }

      if (apiError && typeof apiError === "object") {
        const firstMessage = Object.values(apiError).flat()[0];
        if (typeof firstMessage === "string" && firstMessage.trim()) {
          setSubmitError(firstMessage);
          return;
        }
      }

      setSubmitError("We could not submit the report right now. Please try again.");
      return;
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProgress = () => (
    <div className="report-progress-wrap">
      <div className="report-progress-segments">
        {STEP_TITLES.map((title, index) => (
          <div
            key={title}
            className={`report-progress-segment ${index + 1 <= step ? "is-active" : ""}`}
          />
        ))}
      </div>
      <div className="report-progress-label">{`Step ${step} of ${STEP_TITLES.length}`}</div>
    </div>
  );

  const renderInlineStepError = () =>
    submitError && !invalidField ? <div className="report-inline-error" role="alert">{submitError}</div> : null;

  const renderFieldError = (field) => invalidField === field && submitError
    ? <div id={`${field}-error`} className="report-field-error" role="alert">{submitError}</div> : null;

  const renderIncludeIcon = (icon) => {
    if (icon === "ai") {
      return <span className="report-list-icon report-list-icon-dark"><MaterialIcon name="smart_toy" /></span>;
    }

    return <span className="report-list-icon report-list-icon-check"><MaterialIcon name="check" /></span>;
  };

  const renderStepOne = () => (
    <section className="report-card">
      <h2 className="report-card-title">Violation Details</h2>

      <ViolationGuide value={formData.violation_type} onSelect={(value) => {
        setFormData((current) => ({ ...current, violation_type: value }));
        setSubmitError("");
        setInvalidField("");
      }} />

      <label className="report-label" htmlFor="violation_type">
        Type of Violation *
      </label>
      <ResponsiveSelect
        id="violation_type"
        name="violation_type"
        className={`report-input${invalidField === "violation_type" ? " is-invalid" : ""}`}
        value={formData.violation_type}
        onChange={handleChange}
        required
        aria-invalid={invalidField === "violation_type"}
        aria-describedby={invalidField === "violation_type" ? "violation_type-error" : undefined}
      >
        <option value="" disabled hidden>Select violation type</option>
        {VIOLATION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </ResponsiveSelect>
      {renderFieldError("violation_type")}

      <label className="report-label" htmlFor="description">
        Description *
      </label>
      <textarea
        id="description"
        name="description"
        className={`report-input report-textarea${invalidField === "description" ? " is-invalid" : ""}`}
        placeholder="Describe what you witnessed in detail"
        value={formData.description}
        onChange={handleChange}
        aria-invalid={invalidField === "description"}
        aria-describedby={invalidField === "description" ? "description-error" : undefined}
      />
      {renderFieldError("description")}

      <label className="report-label" htmlFor="plate_number">
        License Plate Number (Optional)
      </label>
      <input
        id="plate_number"
        name="plate_number"
        className="report-input"
        placeholder="e.g. AAA 1234"
        value={formData.plate_number}
        onChange={handleChange}
      />

      <div className="report-field-grid">
        <div>
          <label className="report-label" htmlFor="date">
            Date *
          </label>
          <div className={`report-datetime-control${invalidField === "date" ? " is-invalid" : ""}`}>
            <span className={`report-datetime-display${formData.date ? "" : " is-placeholder"}`} aria-hidden="true">
              <span>{formatReportDate(formData.date)}</span>
              <MaterialIcon name="calendar_today" size={18} />
            </span>
            <input
              id="date"
              type="date"
              name="date"
              className="report-datetime-input"
              value={formData.date}
              onChange={handleChange}
              aria-invalid={invalidField === "date"}
              aria-describedby={invalidField === "date" ? "date-error" : undefined}
            />
          </div>
          {renderFieldError("date")}
        </div>
        <div>
          <label className="report-label" htmlFor="time">
            Time *
          </label>
          <div className={`report-datetime-control${invalidField === "time" ? " is-invalid" : ""}`}>
            <span className={`report-datetime-display${formData.time ? "" : " is-placeholder"}`} aria-hidden="true">
              <span>{formatReportTime(formData.time)}</span>
              <MaterialIcon name="schedule" size={18} />
            </span>
            <input
              id="time"
              type="time"
              name="time"
              className="report-datetime-input"
              value={formData.time}
              onChange={handleChange}
              aria-invalid={invalidField === "time"}
              aria-describedby={invalidField === "time" ? "time-error" : undefined}
            />
          </div>
          {renderFieldError("time")}
        </div>
      </div>

      {renderInlineStepError()}

      <div className="report-actions report-actions-right">
        <button type="button" className="report-button report-button-primary" onClick={goToNextStep}>
          Next Step
        </button>
      </div>
    </section>
  );

  const renderStepTwo = () => (
    <section className="report-card">
      <h2 className="report-card-title">Upload Evidence</h2>

      <label className="report-label" htmlFor="image">
        Photos/Videos *
      </label>
      {formData.image ? (
        <div className="report-upload-remove-row">
          <button type="button" className="report-upload-remove" onClick={removeEvidence}
            aria-label="Clear attached photo or video">
            Clear
          </button>
        </div>
      ) : null}
      <label id="image-drop-zone" className={`report-upload-box${invalidField === "image" ? " is-invalid" : ""}`}
        htmlFor="image" tabIndex={-1} aria-invalid={invalidField === "image"}
        aria-describedby={invalidField === "image" ? "image-error" : undefined}>
        {formData.image && uploadedPreviewUrl ? (
          (formData.image.type.startsWith("video/") ||
            ((!formData.image.type || formData.image.type === "application/octet-stream") && videoExtension.test(formData.image.name))) ? (
            <div className="report-upload-preview-wrap">
              <video className="report-upload-preview" src={uploadedPreviewUrl} controls />
              <span className="report-upload-preview-name">{formData.image.name}</span>
            </div>
          ) : (
            <div className="report-upload-preview-wrap">
              <img className="report-upload-preview" src={uploadedPreviewUrl} alt={formData.image.name} />
              <span className="report-upload-preview-name">{formData.image.name}</span>
            </div>
          )
        ) : (
          <>
            <span className="report-upload-icon"><MaterialIcon name="photo_camera" /></span>
            <span className="report-upload-title">Tap to choose a photo or video</span>
            <span className="report-upload-note">Choose one photo or video from your device (up to 50 MB)</span>
          </>
        )}
      </label>
      {renderFieldError("image")}
      <input
        id="image"
        ref={evidenceInputRef}
        type="file"
        accept="image/*,video/*"
        className="report-hidden-input"
        onChange={handleFileChange}
      />
      <input
        id="camera-capture"
        type="button"
        className="report-hidden-input"
      />

      <div className="report-upload-actions">
        <label htmlFor="image" className="report-upload-action">
          Choose Photos/Videos
        </label>
        <button
          type="button"
          className="report-upload-action report-upload-action-primary"
          onClick={openCameraModal}
        >
          Capture Photo/Video
        </button>
      </div>

      <div className="report-tip-box">
        Tip: Clear photos with visible violation and plate number (if safe) help us process your
        report faster. AI analysis works best with well-lit, clear images.
      </div>

      {renderInlineStepError()}

      <div className="report-actions">
        <button type="button" className="report-button report-button-secondary" onClick={goToPreviousStep}>
          Back
        </button>
        <button type="button" className="report-button report-button-primary" onClick={goToNextStep}>
          Next Step
        </button>
      </div>
    </section>
  );

  const renderStepThree = () => (
    <section className="report-card">
      <h2 className="report-card-title">Location &amp; Contact Info</h2>

      <div className="report-map-callout">
        <strong>Location required:</strong> Allow device location access for automatic pinning, or click / tap the map to pin where the violation occurred.
        The blue circle shows your device location. Location access remains required when choosing a pin. Tracking stops after submission or when you leave this step.
      </div>

      <p className="report-contact-note" style={{ marginTop: 12 }}>
        {manualPin ? "Using your selected violation pin. GPS updates will not move it." : "Using your current device location for the violation pin."}
      </p>
      {manualPin ? <button type="button" className="report-button report-button-secondary"
        onClick={() => { setManualPin(null); lastGeocodeRef.current = null; }}>Use My Current Location</button> : null}

      <p id="submit-location-status" className="report-contact-note" role="status" tabIndex={-1} style={{ marginTop: 12 }}>{deviceLocation.message}</p>
      {!deviceLocation.isReady ? <button type="button" className="report-button report-button-secondary"
        onClick={deviceLocation.retry}>Enable / Retry Location</button> : null}
      <div className="report-map-box">
        <div ref={mapContainerRef} className="report-live-map" />
        {isMapLoading ? <div className="report-map-overlay">Loading live map...</div> : null}
        {mapError ? <div className="report-map-overlay report-map-overlay-error">{mapError}</div> : null}
      </div>

      <label className="report-label" htmlFor="location">
        Violation Location *
      </label>
      <input
        id="location"
        name="location"
        className={`report-input${invalidField === "location" ? " is-invalid" : ""}`}
        placeholder="Waiting for device location..."
        value={formData.location}
        readOnly
        required
        aria-invalid={invalidField === "location"}
        aria-describedby={invalidField === "location" ? "location-error" : undefined}
      />
      {renderFieldError("location")}
      {formData.latitude && formData.longitude ? (
        <div className="report-contact-note">
          Coordinates saved: {formData.latitude}, {formData.longitude}
        </div>
      ) : null}

      <div className="report-contact-heading">
        Contact Information (Email required)
      </div>
      <input
        name="reporter_name"
        className="report-input"
        placeholder="Your name (optional)"
        value={formData.reporter_name}
        onChange={handleChange}
      />
      <label className="report-contact-note" htmlFor="reporter-email">Email address *</label>
      <input
        id="reporter-email"
        name="reporter_email"
        type="email"
        required
        maxLength={254}
        autoComplete="email"
        className={`report-input${invalidField === "reporter-email" ? " is-invalid" : ""}`}
        placeholder="Email address"
        value={formData.reporter_email}
        onChange={handleChange}
        aria-invalid={invalidField === "reporter-email"}
        aria-describedby={invalidField === "reporter-email" ? "reporter-email-error" : undefined}
      />
      {renderFieldError("reporter-email")}
      <label className="report-contact-note" htmlFor="reporter-phone">Phone number *</label>
      <input
        id="reporter-phone"
        name="reporter_phone"
        type="tel"
        required
        maxLength={24}
        inputMode="tel"
        autoComplete="tel"
        className={`report-input${invalidField === "reporter-phone" ? " is-invalid" : ""}`}
        placeholder="09XX XXX XXXX or +63 9XX XXX XXXX"
        value={formData.reporter_phone}
        onChange={handleChange}
        aria-invalid={invalidField === "reporter-phone"}
        aria-describedby={invalidField === "reporter-phone" ? "reporter-phone-error" : undefined}
      />
      {renderFieldError("reporter-phone")}
      <div className="report-contact-note">
        Your phone number is required so the admin can contact you about your report. A verification code will be sent to your email.
      </div>

      {renderInlineStepError()}

      <div className="report-actions report-actions-right">
        <button type="submit" className="report-button report-button-primary" disabled={isSubmitting}
          aria-describedby={!deviceLocation.isReady ? "submit-location-status" : undefined}>
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </button>
      </div>
    </section>
  );

  const renderSuccessState = () => (
    <section ref={successCardRef} className="report-success-card" tabIndex={-1} aria-labelledby="report-success-title">
      <div className="report-success-icon"><MaterialIcon name="check_circle" /></div>
      <h2 id="report-success-title" className="report-success-title">Report Submitted Successfully!</h2>
      <p className="report-success-text">
        Thank you for helping keep Surigao City safe. Your report is Pending Verification.
        It will appear on the public hotspot map after admin approval. You can track its status using your reference ID.
      </p>

      <div className="report-reference-box">
        <div className="report-reference-label">Your Reference ID:</div>
        <div className="report-reference-value">{submittedReferenceId}</div>
        <div className="report-reference-help">
          Save this ID to track your report. {formData.reporter_email
            ? "Forgot it? Verify your email on Track My Report to find your reports."
            : "Without an email address, you will need this ID to track your report."}
        </div>
      </div>

      <div className="report-actions report-actions-center">
        <button
          type="button"
          className="report-button report-button-secondary"
          onClick={() => {
            setSubmittedReferenceId("");
            setManualPin(null);
            setStep(1);
            setSubmitError("");
            setFormData({
              violation_type: "",
              description: "",
              plate_number: "",
              date: "",
              time: "",
              image: null,
              location: "",
              reporter_name: "",
              reporter_email: "",
              reporter_phone: "",
            });
          }}
        >
          Submit Another Report
        </button>
        <a
          href={`/track?referenceId=${encodeURIComponent(submittedReferenceId)}`}
          className="report-button report-button-primary report-link-button"
        >
          Track My Report
        </a>
      </div>
    </section>
  );

  const renderCameraModal = () => (
    isCameraModalOpen ? (
      <div className="report-camera-modal-backdrop" role="dialog" aria-modal="true">
        <div className="report-camera-modal">
          <div className="report-camera-header">
            <h3 className="report-camera-title">Capture Photo or Video</h3>
            <button type="button" className="report-camera-close" onClick={closeCameraModal}>
              Close
            </button>
          </div>

          <div className="report-camera-toolbar">
            <div className="report-camera-mode-group">
              <button
                type="button"
                className={`report-camera-mode ${captureMode === "photo" ? "is-active" : ""}`}
                onClick={() => setCaptureMode("photo")}
                disabled={isVideoRecording}
              >
                Photo
              </button>
              <button
                type="button"
                className={`report-camera-mode ${captureMode === "video" ? "is-active" : ""}`}
                onClick={() => setCaptureMode("video")}
                disabled={isVideoRecording}
              >
                Video
              </button>
            </div>

            <ResponsiveSelect
              className="report-camera-select"
              value={selectedCameraId}
              onChange={(event) => switchCamera(event.target.value)}
              disabled={isVideoRecording}
            >
              {cameraDevices.length ? (
                cameraDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default camera</option>
              )}
            </ResponsiveSelect>
          </div>

          <div className="report-camera-preview-shell">
            <video
              ref={videoPreviewRef}
              className={`report-camera-preview${captureMode === "video" ? " is-video" : ""}`}
              autoPlay
              playsInline
              muted
            />
            {isCameraLoading ? <div className="report-camera-overlay">Opening camera...</div> : null}
          </div>

          {cameraError ? <div className="report-camera-error">{cameraError}</div> : null}

          <div className="report-camera-actions">
            <button type="button" className="report-button report-button-secondary" onClick={closeCameraModal}>
              Cancel
            </button>
            {captureMode === "photo" ? (
              <button type="button" className="report-button report-button-primary" onClick={capturePhoto}>
                Take Photo
              </button>
            ) : isVideoRecording ? (
              <button type="button" className="report-button report-button-stop" onClick={stopVideoRecording}>
                Stop Recording
              </button>
            ) : (
              <button type="button" className="report-button report-button-primary" onClick={startVideoRecording}>
                Start Video Recording
              </button>
            )}
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .report-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 18%, rgba(90, 127, 255, 0.34) 0, rgba(90, 127, 255, 0.34) 14%, transparent 36%),
            radial-gradient(circle at 84% 14%, rgba(191, 174, 255, 0.28) 0, transparent 26%),
            radial-gradient(circle at 16% 90%, rgba(200, 212, 255, 0.5) 0, transparent 30%),
            linear-gradient(135deg, #dfe7ff 0%, #f7f8ff 44%, #e7e9ff 100%);
          font-family: 'Inter', sans-serif;
          color: #111827;
        }

        .report-hero {
          text-align: center;
          padding: 70px 24px 92px;
          background:
            linear-gradient(90deg, rgba(105, 148, 255, 0.16) 0%, rgba(255, 255, 255, 0.74) 48%, rgba(200, 188, 255, 0.2) 100%);
          backdrop-filter: blur(8px);
        }

        .report-hero-title {
          margin: 0 0 16px;
          font-size: clamp(42px, 5.2vw, 60px);
          line-height: 1.08;
          font-weight: 800;
          color: #0b0b0b;
        }

        .report-hero-text {
          margin: 0 auto;
          max-width: 860px;
          font-size: 17px;
          line-height: 1.55;
          color: #5b6472;
        }

        .report-shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px 72px;
        }

        .report-progress-wrap {
          max-width: 700px;
          margin: 56px auto 36px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .report-progress-segments {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          justify-content: center;
        }

        .report-progress-segment {
          height: 8px;
          border-radius: 999px;
          background: #dfe4ea;
        }

        .report-progress-segment.is-active {
          background: #003d7f;
        }

        .report-progress-label {
          margin-top: 12px;
          font-size: 16px;
          line-height: 1.2;
          color: #5b6472;
          text-align: center;
        }

        .report-card {
          max-width: 760px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(221, 229, 243, 0.95);
          border-radius: 16px;
          box-shadow: 0 18px 38px rgba(90, 108, 166, 0.12);
          padding: 30px;
        }

        .report-card-title {
          margin: 0 0 36px;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }

        .report-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }

        .report-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9dee6;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: #111827;
          background: #ffffff;
          margin-bottom: 16px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .report-input:focus {
          border-color: #003d7f;
          box-shadow: 0 0 0 3px rgba(0, 61, 127, 0.12);
        }

        .report-textarea {
          min-height: 120px;
          resize: vertical;
        }

        .report-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .report-field-grid > div {
          min-width: 0;
        }

        .report-datetime-control {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          min-height: 46px;
          box-sizing: border-box;
          overflow: hidden;
          margin-bottom: 16px;
          padding: 0 14px;
          border: 1px solid #d9dee6;
          border-radius: 10px;
          background: #ffffff;
        }

        .report-datetime-control:focus-within {
          border-color: #003d7f;
          box-shadow: 0 0 0 3px rgba(0, 61, 127, 0.12);
        }

        .report-datetime-input {
          position: absolute;
          inset: 0;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          height: 100%;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          border: 0;
          outline: 0;
          opacity: 0;
          cursor: pointer;
        }

        .report-datetime-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          min-width: 0;
          color: #111827;
          font-size: 16px;
          line-height: 1.5;
          pointer-events: none;
        }

        .report-datetime-display.is-placeholder {
          color: #6b7280;
        }

        .report-datetime-display .material-icon {
          flex: 0 0 auto;
          color: #4a6384;
        }

        .report-button-stop {
          background: #ff5a52;
          color: #ffffff;
          padding-inline: 18px;
        }

        .report-upload-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 172px;
          border: 1px dashed #d4dbe4;
          border-radius: 18px;
          background: #ffffff;
          text-align: center;
          cursor: pointer;
          padding: 24px;
          margin-bottom: 14px;
        }

        .report-upload-preview-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .report-upload-preview {
          width: min(100%, 520px);
          max-height: 260px;
          object-fit: contain;
          border-radius: 12px;
          background: #f8fafc;
        }

        .report-upload-preview-wrap video {
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: min(60dvh, 520px);
        }

        .report-upload-preview-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          text-align: center;
          word-break: break-word;
        }

        .report-upload-remove-row {
          display: flex;
          justify-content: flex-end;
          margin: -2px 0 8px;
        }

        .report-upload-remove {
          min-height: 40px;
          border: 1px solid #bfccd9;
          border-radius: 10px;
          background: #ffffff;
          color: #9f2432;
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .report-upload-remove:hover,
        .report-upload-remove:focus-visible {
          border-color: #9f2432;
          background: #fff3f4;
        }

        .report-upload-icon {
          font-size: 36px;
          color: #6b7280;
        }

        .report-upload-title {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }

        .report-upload-note {
          font-size: 14px;
          color: #6b7280;
        }

        .report-upload-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .report-upload-action {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border: 1px solid #d4dbe4;
          border-radius: 10px;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease;
        }

        .report-upload-action:hover {
          transform: translateY(-1px);
        }

        .report-upload-action-primary {
          background: #003d7f;
          border-color: #003d7f;
          color: #ffffff;
        }

        .report-camera-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1100;
        }

        .report-camera-modal {
          width: min(100%, 760px);
          background: #ffffff;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25);
        }

        .report-camera-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .report-camera-title {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }

        .report-camera-close {
          border: 1px solid #d4dbe4;
          background: #ffffff;
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .report-camera-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .report-camera-mode-group {
          display: flex;
          gap: 8px;
        }

        .report-camera-mode {
          border: 1px solid #d4dbe4;
          background: #ffffff;
          color: #0f172a;
          border-radius: 999px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .report-camera-mode.is-active {
          background: #003d7f;
          border-color: #003d7f;
          color: #ffffff;
        }

        .report-camera-select {
          min-width: 220px;
          border: 1px solid #d4dbe4;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
        }

        .report-camera-preview-shell {
          position: relative;
          width: min(100%, 300px, 36dvh);
          border-radius: 16px;
          overflow: hidden;
          background: #0f172a;
          aspect-ratio: 3 / 4;
          margin: 0 auto 14px;
        }

        .report-camera-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .report-camera-preview.is-video {
          object-fit: contain;
          background: #0f172a;
        }

        .report-camera-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.38);
          color: #ffffff;
          font-weight: 600;
        }

        .report-camera-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          margin-bottom: 14px;
        }

        .report-camera-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .report-hidden-input {
          display: none;
        }

        .report-tip-box {
          border-radius: 12px;
          background: #fbf8d7;
          color: #3f3a22;
          font-size: 14px;
          line-height: 1.6;
          padding: 14px 16px;
          margin-bottom: 22px;
        }

        .report-map-callout {
          border-radius: 8px;
          background: #e6edf5;
          color: #314155;
          font-size: 13px;
          padding: 10px 12px;
          margin-bottom: 10px;
        }

        .report-map-box {
          position: relative;
          min-height: 300px;
          border-radius: 10px;
          overflow: hidden;
          background: #d9d9d9;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          margin-bottom: 20px;
        }

        .report-live-map {
          width: 100%;
          height: 300px;
          display: block;
          pointer-events: auto;
          touch-action: none;
        }

        .report-live-map .leaflet-control-container .leaflet-top,
        .report-live-map .leaflet-control-container .leaflet-bottom {
          z-index: 500;
        }

        .report-live-map .leaflet-control-zoom {
          margin: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
        }

        .report-live-map .leaflet-control-zoom a {
          width: 34px;
          height: 34px;
          line-height: 34px;
          font-size: 22px;
        }

        .report-live-map .leaflet-control-attribution {
          margin: 0 8px 8px 0;
          font-size: 10px;
          max-width: calc(100% - 16px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .report-map-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.18);
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          text-align: center;
          padding: 18px;
        }

        .report-map-overlay-error {
          background: rgba(185, 28, 28, 0.72);
        }

        .report-contact-heading {
          margin: 8px 0 10px;
          font-size: 13px;
          color: #475569;
        }

        .report-contact-note {
          margin-top: -4px;
          font-size: 12px;
          color: #6b7280;
        }

        .report-verification-choice {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 20px;
          margin: 14px 0 8px;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          color: #17233a;
        }

        .report-verification-choice legend {
          padding: 0 5px;
          font-size: 13px;
          font-weight: 700;
        }

        .report-verification-choice label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .report-verification-choice input {
          width: 18px;
          height: 18px;
          accent-color: #0750a4;
        }

        .report-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 22px;
        }

        .report-actions-right {
          justify-content: flex-end;
        }

        .report-actions-center {
          justify-content: center;
        }

        .report-button {
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.12s ease, opacity 0.12s ease, background 0.12s ease;
        }

        .report-button:hover {
          transform: translateY(-1px);
        }

        .report-button:disabled {
          cursor: wait;
          opacity: 0.7;
          transform: none;
        }

        .report-button-primary {
          background: #003d7f;
          color: #ffffff;
        }

        .report-button-secondary {
          border-color: #d4dbe4;
          background: #ffffff;
          color: #0f172a;
        }

        .report-link-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .report-error {
          max-width: 760px;
          margin: 0 auto 16px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
        }

        .report-inline-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          margin-top: 4px;
        }

        .report-field-error {
          color: #b42318;
          font-size: 14px;
          font-weight: 600;
          margin: -8px 0 16px;
        }

        .report-card :is(.report-input, .report-datetime-input, .report-upload-box, #submit-location-status) {
          scroll-margin-top: 100px;
        }

        .report-card :is(.report-input, .report-datetime-control, .report-upload-box).is-invalid,
        .report-card :is(.report-input, .report-datetime-control, .report-upload-box).is-invalid:focus,
        .report-card .report-datetime-control.is-invalid:focus-within {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.14);
        }

        .report-info-strip {
          margin-top: 62px;
          background: rgba(255, 255, 255, 0.62);
          backdrop-filter: blur(8px);
          padding: 58px 24px;
        }

        .report-info-grid {
          max-width: 760px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 42px;
        }

        .report-info-title {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .report-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .report-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 14px;
          line-height: 1.45;
          color: #475569;
        }

        .report-list-icon {
          width: 18px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
          margin-top: 2px;
        }

        .report-list-icon-check {
          color: #003d7f;
          font-weight: 700;
        }

        .report-list-icon-dark {
          font-size: 15px;
        }

        .report-list-text {
          flex: 1;
        }

        .report-list-new {
          font-weight: 700;
        }

        .report-list-number {
          width: 18px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #003d7f;
          font-weight: 700;
          margin-top: 1px;
        }

        .report-success-card {
          max-width: 760px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 28px 30px;
          text-align: center;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);
        }

        .report-success-icon {
          font-size: 54px;
          line-height: 1;
          color: #111827;
          margin-bottom: 10px;
        }

        .report-success-title {
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 800;
        }

        .report-success-text {
          margin: 0 0 14px;
          font-size: 14px;
          color: #5f6b7a;
        }

        .report-reference-box {
          max-width: 420px;
          margin: 0 auto 18px;
          border-radius: 8px;
          background: #e6edf5;
          padding: 14px;
        }

        .report-reference-label,
        .report-reference-help {
          font-size: 12px;
          color: #5b6472;
        }

        .report-reference-value {
          margin: 8px 0 6px;
          font-size: 28px;
          font-weight: 800;
          color: #003d7f;
          letter-spacing: 0.03em;
        }

        .report-footer {
          background: #003D7F;
          padding: 56px 24px 0;
          color: #b8c8e0;
          font-size: 14px;
        }

        .report-footer-spacer {
          height: 60px;
          background: #ffffff;
        }

        .report-footer-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.4fr;
          gap: 40px;
          padding-bottom: 40px;
        }

        .report-footer-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 14px;
        }

        .report-footer-about {
          line-height: 1.7;
        }

        .report-footer-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .report-footer-links li a {
          color: #b8c8e0;
          text-decoration: none;
          transition: color 0.15s;
        }

        .report-footer-links li a:hover {
          color: #fff;
        }

        .report-footer-contact {
          line-height: 1.9;
        }

        .report-footer-bottom {
          max-width: 1100px;
          margin: 0 auto;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 20px 0;
          font-size: 13px;
          color: #8fa3be;
          text-align: center;
        }

        @media (max-width: 768px) {
          .report-hero {
            padding: 56px 20px 72px;
          }

          .report-progress-wrap {
            max-width: 520px;
            margin-top: 40px;
          }

          .report-card,
          .report-success-card {
            padding: 22px;
          }

          .report-map-box {
            min-height: 240px;
          }

          .report-live-map {
            height: 240px;
          }

          .report-live-map .leaflet-control-zoom {
            margin: 10px;
          }

          .report-live-map .leaflet-control-zoom a {
            width: 30px;
            height: 30px;
            line-height: 30px;
            font-size: 18px;
          }

          .report-live-map .leaflet-control-attribution {
            font-size: 9px;
            max-width: calc(100% - 12px);
          }

          .report-field-grid,
          .report-info-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .report-footer-grid {
            grid-template-columns: 1fr 1fr;
          }

          .report-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .report-upload-actions {
            flex-direction: column;
          }

          .report-camera-toolbar,
          .report-camera-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .report-camera-select {
            min-width: 0;
            width: 100%;
          }

          .report-actions-right {
            align-items: stretch;
          }
        }

        @media (max-width: 560px) {
          .report-footer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="report-page">
        <Navbar currentPage="report" />

        <header className="report-hero">
          <h1 className="report-hero-title">Report a Traffic Violation</h1>
          <p className="report-hero-text">
            Help keep Surigao City safe. Submit your report with evidence and details below.
            Your contribution matters.
          </p>
        </header>

        <main className="report-shell">
          {submittedReferenceId ? (
            renderSuccessState()
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {renderProgress()}
              {step === 1 ? renderStepOne() : null}
              {step === 2 ? renderStepTwo() : null}
              {step === 3 ? renderStepThree() : null}
            </form>
          )}
        </main>

        <section className="report-info-strip">
          <div className="report-info-grid">
            <div>
              <h3 className="report-info-title">What to Include</h3>
              <ul className="report-list">
                {WHAT_TO_INCLUDE.map((item) => (
                  <li key={item.text}>
                    {renderIncludeIcon(item.icon)}
                    <span className="report-list-text">
                      {item.text.startsWith("New:") ? (
                        <>
                          <span className="report-list-new">New:</span>
                          {item.text.slice(4)}
                        </>
                      ) : (
                        item.text
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="report-info-title">What Happens Next</h3>
              <ul className="report-list">
                {WHAT_HAPPENS_NEXT.map((item, index) => (
                  <li key={item}>
                    <span className="report-list-number">{index + 1}</span>
                    <span className="report-list-text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="report-footer-spacer" />

        <footer className="report-footer">
          <div className="report-footer-grid">
            <div>
              <div className="report-footer-col-title">About</div>
              <p className="report-footer-about">
                Together, we keep Surigao City's roads safe. Report violations and help achieve
                faster CTMO response.
              </p>
            </div>
            <div>
              <div className="report-footer-col-title">Quick Links</div>
              <ul className="report-footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/report">Report a Violation</a></li>
                <li><a href="/#track">Track My Report</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="report-footer-col-title">Support</div>
              <ul className="report-footer-links">
                <li><a href="/faqs">FAQs</a></li>
                <li><a href="/contact">Contact/Help</a></li>
                <li><a href="/#privacy">Privacy Policy</a></li>
                <li><a href="/#terms">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <div className="report-footer-col-title">Contact CTMO</div>
              <p className="report-footer-contact">
                Surigao City Traffic Management Office<br />
                Phone: (086) 231-9999<br />
                Hours: 8AM - 5PM (Mon-Fri)
              </p>
            </div>
          </div>
          <div className="report-footer-bottom">
            <span>© 2026 Surigao City Traffic Reports. All rights reserved.</span>
          </div>
        </footer>
        {renderCameraModal()}
        {showCaptcha ? <ReportCaptcha busy={isSubmitting} submissionError={submitError}
          canSubmit={deviceLocation.isReady && (deviceLocation.position.accuracy <= MAX_LOCATION_ACCURACY_METERS || !!manualPin)}
          onClose={() => { if (!isSubmitting) setShowCaptcha(false); }}
          confirmLabel="Send Verification Code" busyLabel="Sending code..."
          message="Complete the CAPTCHA to receive a verification code by email. Your report will be submitted after you verify the code."
          onConfirm={requestSubmissionCode} /> : null}
        {emailChallenge ? <SubmissionEmailVerification key={emailChallenge.challenge_id} challenge={emailChallenge}
          busy={isSubmitting} submissionError={submitError}
          canSubmit={deviceLocation.isReady && (deviceLocation.position.accuracy <= MAX_LOCATION_ACCURACY_METERS || !!manualPin)}
          onClose={() => { if (!isSubmitting) { setEmailChallenge(null); setSubmitError(""); } }}
          onResend={() => { setEmailChallenge(null); setSubmitError(""); setShowCaptcha(true); }}
          onConfirm={(token) => handleSubmit(null, token)} /> : null}
      </div>
    </>
  );
}

export default ReportForm;
