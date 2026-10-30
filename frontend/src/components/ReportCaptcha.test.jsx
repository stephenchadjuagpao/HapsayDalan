import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportCaptcha from "./ReportCaptcha";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn() }));
let callbacks;
beforeEach(() => {
  jest.clearAllMocks();
  API.get.mockResolvedValue({ data: { configured: true, site_key: "public-key" } });
  window.grecaptcha = { render: jest.fn((element, options) => { callbacks = options; return 0; }), reset: jest.fn() };
});

test("submission is disabled until Google verifies the CAPTCHA", async () => {
  const onConfirm = jest.fn();
  render(<ReportCaptcha onClose={jest.fn()} onConfirm={onConfirm} canSubmit />);
  const button = screen.getByRole("button", { name: "Verify & Submit Report" });
  expect(button).toBeDisabled();
  await waitFor(() => expect(window.grecaptcha.render).toHaveBeenCalled());
  act(() => callbacks.callback("google-response-token"));
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(onConfirm).toHaveBeenCalledWith("google-response-token");
  act(() => callbacks["expired-callback"]());
  expect(button).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("expired");
});

test("missing keys show a configuration error instead of accepting a fake CAPTCHA", async () => {
  API.get.mockResolvedValue({ data: { configured: false, site_key: "" } });
  render(<ReportCaptcha onClose={jest.fn()} onConfirm={jest.fn()} canSubmit />);
  expect(await screen.findByRole("alert")).toHaveTextContent("not configured");
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
  expect(window.grecaptcha.render).not.toHaveBeenCalled();
});

test("location remains required after CAPTCHA and cancellation keeps report data", async () => {
  const onClose = jest.fn();
  render(<ReportCaptcha onClose={onClose} onConfirm={jest.fn()} canSubmit={false} />);
  await waitFor(() => expect(window.grecaptcha.render).toHaveBeenCalled());
  act(() => callbacks.callback("token"));
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Back to report" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("failed submission resets a consumed token and requires a new challenge", async () => {
  const { rerender } = render(<ReportCaptcha onClose={jest.fn()} onConfirm={jest.fn()} canSubmit />);
  await waitFor(() => expect(window.grecaptcha.render).toHaveBeenCalled());
  act(() => callbacks.callback("token"));
  rerender(<ReportCaptcha onClose={jest.fn()} onConfirm={jest.fn()} canSubmit submissionError="Please try again." />);
  expect(window.grecaptcha.reset).toHaveBeenCalledWith(0);
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
});

test("widget errors identify the hostname to authorize without bypassing CAPTCHA", async () => {
  render(<ReportCaptcha onClose={jest.fn()} onConfirm={jest.fn()} canSubmit />);
  await waitFor(() => expect(window.grecaptcha.render).toHaveBeenCalled());
  act(() => callbacks["error-callback"]());
  expect(screen.getByRole("alert")).toHaveTextContent(`authorize ${window.location.hostname}`);
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
});
