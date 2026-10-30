import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportForm from "./ReportForm";
import useReportLocation from "../hooks/useReportLocation";
import API from "../services/api";

jest.mock("../components/reusablecode/Navbar", () => () => null);
jest.mock("../hooks/useReportLocation");
jest.mock("../components/ReportCaptcha", () => ({ onConfirm, confirmLabel }) => (
  <div role="dialog"><button type="button" onClick={() => onConfirm("verified-captcha-token")}>{confirmLabel}</button></div>
));
jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));

let map;
let marker;
let circle;

beforeEach(() => {
  jest.clearAllMocks();
  useReportLocation.mockReturnValue({ position: null, isReady: false, message: "Location permission is required.", retry: jest.fn() });
  map = { invalidateSize: jest.fn(), remove: jest.fn(), setView: jest.fn(), panTo: jest.fn(), on: jest.fn(), fitBounds: jest.fn() };
  marker = { addTo: jest.fn(), setLatLng: jest.fn(), remove: jest.fn() };
  marker.addTo.mockReturnValue(marker);
  circle = { addTo: jest.fn(), setLatLng: jest.fn(), setRadius: jest.fn(), remove: jest.fn() };
  circle.addTo.mockReturnValue(circle);
  circle.setLatLng.mockReturnValue(circle);
  window.L = {
    map: jest.fn(() => map), marker: jest.fn(() => marker), circle: jest.fn(() => circle), circleMarker: jest.fn(() => circle),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    geoJSON: jest.fn(() => {
      const layer = { addTo: jest.fn(), remove: jest.fn(), getBounds: jest.fn(() => "route-bounds") };
      layer.addTo.mockReturnValue(layer);
      return layer;
    }),
  };
  URL.createObjectURL = jest.fn(() => "blob:test");
  URL.revokeObjectURL = jest.fn();
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "csrf/" ? { csrfToken: "csrf" } : { location: "Detected street" } }));
  API.post.mockImplementation((url) => Promise.resolve({ data: url === "submission-email/request/"
    ? { challenge_id: "test-challenge", expires_in: 600, resend_after: 60 }
    : url === "submission-email/verify/" ? { email_verification_token: "verified-email-proof", expires_in: 900 }
      : { id: 123, reference_id: "SUP-12345678" } }));
});

async function completeVerification() {
  fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
  const input = await screen.findByLabelText("6-digit verification code");
  expect(API.post.mock.calls.some(([url]) => url === "reports/")).toBe(false);
  fireEvent.change(input, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & Submit Report" }));
}

function submittedPayload() { return API.post.mock.calls.find(([url]) => url === "reports/")[1]; }

test("email submission limit shows the retry message and preserves the unsubmitted report", async () => {
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  const originalPost = API.post.getMockImplementation();
  API.post.mockImplementation((url, ...args) => url === "reports/"
    ? Promise.reject({ response: { status: 429, data: { detail: "This email has reached the limit of 3 reports per 10 minutes. Please try again in 120 seconds." } } })
    : originalPost(url, ...args));
  const { container } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  await completeVerification();
  expect((await screen.findAllByRole("alert")).some((alert) => alert.textContent.includes("3 reports per 10 minutes"))).toBe(true);
  expect(screen.queryByText("Report Submitted Successfully!")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to report" }));
  expect(screen.getByLabelText("Email address *")).toHaveValue("me@example.com");
  expect(submittedPayload().get("description")).toContain("Test violation");
});

function openEvidenceStep() {
  fireEvent.click(screen.getByRole("button", { name: "Next violation types" }));
  fireEvent.click(screen.getByRole("button", { name: "Select Road obstruction" }));
  expect(screen.getByLabelText(/Type of Violation/)).toHaveValue("Obstruction");
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Test violation" } });
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "2026-10-23" } });
  fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: "12:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
}

