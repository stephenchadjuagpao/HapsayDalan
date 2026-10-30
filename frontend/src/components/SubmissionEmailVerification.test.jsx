import { act, fireEvent, render, screen } from "@testing-library/react";
import SubmissionEmailVerification from "./SubmissionEmailVerification";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
const challenge = () => ({ challenge_id: "submission-challenge", email: "me@example.com", expires_in: 600, resend_after: 60, receivedAt: Date.now() });
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  API.get.mockResolvedValue({ data: { csrfToken: "csrf" } });
  API.post.mockResolvedValue({ data: { email_verification_token: "email-proof", expires_in: 900 } });
});
afterEach(() => jest.useRealTimers());

test("code verification is required before forwarding proof to submission", async () => {
  const onConfirm = jest.fn();
  render(<SubmissionEmailVerification challenge={challenge()} canSubmit onConfirm={onConfirm} onClose={jest.fn()} onResend={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify & Submit Report" })));
  expect(API.post).toHaveBeenCalledWith("submission-email/verify/", { challenge_id: "submission-challenge", code: "123456" }, expect.any(Object));
  expect(onConfirm).toHaveBeenCalledWith("email-proof");
});

test("incorrect codes never submit a report", async () => {
  const onConfirm = jest.fn();
  API.post.mockRejectedValue({ response: { data: { detail: "Incorrect code." } } });
  render(<SubmissionEmailVerification challenge={challenge()} canSubmit onConfirm={onConfirm} onClose={jest.fn()} onResend={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify & Submit Report" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Incorrect code");
  expect(onConfirm).not.toHaveBeenCalled();
});

test("verified proof can trigger a location refresh instead of leaving submission disabled", async () => {
  const onConfirm = jest.fn();
  const props = { challenge: challenge(), onConfirm, onClose: jest.fn(), onResend: jest.fn() };
  const { rerender } = render(<SubmissionEmailVerification {...props} canSubmit={false} />);
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify & Submit Report" })));
  expect(onConfirm).toHaveBeenCalledWith("email-proof");
  expect(screen.getByRole("button", { name: "Refresh location to continue" })).toBeEnabled();
  rerender(<SubmissionEmailVerification {...props} canSubmit />);
  fireEvent.click(screen.getByRole("button", { name: "Submit verified report" }));
  expect(onConfirm).toHaveBeenCalledWith("email-proof");
  expect(API.post).toHaveBeenCalledTimes(1);
});

test("resend has a cooldown and expired codes cannot be submitted", async () => {
  const onResend = jest.fn();
  render(<SubmissionEmailVerification challenge={challenge()} canSubmit onConfirm={jest.fn()} onClose={jest.fn()} onResend={onResend} />);
  expect(screen.getByRole("button", { name: "Request a new code in 1 minute" })).toBeDisabled();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole("button", { name: "Request a new code in 59 seconds" })).toBeDisabled();
  act(() => jest.advanceTimersByTime(59000));
  fireEvent.click(screen.getByRole("button", { name: "Request a new code" }));
  expect(onResend).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(540000));
  expect(screen.getByRole("alert")).toHaveTextContent("expired");
  expect(screen.getByRole("button", { name: "Verify & Submit Report" })).toBeDisabled();
});
