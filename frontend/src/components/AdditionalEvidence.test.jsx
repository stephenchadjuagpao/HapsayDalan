import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdditionalEvidence from "./AdditionalEvidence";
import API from "../services/api";
const axios = require("axios/dist/browser/axios.cjs");

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
const report = { id: 7, status: "Pending", reference_id: "SUP-12345678", evidence_status: "requested" };
const request = { id: "follow-up", message: "Please show the vehicle plate number.", created_at: "2026-10-25T08:00:00Z", responded_at: null, status: "requested" };
beforeEach(() => {
  jest.resetAllMocks();
  API.get.mockResolvedValue({ data: { requests: [], can_reply: true } });
});

test.each(["/api/", "https://backend.example/api/"])("attachment URLs do not duplicate the API prefix with base %s", async (baseURL) => {
  const createURL = URL.createObjectURL;
  const revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:private-photo");
  URL.revokeObjectURL = jest.fn();
  API.defaults = { baseURL };
  const fileURL = "/api/reports/7/evidence/follow-up/file/";
  const blob = new Blob(["photo"], { type: "image/png" });
  API.get.mockImplementation((url) => Promise.resolve({ data: url === fileURL ? blob : { requests: [{
    ...request, responded_at: "2026-10-25T09:00:00Z", attachment_url: fileURL, attachment_content_type: "image/png",
  }], can_reply: true } }));
  const { unmount } = render(<AdditionalEvidence report={report} accessToken="owner-proof" />);
  try {
    fireEvent.click(await screen.findByRole("button", { name: "View additional photo" }));
    expect(await screen.findByRole("img", { name: "Additional evidence submitted by the reporter" })).toHaveAttribute("src", "blob:private-photo");
    const [url, config] = API.get.mock.calls.find(([url]) => url === fileURL);
    const actualURL = axios.create({ baseURL }).getUri({ ...config, url });
    const expectedOrigin = new URL(baseURL, window.location.origin).origin;
    expect(actualURL).toBe(`${expectedOrigin}${fileURL}`);
    expect(actualURL).not.toContain("/api/api/");
    expect(config.headers["X-Report-Access"]).toBe("owner-proof");
    expect(config.responseType).toBe("blob");
    expect(screen.getByRole("link", { name: "Download attachment" })).toHaveAttribute("download", "additional-evidence.png");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-photo");
  } finally {
    unmount(); delete API.defaults;
    URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL;
  }
});

test("admin sends a specific request and sees an honest email delivery warning", async () => {
  const changed = jest.fn();
  render(<AdditionalEvidence report={report} admin onChanged={changed} />);
  const prompt = await screen.findByLabelText(/What evidence is needed/);
  expect(screen.getByRole("button", { name: "Request additional evidence" })).toBeDisabled();
  API.post.mockResolvedValue({ data: { request, notification_sent: false, detail: "Request saved. The notification email could not be sent." } });
  fireEvent.change(prompt, { target: { value: "  Please show the vehicle plate number.  " } });
  fireEvent.click(screen.getByRole("button", { name: "Request additional evidence" }));
  expect(await screen.findByText("Awaiting reporter")).toBeInTheDocument();
  expect(API.post).toHaveBeenCalledWith("reports/7/evidence/request/", { message: request.message });
  expect(screen.getByRole("status")).toHaveTextContent("notification email could not be sent");
  expect(changed).toHaveBeenCalledWith("requested");
  expect(screen.queryByRole("button", { name: "Request additional evidence" })).not.toBeInTheDocument();
});

test("a failed admin request retains the written prompt for retry", async () => {
  render(<AdditionalEvidence report={report} admin />);
  const prompt = await screen.findByLabelText(/What evidence is needed/);
  API.post.mockRejectedValue({ response: { data: { detail: "Temporary connection issue." } } });
  fireEvent.change(prompt, { target: { value: "Please clarify the location." } });
  fireEvent.click(screen.getByRole("button", { name: "Request additional evidence" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Temporary connection issue");
  expect(prompt).toHaveValue("Please clarify the location.");
  expect(screen.getByRole("button", { name: "Request additional evidence" })).toBeEnabled();
});

test("reporter verifies their email before viewing the private prompt and uploading a reply", async () => {
  const changed = jest.fn();
  const verified = jest.fn();
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "csrf/" ? { csrfToken: "csrf" } : { requests: [request], can_reply: true } }));
  API.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("recover/") ? { challenge_id: "challenge", detail: "Check your inbox." }
    : url.endsWith("verify-recovery/") ? { access_token: "owner-proof" } : { request: { ...request, responded_at: "2026-10-25T09:00:00Z", response_text: "The plate is ABC123.", status: "submitted" }, detail: "Evidence received for review." } }));
  render(<AdditionalEvidence report={report} onChanged={changed} onVerified={verified} />);
  expect(screen.queryByText(request.message)).not.toBeInTheDocument();
  expect(API.get).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
  fireEvent.change(await screen.findByLabelText("6-digit verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & Continue" }));
  const details = await screen.findByLabelText("Additional details");
  expect(screen.getByText(request.message)).toBeInTheDocument();
  expect(verified).toHaveBeenCalledWith("owner-proof");
  expect(API.get).toHaveBeenCalledWith("reports/7/evidence/", { headers: { "X-Report-Access": "owner-proof" } });
  fireEvent.change(details, { target: { value: "The plate is ABC123." } });
  const file = new File(["picture"], "plate.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Additional photo or video"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Submit additional evidence" }));
  expect(await screen.findByText("Response received")).toBeInTheDocument();
  const [url, payload, options] = API.post.mock.calls.at(-1);
  expect(url).toBe("reports/7/evidence/follow-up/respond/");
  expect(payload.get("response_text")).toBe("The plate is ABC123.");
  expect(payload.get("attachment")).toBe(file);
  expect(options.headers["X-Report-Access"]).toBe("owner-proof");
  expect(changed).toHaveBeenCalledWith("submitted");
  expect(report.status).toBe("Pending");
});

test("oversized files are stopped before upload and expired proofs require verification again", async () => {
  API.get.mockResolvedValue({ data: { requests: [request], can_reply: true } });
  render(<AdditionalEvidence report={report} accessToken="owner-proof" />);
  const input = await screen.findByLabelText("Additional photo or video");
  const file = new File(["large"], "large.mp4", { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Submit additional evidence" }));
  expect(screen.getByRole("alert")).toHaveTextContent("50 MB or smaller");
  expect(API.post).not.toHaveBeenCalled();
  API.get.mockRejectedValue({ response: { status: 403, data: { detail: "Verify your report email again." } } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh evidence" }));
  await waitFor(() => expect(screen.queryByText(request.message)).not.toBeInTheDocument());
  expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
});