function openLocationStep(container) {
  openEvidenceStep();
  fireEvent.change(container.querySelector("#image"), { target: { files: [new File(["test"], "evidence.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
  fireEvent.change(screen.getByLabelText("Phone number *"), { target: { value: "09123456789" } });
}

test("allowing device location automatically places a pin and centers the map", async () => {
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  expect(window.L.tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", expect.objectContaining({
    referrerPolicy: "strict-origin-when-cross-origin", maxZoom: 19,
  }));
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  rerender(<ReportForm />);
  await waitFor(() => expect(window.L.marker).toHaveBeenCalledWith([9.7843, 125.4888], { draggable: false }));
  expect(map.setView).toHaveBeenCalledWith([9.7843, 125.4888], 17);
  expect(screen.getByLabelText("Violation Location *")).toHaveValue("Detected street");
});

test("entering the location step starts GPS from the Next Step tap", () => {
  const startOnEntry = jest.fn();
  useReportLocation.mockReturnValue({ position: null, isReady: false, message: "Waiting for location", retry: jest.fn(), startOnEntry });
  const { container } = render(<ReportForm />);
  openLocationStep(container);
  expect(startOnEntry).toHaveBeenCalledTimes(1);
});

test("Next Step moves to and explains the first missing required field", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  try {
    render(<ReportForm />);
    fireEvent.click(screen.getByRole("button", { name: "Next violation types" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Road obstruction" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));

    const description = screen.getByLabelText(/Description/);
    expect(description).toHaveFocus();
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a description of what you witnessed.");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });

    fireEvent.change(description, { target: { value: "A parked vehicle blocked the road." } });
    expect(description).toHaveAttribute("aria-invalid", "false");
  } finally {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  }
});

test("missing evidence highlights and focuses the upload area", () => {
  const { container } = render(<ReportForm />);
  openEvidenceStep();
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));

  const uploadArea = container.querySelector("#image-drop-zone");
  expect(uploadArea).toHaveFocus();
  expect(uploadArea).toHaveClass("is-invalid");
  expect(screen.getByRole("alert")).toHaveTextContent("Add a photo or video of the violation.");
});

test("Submit Report moves to missing email and then phone number", async () => {
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  const { container } = render(<ReportForm />);
  openEvidenceStep();
  fireEvent.change(container.querySelector("#image"), {
    target: { files: [new File(["photo"], "evidence.jpg", { type: "image/jpeg" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
  await waitFor(() => expect(screen.getByLabelText("Violation Location *")).not.toHaveValue(""));

  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  expect(screen.getByLabelText("Email address *")).toHaveFocus();
  expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address.");

  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "citizen@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  expect(screen.getByLabelText("Phone number *")).toHaveFocus();
  expect(screen.getByRole("alert")).toHaveTextContent("Enter your phone number.");
});

test("evidence picker uses photo/video wording and rejects a non-media file", () => {
  const { container } = render(<ReportForm />);
  openEvidenceStep();
  const picker = container.querySelector("#image");
  expect(picker).toHaveAttribute("accept", "image/*,video/*");
  expect(screen.getByText("Choose Photos/Videos")).toBeInTheDocument();
  fireEvent.change(picker, { target: { files: [new File(["document"], "report.pdf", { type: "application/pdf" })] } });
  expect(screen.getByText("Please choose a photo or video from your device.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
  expect(screen.getByRole("heading", { name: "Upload Evidence" })).toBeInTheDocument();
  fireEvent.change(picker, { target: { files: [new File(["photo"], "evidence.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
  expect(screen.getByRole("heading", { name: "Location & Contact Info" })).toBeInTheDocument();
});

test("captured photo is attached and immediately shown in the evidence preview", async () => {
  const originalMediaDevices = navigator.mediaDevices;
  const stream = {
    getTracks: () => [{ stop: jest.fn() }],
    getVideoTracks: () => [{ getSettings: () => ({ deviceId: "back-camera" }) }],
  };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue(stream),
      enumerateDevices: jest.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "back-camera", label: "Back camera" }]),
    },
  });
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: jest.fn() });
  const toBlob = jest.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["photo"], { type: "image/jpeg" }));
  });
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

  try {
    const { container } = render(<ReportForm />);
    openEvidenceStep();
    fireEvent.click(screen.getByRole("button", { name: "Capture Photo/Video" }));
    await screen.findByRole("button", { name: "Take Photo" });
    const preview = container.querySelector(".report-camera-preview");
    Object.defineProperty(preview, "videoWidth", { configurable: true, value: 720 });
    Object.defineProperty(preview, "videoHeight", { configurable: true, value: 960 });
    await waitFor(() => expect(preview.srcObject).toBe(stream));
    expect(screen.queryByRole("button", { name: "Refresh camera" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Take Photo" }));

    const attachedPhoto = await screen.findByAltText(/^camera-capture-.*\.jpg$/);
    expect(attachedPhoto).toHaveAttribute("src", "blob:test");
    expect(screen.queryByRole("heading", { name: "Capture Photo or Video" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear attached photo or video" }));
    expect(screen.queryByAltText(/^camera-capture-.*\.jpg$/)).not.toBeInTheDocument();
    expect(screen.getByText("Tap to choose a photo or video")).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    expect(screen.getByRole("heading", { name: "Upload Evidence" })).toBeInTheDocument();
    fireEvent.change(container.querySelector("#image"), { target: { files: [new File(["photo"], "evidence.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Next Step" }));
    expect(screen.getByRole("heading", { name: "Location & Contact Info" })).toBeInTheDocument();
  } finally {
    getContext.mockRestore();
    toBlob.mockRestore();
    play.mockRestore();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});

test("iPhone camera requests the sensor dimensions that produce a portrait preview", async () => {
  const originalUserAgent = navigator.userAgent;
  const originalMediaDevices = navigator.mediaDevices;
  const stream = {
    getTracks: () => [{ stop: jest.fn() }],
    getVideoTracks: () => [{ getSettings: () => ({ deviceId: "back-camera" }) }],
  };
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)" });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue(stream),
      enumerateDevices: jest.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "back-camera", label: "Back camera" }]),
    },
  });
  try {
    render(<ReportForm />);
    openEvidenceStep();
    fireEvent.click(screen.getByRole("button", { name: "Capture Photo/Video" }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
  } finally {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});

test("recorded video keeps the whole landscape camera frame inside a portrait file", async () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = global.MediaRecorder;
  const originalMediaStream = global.MediaStream;
  const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;
  const cameraTrack = { stop: jest.fn(), getSettings: () => ({ deviceId: "back-camera" }) };
  const cameraStream = {
    getTracks: () => [cameraTrack],
    getVideoTracks: () => [cameraTrack],
    getAudioTracks: () => [],
  };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue(cameraStream),
      enumerateDevices: jest.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "back-camera", label: "Back camera" }]),
    },
  });
  const canvasTrack = { stop: jest.fn() };
  let recordedCanvas;
  HTMLCanvasElement.prototype.captureStream = jest.fn(function captureStream() {
    recordedCanvas = this;
    return { getVideoTracks: () => [canvasTrack], getTracks: () => [canvasTrack] };
  });
  const drawImage = jest.fn();
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage, fillRect: jest.fn(), set fillStyle(value) {},
  });
  const animationFrame = jest.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  const cancelFrame = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  global.MediaStream = jest.fn().mockImplementation((tracks) => ({ tracks }));
  global.MediaRecorder = class {
    static isTypeSupported(type) { return type === "video/mp4"; }
    constructor(stream, options) {
      this.stream = stream;
      this.mimeType = options.mimeType;
      this.state = "inactive";
    }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob(["video"], { type: this.mimeType }) });
      this.onstop();
    }
  };

  try {
    const { container } = render(<ReportForm />);
    openEvidenceStep();
    fireEvent.click(screen.getByRole("button", { name: "Capture Photo/Video" }));
    await screen.findByRole("button", { name: "Video" });
    const preview = container.querySelector(".report-camera-preview");
    Object.defineProperty(preview, "videoWidth", { configurable: true, value: 1280 });
    Object.defineProperty(preview, "videoHeight", { configurable: true, value: 720 });
    await waitFor(() => expect(preview.srcObject).toBe(cameraStream));
    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    expect(preview).toHaveClass("is-video");
    expect(container.querySelector(".report-camera-preview-shell")).not.toHaveClass("is-video");
    fireEvent.click(screen.getByRole("button", { name: "Start Video Recording" }));
    await screen.findByRole("button", { name: "Stop Recording" });

    expect(recordedCanvas.width).toBe(720);
    expect(recordedCanvas.height).toBe(960);
    expect(drawImage).toHaveBeenCalledWith(preview, 0, 277.5, 720, 405);
    expect(global.MediaStream).toHaveBeenCalledWith([canvasTrack]);

    fireEvent.click(screen.getByRole("button", { name: "Stop Recording" }));
    expect(await screen.findByText(/^camera-video-.*\.mp4$/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload Evidence" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Capture Photo/Video" }));
    await screen.findByRole("button", { name: "Video" });
    const portraitPreview = container.querySelector(".report-camera-preview");
    Object.defineProperty(portraitPreview, "videoWidth", { configurable: true, value: 720 });
    Object.defineProperty(portraitPreview, "videoHeight", { configurable: true, value: 1280 });
    await waitFor(() => expect(portraitPreview.srcObject).toBe(cameraStream));
    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    expect(container.querySelector(".report-camera-preview-shell")).not.toHaveClass("is-video");
    fireEvent.click(screen.getByRole("button", { name: "Start Video Recording" }));
    await screen.findByRole("button", { name: "Stop Recording" });
    expect(recordedCanvas.width).toBe(720);
    expect(recordedCanvas.height).toBe(1280);
    expect(drawImage).toHaveBeenLastCalledWith(portraitPreview, 0, 0, 720, 1280);
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    HTMLCanvasElement.prototype.captureStream = originalCaptureStream;
    global.MediaRecorder = originalMediaRecorder;
    global.MediaStream = originalMediaStream;
    getContext.mockRestore();
    animationFrame.mockRestore();
    cancelFrame.mockRestore();
  }
});

