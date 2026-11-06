import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PasswordRecovery from "./PasswordRecovery";
import API from "../services/api";

jest.mock("../services/api", () => ({ post: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); });

async function begin() {
  API.post.mockResolvedValueOnce({ data: { challenge_id: "challenge-1", resend_after: 60 } });
  render(<PasswordRecovery initialEmail="officer@example.com" onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  await screen.findByRole("heading", { name: "Check your email" });
}

test("pasted code is verified before a password can be reset", async () => {
  await begin();
  API.post.mockResolvedValueOnce({ data: { uid: "MQ", token: "verified-token" } });
  fireEvent.paste(screen.getByLabelText("Digit 1 of 6"), { clipboardData: { getData: () => "123 456" } });
  await screen.findByRole("heading", { name: "Create new password" });
  expect(API.post).toHaveBeenLastCalledWith("admin/password-reset/code/verify/", { challenge_id: "challenge-1", code: "123456" });
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
  expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "text");
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "New!RoadSafety4829" } });
  API.post.mockResolvedValueOnce({ data: {} });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await screen.findByRole("heading", { name: "Password updated!" });
  expect(API.post).toHaveBeenLastCalledWith("admin/password-reset/confirm/", { uid: "MQ", token: "verified-token", password: "New!RoadSafety4829" });
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
});

test("wrong code stays on verification and can be corrected", async () => {
  await begin();
  API.post.mockRejectedValueOnce({ response: { data: { detail: "Code is incorrect or expired." } } });
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "123456" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Code is incorrect or expired.");
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
  expect(screen.getByRole("heading", { name: "Forgot password?" })).toBeInTheDocument();
});

test("backspace and arrow keys move between code digits", async () => {
  await begin();
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), { target: { value: "12" } });
  expect(screen.getByLabelText("Digit 3 of 6")).toHaveFocus();
  fireEvent.keyDown(screen.getByLabelText("Digit 3 of 6"), { key: "Backspace" });
  expect(screen.getByLabelText("Digit 2 of 6")).toHaveFocus();
  expect(screen.getByLabelText("Digit 2 of 6")).toHaveValue("");
  fireEvent.keyDown(screen.getByLabelText("Digit 2 of 6"), { key: "ArrowLeft" });
  expect(screen.getByLabelText("Digit 1 of 6")).toHaveFocus();
});

test("server password rules keep recovery open without showing success", async () => {
  API.post.mockRejectedValueOnce({ response: { data: { detail: "This password is too common." } } });
  render(<PasswordRecovery resetLink={{ uid: "MQ", token: "token" }} onBack={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "password123" } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("This password is too common.");
  expect(screen.queryByRole("heading", { name: "Password updated!" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled());
});

test("sending shows the driving animation until email delivery responds and blocks repeat submissions", async () => {
  let complete;
  API.post.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
  const { container } = render(<PasswordRecovery initialEmail="officer@example.com" onBack={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  expect(container.querySelector(".pr-drive-animation")).toBeInTheDocument();
  const sending = screen.getByRole("button", { name: /Sending a code to officer@example.com/ });
  expect(sending).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Sending a code to officer@example.com");
  fireEvent.click(sending);
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  await act(async () => complete({ data: { challenge_id: "challenge-1", resend_after: 60 } }));
  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  expect(container.querySelector(".pr-drive-animation")).not.toBeInTheDocument();
});

test("reset animation stops on failure and never displays a false success", async () => {
  let reject;
  API.post.mockReturnValueOnce(new Promise((resolve, fail) => { reject = fail; }));
  const { container } = render(<PasswordRecovery resetLink={{ uid: "MQ", token: "token" }} onBack={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  expect(container.querySelector(".pr-drive-animation")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Resetting your password/ })).toBeDisabled();
  expect(screen.queryByRole("heading", { name: "Password updated!" })).not.toBeInTheDocument();
  await act(async () => reject({ response: { data: { detail: "Please try again." } } }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
  expect(container.querySelector(".pr-drive-animation")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
});

test("resending animates delivery instead of incorrectly showing code verification", async () => {
  jest.useFakeTimers();
  try {
    await begin();
    act(() => jest.advanceTimersByTime(61_000));
    let complete;
    API.post.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(screen.getByRole("button", { name: /Sending a new code to/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sending a new code to officer@example.com");
    expect(screen.queryByRole("button", { name: "Verifying…" })).not.toBeInTheDocument();
    await act(async () => complete({ data: { challenge_id: "replacement", resend_after: 60 } }));
    expect(screen.getByRole("button", { name: "Verify code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
  } finally { jest.useRealTimers(); }
});
