import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HelpForm from "./HelpForm";
import API from "../services/api";
jest.mock("../services/api", () => ({ post: jest.fn() }));
const fill = () => {
  fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Citizen" } });
  fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "citizen@example.com" } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Tracking help" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please help me track my report." } });
};
beforeEach(() => jest.clearAllMocks());
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
test("sends to the backend before showing success and clearing fields", async () => {
  let finish;
  API.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  render(<HelpForm />); fill();
  fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(API.post).toHaveBeenCalledWith("support/messages/", expect.objectContaining({ email: "citizen@example.com" }));
  finish({ data: {} });
  expect(await screen.findByRole("dialog", { name: "Message sent successfully!" })).toBeInTheDocument();
  expect(screen.getByLabelText("Message")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
});
test("retains the message on failure and permits retry", async () => {
  API.post.mockRejectedValueOnce({ response: { data: { detail: "Please try later." } } });
  render(<HelpForm />); fill();
  fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try later.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Message")).toHaveValue("Please help me track my report.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Send Message" })).toBeEnabled());
});