test("submission explains missing location and retries without bypassing verification", async () => {
  const { container } = render(<ReportForm />);
  openLocationStep(container);
  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  expect(screen.getAllByText("Location permission is required.").length).toBeGreaterThan(0);
  fireEvent.submit(container.querySelector("form"));
  expect(useReportLocation().retry).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText(/Use Enable \/ Retry Location above the map/)).toBeInTheDocument();
  expect(screen.getByLabelText("Violation Location *")).toHaveAttribute("readonly");
  expect(window.L.marker).not.toHaveBeenCalled();
  expect(API.post).not.toHaveBeenCalled();
});

test("live position pins the map and is included in the submitted report", async () => {
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  expect(window.L.marker).toHaveBeenCalledWith([9.7843, 125.4888], { draggable: false });
  expect(map.setView).toHaveBeenCalledWith([9.7843, 125.4888], 17);
  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  expect(API.post).not.toHaveBeenCalled();
  await completeVerification();
  await screen.findByText("Report Submitted Successfully!");
  const payload = submittedPayload();
  expect(payload.get("latitude")).toBe("9.784300");
  expect(payload.get("email_verification_token")).toBe("verified-email-proof");
  expect(payload.get("occurred_at")).toBe("2026-10-23T04:00:00.000Z");
  expect(payload.get("longitude")).toBe("125.488800");
  expect(payload.get("location_accuracy")).toBe("12");
  expect(payload.get("location_captured_at")).toBe(new Date(position.timestamp).toISOString());
  expect(map.remove).toHaveBeenCalled();
  expect(useReportLocation).toHaveBeenLastCalledWith(false);
});

