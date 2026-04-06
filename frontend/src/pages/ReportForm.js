import React, { useEffect, useRef, useState } from "react";
import Navbar from "../components/reusablecode/Navbar";
import API from "../services/api";

const STEP_TITLES = [
  "Violation Details",
  "Upload Evidence",
  "Location & Contact Info",
];

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

const WHAT_TO_INCLUDE = [
  { icon: "check", text: "Clear photos or videos of the violation" },
  { icon: "check", text: "License plate number (if visible)" },
  { icon: "check", text: "Date, time, and exact location" },
  { icon: "check", text: "Detailed description of the violation" },
  { icon: "voice", text: "New: Use voice recording to submit your description hands-free" },
  { icon: "ai", text: "New: AI image analysis automatically detects violation type from your photos" },
];

const WHAT_HAPPENS_NEXT = [
  "Your report is received and assigned a reference ID",
  "CTMO reviews and verifies the evidence",
  "Case is assigned to an officer for action",
  "You receive updates via your reference ID",
];

const formatReferenceId = (value) => `SUP-${String(value).padStart(3, "0")}`;
const DEFAULT_MAP_CENTER = { lat: 9.7843, lng: 125.4888 };
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
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedReferenceId, setSubmittedReferenceId] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [voiceError, setVoiceError] = useState("");
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

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    stopCameraStream();
  }, []);

  useEffect(() => {
    if (videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
    }
  }, [isCameraModalOpen, selectedCameraId]);

  useEffect(() => {
    if (step !== 3) {
      return undefined;
    }

    if (!mapContainerRef.current) {
      return undefined;
    }

    let isCancelled = false;

    const initializeMap = async () => {
      setIsMapLoading(true);
      setMapError("");

      try {
        const L = await loadLeafletAssets();
        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        if (!mapInstanceRef.current) {
          mapContainerRef.current.innerHTML = "";
          const southWest = L.latLng(SURIGAO_CITY_BOUNDS.south, SURIGAO_CITY_BOUNDS.west);
          const northEast = L.latLng(SURIGAO_CITY_BOUNDS.north, SURIGAO_CITY_BOUNDS.east);
          const bounds = L.latLngBounds(southWest, northEast);

          mapInstanceRef.current = L.map(mapContainerRef.current, {
            center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
            zoom: 15,
            minZoom: 14,
            maxZoom: 18,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0,
          });

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(mapInstanceRef.current);

          mapInstanceRef.current.fitBounds(bounds);

          mapMarkerRef.current = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], {
            draggable: false,
          });
          mapMarkerRef.current.addTo(mapInstanceRef.current);

          mapInstanceRef.current.on("click", async (event) => {
            const clickedPosition = {
              lat: event.latlng.lat,
              lng: event.latlng.lng,
            };

            const isInsideSurigaoCity =
              clickedPosition.lat >= SURIGAO_CITY_BOUNDS.south &&
              clickedPosition.lat <= SURIGAO_CITY_BOUNDS.north &&
              clickedPosition.lng >= SURIGAO_CITY_BOUNDS.west &&
              clickedPosition.lng <= SURIGAO_CITY_BOUNDS.east;

            if (!isInsideSurigaoCity) {
              setMapError("Please select a location within Surigao City only.");
              return;
            }

            setMapError("");

            mapMarkerRef.current.setLatLng([clickedPosition.lat, clickedPosition.lng]);
            mapInstanceRef.current.panTo([clickedPosition.lat, clickedPosition.lng]);

            const fallbackLocation = `${clickedPosition.lat.toFixed(6)}, ${clickedPosition.lng.toFixed(6)}`;

            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${clickedPosition.lat}&lon=${clickedPosition.lng}`
              );
              const data = await response.json();
              const resolvedAddress = data?.display_name || fallbackLocation;
              setFormData((current) => ({
                ...current,
                location: resolvedAddress,
              }));
            } catch (error) {
              setFormData((current) => ({
                ...current,
                location: fallbackLocation,
              }));
            }
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setMapError("We could not load the live map right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsMapLoading(false);
        }
      }
    };

    initializeMap();

    return () => {
      isCancelled = true;
    };
  }, [step]);

  useEffect(() => () => {
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
  }, [uploadedPreviewUrl]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSubmitError("");
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
      setUploadedPreviewUrl("");
    }

    const previewUrl = file ? URL.createObjectURL(file) : "";
    setSubmitError("");
    setUploadedPreviewUrl(previewUrl);
    setFormData((current) => ({
      ...current,
      image: file,
    }));
  };

  const handleUseTranscribedText = () => {
    if (!voiceTranscript.trim()) {
      return;
    }

    setFormData((current) => ({
      ...current,
      description: voiceTranscript.trim(),
    }));
    setVoiceDraft("");
    setVoiceTranscript("");
    setVoiceError("");
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
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = initialStream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = initialStream;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(videoInputs);
      setSelectedCameraId(videoInputs[0]?.deviceId ?? "");
    } catch (error) {
      setCameraError("We could not access your device camera. Please allow camera permission.");
      setIsCameraModalOpen(false);
      stopCameraStream();
    } finally {
      setIsCameraLoading(false);
    }
  };

  const switchCamera = async (deviceId) => {
    if (!deviceId) {
      return;
    }

    setSelectedCameraId(deviceId);
    setCameraError("");
    setIsCameraLoading(true);

    try {
      stopCameraStream();
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
        },
        audio: captureMode === "video",
      });

      streamRef.current = nextStream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = nextStream;
      }
    } catch (error) {
      setCameraError("We could not switch to that camera.");
    } finally {
      setIsCameraLoading(false);
    }
  };

  const closeCameraModal = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsVideoRecording(false);
    setIsCameraModalOpen(false);
    setCameraError("");
    stopCameraStream();
  };

  const applyCapturedFile = (file) => {
    setSubmitError("");
    setFormData((current) => ({
      ...current,
      image: file,
    }));
    closeCameraModal();
  };

  const capturePhoto = () => {
    const video = videoPreviewRef.current;
    if (!video || !streamRef.current) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("We could not capture the photo.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
          video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
          audio: true,
        });
        streamRef.current = nextStream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = nextStream;
        }
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: "video/webm",
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const file = new File([blob], `camera-video-${Date.now()}.webm`, {
          type: "video/webm",
        });
        applyCapturedFile(file);
      };

      mediaRecorderRef.current = recorder;
      setIsVideoRecording(true);
      recorder.start();
    } catch (error) {
      setCameraError("We could not start video recording on this device.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsVideoRecording(false);
    }
  };

  const handleDiscardTranscript = () => {
    setVoiceDraft("");
    setVoiceTranscript("");
    setVoiceError("");
  };

  const handleStartVoiceRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Voice transcription is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    let latestTranscript = "";
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcriptPart = event.results[index][0]?.transcript ?? "";

        if (event.results[index].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      latestTranscript = (finalTranscript || interimTranscript).trim();
      setVoiceDraft(latestTranscript);
      if (finalTranscript.trim()) {
        setVoiceTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = () => {
      setVoiceError("We could not capture your voice. Please try again.");
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (latestTranscript) {
        setVoiceTranscript(latestTranscript);
      }
    };

    recognitionRef.current = recognition;
    setVoiceDraft("");
    setVoiceTranscript("");
    setVoiceError("");
    setIsRecording(true);
    recognition.start();
  };

  const handleStopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const validateStep = () => {
    if (step === 1) {
      return Boolean(
        formData.violation_type.trim() &&
        formData.description.trim() &&
        formData.date &&
        formData.time
      );
    }

    if (step === 2) {
      return Boolean(formData.image);
    }

    return Boolean(formData.location.trim());
  };

  const goToNextStep = () => {
    if (!validateStep()) {
      setSubmitError("Please complete the required fields before continuing.");
      return;
    }

    setSubmitError("");
    setStep((current) => Math.min(current + 1, STEP_TITLES.length));
  };

  const goToPreviousStep = () => {
    setSubmitError("");
    setStep((current) => Math.max(current - 1, 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateStep()) {
      setSubmitError("Please complete the required fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const payload = new FormData();
    payload.append("violation_type", formData.violation_type);

    const descriptionParts = [
      formData.description,
      formData.plate_number ? `Plate Number: ${formData.plate_number}` : "",
      formData.date ? `Date: ${formData.date}` : "",
      formData.time ? `Time: ${formData.time}` : "",
      formData.reporter_name ? `Reporter Name: ${formData.reporter_name}` : "",
      formData.reporter_email ? `Reporter Email: ${formData.reporter_email}` : "",
      formData.reporter_phone ? `Reporter Phone: ${formData.reporter_phone}` : "",
    ].filter(Boolean);

    payload.append("description", descriptionParts.join("\n"));
    payload.append("location", formData.location);

    if (formData.image) {
      payload.append("image", formData.image);
    }

    try {
      const response = await API.post("reports/", payload);
      const referenceId =
        response?.data?.reference_id ||
        response?.data?.referenceId ||
        (response?.data?.id ? formatReferenceId(response.data.id) : "");

      setSubmittedReferenceId(String(referenceId || formatReferenceId(1)));
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
    submitError ? <div className="report-inline-error">{submitError}</div> : null;

  const renderIncludeIcon = (icon) => {
    if (icon === "voice") {
      return <span className="report-list-icon report-list-icon-dark">🎤</span>;
    }

    if (icon === "ai") {
      return <span className="report-list-icon report-list-icon-dark">🤖</span>;
    }

    return <span className="report-list-icon report-list-icon-check">✓</span>;
  };

  const renderStepOne = () => (
    <section className="report-card">
      <h2 className="report-card-title">Violation Details</h2>

      <label className="report-label" htmlFor="violation_type">
        Type of Violation *
      </label>
      <select
        id="violation_type"
        name="violation_type"
        className="report-input"
        value={formData.violation_type}
        onChange={handleChange}
      >
        {VIOLATION_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label className="report-label" htmlFor="description">
        Description *
      </label>
      <textarea
        id="description"
        name="description"
        className="report-input report-textarea"
        placeholder="Describe what you witnessed in detail or use voice recording below"
        value={formData.description}
        onChange={handleChange}
      />

      <div className="report-voice-box">
        <div className="report-voice-header">
          <span className="report-voice-title">Voice Recording</span>
          <span className="report-voice-note">Optional: Record your report</span>
        </div>
        {isRecording ? (
          <div className="report-voice-recording-row">
            <div className="report-voice-status">
              <span className="report-voice-dot" />
              <span>Recording...</span>
            </div>
            <button
              type="button"
              className="report-button report-button-stop"
              onClick={handleStopVoiceRecording}
            >
              Stop
            </button>
          </div>
        ) : voiceTranscript || voiceDraft ? (
          <>
            <div className="report-transcript-box">
              <div className="report-transcript-label">Transcribed text:</div>
              <div className="report-transcript-text">{voiceTranscript || voiceDraft}</div>
            </div>
            <div className="report-voice-actions">
              <button
                type="button"
                className="report-button report-button-primary report-voice-action"
                onClick={handleUseTranscribedText}
              >
                Use This Text
              </button>
              <button
                type="button"
                className="report-button report-button-secondary report-voice-action"
                onClick={handleDiscardTranscript}
              >
                Discard
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="report-voice-button"
            onClick={handleStartVoiceRecording}
          >
            Start Voice Recording
          </button>
        )}
        {voiceError ? <div className="report-voice-error">{voiceError}</div> : null}
      </div>

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
          <input
            id="date"
            type="date"
            name="date"
            className="report-input"
            value={formData.date}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="report-label" htmlFor="time">
            Time *
          </label>
          <input
            id="time"
            type="time"
            name="time"
            className="report-input"
            value={formData.time}
            onChange={handleChange}
          />
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
      <label className="report-upload-box" htmlFor="image">
        {formData.image && uploadedPreviewUrl ? (
          formData.image.type.startsWith("video/") ? (
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
            <span className="report-upload-icon">[ camera ]</span>
            <span className="report-upload-title">Click to upload or drag and drop</span>
            <span className="report-upload-note">PNG, JPG, MP4 up to 50MB</span>
          </>
        )}
      </label>
      <input
        id="image"
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
          Choose File
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
        <strong>Location:</strong> Mark the location on the map where the violation occurred.
      </div>
      <div className="report-map-box">
        <div ref={mapContainerRef} className="report-live-map" />
        {isMapLoading ? <div className="report-map-overlay">Loading live map...</div> : null}
        {mapError ? <div className="report-map-overlay report-map-overlay-error">{mapError}</div> : null}
      </div>

      <label className="report-label" htmlFor="location">
        Exact Location *
      </label>
      <input
        id="location"
        name="location"
        className="report-input"
        placeholder="Street, landmark, or area"
        value={formData.location}
        onChange={handleChange}
      />

      <div className="report-contact-heading">
        Contact Information (Optional - helps us follow up)
      </div>
      <input
        name="reporter_name"
        className="report-input"
        placeholder="Your name"
        value={formData.reporter_name}
        onChange={handleChange}
      />
      <input
        name="reporter_email"
        type="email"
        className="report-input"
        placeholder="Email address"
        value={formData.reporter_email}
        onChange={handleChange}
      />
      <input
        name="reporter_phone"
        className="report-input"
        placeholder="Phone number"
        value={formData.reporter_phone}
        onChange={handleChange}
      />
      <div className="report-contact-note">
        Your contact info is private and only used for case follow-up.
      </div>

      {renderInlineStepError()}

      <div className="report-actions">
        <button type="button" className="report-button report-button-secondary" onClick={goToPreviousStep}>
          Back
        </button>
        <button type="submit" className="report-button report-button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </button>
      </div>
    </section>
  );

  const renderSuccessState = () => (
    <section className="report-success-card">
      <div className="report-success-icon">✓</div>
      <h2 className="report-success-title">Report Submitted Successfully!</h2>
      <p className="report-success-text">
        Thank you for helping keep Surigao City safe. Your report has been recorded.
      </p>

      <div className="report-reference-box">
        <div className="report-reference-label">Your Reference ID:</div>
        <div className="report-reference-value">{submittedReferenceId}</div>
        <div className="report-reference-help">Save this ID to track your report.</div>
      </div>

      <div className="report-actions report-actions-center">
        <button
          type="button"
          className="report-button report-button-secondary"
          onClick={() => {
            setSubmittedReferenceId("");
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
              >
                Photo
              </button>
              <button
                type="button"
                className={`report-camera-mode ${captureMode === "video" ? "is-active" : ""}`}
                onClick={() => setCaptureMode("video")}
              >
                Video
              </button>
            </div>

            <select
              className="report-camera-select"
              value={selectedCameraId}
              onChange={(event) => switchCamera(event.target.value)}
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
            </select>
          </div>

          <div className="report-camera-preview-shell">
            <video
              ref={videoPreviewRef}
              className="report-camera-preview"
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
            linear-gradient(90deg, #e4eef8 0%, #eaf3f8 50%, #f1f6fa 100%);
          font-family: 'Inter', sans-serif;
          color: #111827;
        }

        .report-hero {
          text-align: center;
          padding: 70px 24px 92px;
          background:
            linear-gradient(90deg, #e6f0f9 0%, #ffffff 52%, #f2f6f6 100%);
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
          background: #ffffff;
          border: 1px solid #e4e4e4;
          border-radius: 16px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
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

        .report-voice-box {
          border: 1px solid #f0d98b;
          background: #fffdf4;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .report-voice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .report-voice-title {
          font-weight: 600;
          color: #0f172a;
        }

        .report-voice-note {
          color: #6b7280;
        }

        .report-voice-button {
          width: 100%;
          border: 1px solid #d9dee6;
          background: #ffffff;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .report-voice-recording-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .report-voice-status {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: #111827;
        }

        .report-voice-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff6b6b;
          flex-shrink: 0;
        }

        .report-button-stop {
          background: #ff5a52;
          color: #ffffff;
          padding-inline: 18px;
        }

        .report-transcript-box {
          background: #ffffff;
          border: 1px solid #d9dee6;
          border-radius: 10px;
          padding: 14px 16px;
        }

        .report-transcript-label {
          font-size: 14px;
          color: #4b5563;
          margin-bottom: 8px;
        }

        .report-transcript-text {
          font-size: 14px;
          line-height: 1.55;
          color: #111827;
        }

        .report-voice-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }

        .report-voice-action {
          width: 100%;
          justify-content: center;
        }

        .report-voice-error {
          margin-top: 10px;
          font-size: 13px;
          color: #b91c1c;
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

        .report-upload-preview-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          text-align: center;
          word-break: break-word;
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
          border-radius: 16px;
          overflow: hidden;
          background: #0f172a;
          aspect-ratio: 16 / 9;
          margin-bottom: 14px;
        }

        .report-camera-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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

        .report-info-strip {
          margin-top: 62px;
          background: #f1f2f3;
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
            grid-template-columns: 1fr;
          }

          .report-footer-grid {
            grid-template-columns: 1fr 1fr;
          }

          .report-voice-header,
          .report-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .report-voice-recording-row {
            flex-direction: column;
            align-items: stretch;
          }

          .report-voice-actions {
            grid-template-columns: 1fr;
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
            <form onSubmit={handleSubmit}>
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
                <li><a href="/#how">How It Works</a></li>
              </ul>
            </div>
            <div>
              <div className="report-footer-col-title">Support</div>
              <ul className="report-footer-links">
                <li><a href="/#faqs">FAQs</a></li>
                <li><a href="/#contact">Contact/Help</a></li>
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
      </div>
    </>
  );
}

export default ReportForm;
