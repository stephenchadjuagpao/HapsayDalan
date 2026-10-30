import { render, screen, fireEvent } from "@testing-library/react";
import AdminMessages from "./AdminMessages";
import API from "../services/api";
jest.mock("../services/api", () => ({ get: jest.fn(), patch: jest.fn() }));
const item = { id: 1, subject: "Tracking help", name: "Citizen", email: "citizen@example.com", message: "Please help with my report.", created_at: "2026-10-27T12:00:00Z", read_at: null };
beforeEach(() => jest.clearAllMocks());
test("loads citizen messages and marks an opened message as read", async () => {
  API.get.mockResolvedValue({ data: { results: [item], count: 1 } });
  API.patch.mockResolvedValue({ data: { ...item, read_at: "2026-10-27T13:00:00Z" } });
  const onRead = jest.fn();
  render(<AdminMessages onRead={onRead} />);
  fireEvent.click(await screen.findByRole("button", { name: /Tracking help/ }));
  expect(await screen.findByText(item.message)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: item.email })).toHaveAttribute("href", `mailto:${item.email}`);
  expect(API.patch).toHaveBeenCalledWith("admin/messages/1/read/");
  expect(onRead).toHaveBeenCalledTimes(1);
});
test("shows loading failures and can refresh", async () => {
  API.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { results: [], count: 0 } });
  render(<AdminMessages />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load messages");
  fireEvent.click(screen.getByRole("button", { name: "Refresh messages" }));
  expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
});