test("successful submission brings the confirmation card into view", async () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  try {
    const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
    useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
    const { container } = render(<ReportForm />);
    openLocationStep(container);
    await waitFor(() => expect(window.L.map).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
    await completeVerification();

    const confirmation = (await screen.findByText("Report Submitted Successfully!")).closest(".report-success-card");
    expect(confirmation).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  } finally {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  }
});

test("149 m GPS requires a map pin, then proceeds to CAPTCHA with accuracy preserved", async () => {
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(map.on).toHaveBeenCalled());
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 149, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Approximate location.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText(/Your device location is approximate. Click or tap/)).toBeInTheDocument();
  const clickMap = map.on.mock.calls.find(([event]) => event === "click")[1];
  await act(async () => clickMap({ latlng: { lat: 9.79, lng: 125.49 } }));
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  await completeVerification();
  await screen.findByText("Report Submitted Successfully!");
  expect(submittedPayload().get("location_accuracy")).toBe("149");
  expect(submittedPayload().get("location_source")).toBe("manual");
});

test("clicked violation pin survives GPS updates and submits separately from device location", async () => {
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(map.on).toHaveBeenCalledWith("click", expect.any(Function)));
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  const clickMap = map.on.mock.calls.find(([event]) => event === "click")[1];
  await act(async () => clickMap({ latlng: { lat: 9.79, lng: 125.49 } }));
  useReportLocation.mockReturnValue({ position: { ...position, latitude: 9.785 }, isReady: true, message: "Location active.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  expect(marker.setLatLng).toHaveBeenLastCalledWith([9.79, 125.49]);
  fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit Report" }));
  await completeVerification();
  await screen.findByText("Report Submitted Successfully!");
  const payload = submittedPayload();
  expect(payload.get("latitude")).toBe("9.790000");
  expect(payload.get("longitude")).toBe("125.490000");
  expect(payload.get("location_source")).toBe("manual");
  expect(payload.get("reporter_latitude")).toBe("9.785000");
});

test("selecting a violation pin automatically draws shortest route on the report form map", async () => {
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "public-report-route/"
    ? { geometry: { type: "LineString", coordinates: [[125.4888, 9.7843], [125.49, 9.79]] }, distance: 700, duration: 180, steps: [] }
    : { location: "Detected street" } }));
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(map.on).toHaveBeenCalled());
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  const clickMap = map.on.mock.calls.find(([event]) => event === "click")[1];
  await act(async () => clickMap({ latlng: { lat: 9.79, lng: 125.49 } }));
  await waitFor(() => expect(window.L.geoJSON).toHaveBeenCalled(), { timeout: 2500 });
  expect(window.L.geoJSON).toHaveBeenCalledWith(expect.objectContaining({ type: "Feature" }), expect.any(Object));
  expect(map.fitBounds).toHaveBeenCalledWith("route-bounds", expect.any(Object));
  expect(API.get).toHaveBeenCalledWith("public-report-route/", expect.objectContaining({ params: expect.objectContaining({ preference: "shortest" }) }));
  const routeLayer = window.L.geoJSON.mock.results[0].value;
  fireEvent.click(screen.getByRole("button", { name: "Use My Current Location" }));
  await waitFor(() => expect(routeLayer.remove).toHaveBeenCalled());
});

test("use current location restores automatic pinning; manual selection still requires GPS permission", async () => {
  const { container, rerender } = render(<ReportForm />);
  openLocationStep(container);
  await waitFor(() => expect(map.on).toHaveBeenCalled());
  const clickMap = map.on.mock.calls.find(([event]) => event === "click")[1];
  await act(async () => clickMap({ latlng: { lat: 9.79, lng: 125.49 } }));
  fireEvent.submit(container.querySelector("form"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
  const position = { latitude: 9.7843, longitude: 125.4888, accuracy: 12, timestamp: Date.now() };
  useReportLocation.mockReturnValue({ position, isReady: true, message: "Location active.", retry: jest.fn() });
  await act(async () => rerender(<ReportForm />));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use My Current Location" })));
  expect(marker.setLatLng).toHaveBeenLastCalledWith([9.7843, 125.4888]);
  expect(screen.queryByRole("button", { name: "Use My Current Location" })).not.toBeInTheDocument();
});
