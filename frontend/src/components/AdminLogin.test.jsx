import { fireEvent, render, screen } from "@testing-library/react";
import AdminLogin from "./AdminLogin";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState(null, "", "/admin-ctmo");
  API.get.mockResolvedValue({ data: { csrfToken: "csrf" } });
});

test("forgot password opens code recovery and returns safely to login", async () => {
  API.post.mockResolvedValue({ data: { challenge_id: "challenge-1", detail: "Code sent.", resend_after: 60 } });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  expect(screen.getByRole("heading", { name: "Forgot password?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  await screen.findByRole("heading", { name: "Check your email" });
  expect(API.post).toHaveBeenCalledWith("admin/password-reset/code/", { email: "officer@example.com" });
  expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Back to Log In" }));
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

test("email link opens new password form and success screen", async () => {
  window.history.replaceState(null, "", "/admin-ctmo?uid=MQ&token=reset-token");
  API.post.mockResolvedValue({ data: { detail: "Password updated." } });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "DifferentPassword" } });
  expect(screen.getByRole("button", { name: "Reset password" })).toBeDisabled();
  expect(API.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await screen.findByRole("heading", { name: "Password updated!" });
  expect(API.post).toHaveBeenCalledWith("admin/password-reset/confirm/", {
    uid: "MQ", token: "reset-token", password: "New!RoadSafety4829",
  });
  expect(window.location.search).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Back to Log In" }));
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

test("failed delivery displays the server error", async () => {
  API.post.mockRejectedValue({ response: { data: { detail: "Unable to send the reset email." } } });
  render(<AdminLogin />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send the reset email.");
  expect(screen.getByRole("heading", { name: "Forgot password?" })).toBeInTheDocument();
});

test("login explains when the CTMO server is unreachable", async () => {
  API.post.mockRejectedValue({ message: "Network Error" });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));
  expect(await screen.findByText("Cannot connect to the CTMO server. Please wait a moment and try again.")).toBeInTheDocument();
});

test.each([
  [400, "This website address is no longer accepted by the server. Open the current site address and try again."],
  [403, "Your login session could not be verified. Refresh this page, allow cookies, and try again."],
])("login explains a non-JSON server rejection (%s)", async (status, message) => {
  API.post.mockRejectedValue({ response: { status, data: "<html>Request rejected</html>" } });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Log In" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
