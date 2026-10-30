import { fireEvent, render, screen } from "@testing-library/react";
import AdminLogin from "./AdminLogin";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  window.history.replaceState(null, "", "/admin-ctmo");
  API.get.mockResolvedValue({ data: { csrfToken: "csrf" } });
});

test("forgot password sends the account email and returns to login", async () => {
  API.post.mockResolvedValue({ data: { detail: "Check your inbox for a reset link." } });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
  await screen.findByText("Check your inbox for a reset link.");
  expect(API.post).toHaveBeenCalledWith("admin/password-reset/", { email: "officer@example.com" }, { headers: { "X-CSRFToken": "csrf" } });
  fireEvent.click(screen.getByRole("button", { name: "Back to Log In" }));
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

test("email link opens reset form, checks confirmation, then returns to login", async () => {
  window.history.replaceState(null, "", "/admin-ctmo?uid=MQ&token=reset-token");
  API.post.mockResolvedValue({ data: { detail: "Password updated. Log in with your new password." } });
  render(<AdminLogin />);
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "DifferentPassword" } });
  fireEvent.click(screen.getByRole("button", { name: "Save New Password" }));
  expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "New!RoadSafety4829" } });
  fireEvent.click(screen.getByRole("button", { name: "Save New Password" }));
  await screen.findByText("Password updated. Log in with your new password.");
  expect(API.post).toHaveBeenCalledWith("admin/password-reset/confirm/", {
    uid: "MQ", token: "reset-token", password: "New!RoadSafety4829",
  }, { headers: { "X-CSRFToken": "csrf" } });
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(window.location.search).toBe("");
});

test("failed delivery displays the server error", async () => {
  API.post.mockRejectedValue({ response: { data: { detail: "Unable to send the reset email." } } });
  render(<AdminLogin />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "officer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
  expect(await screen.findByText("Unable to send the reset email.")).toBeInTheDocument();
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
