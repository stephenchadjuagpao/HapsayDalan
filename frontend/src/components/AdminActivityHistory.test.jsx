import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminActivityHistory from "./AdminActivityHistory";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn() }));
const event = { id: 1, actor_name: "Anna Reyes", actor_username: "reviewer", report_id: 7,
  report_reference: "SUP-12345678", action: "case_updated", action_label: "Case updated", created_at: "2026-10-25T12:00:00Z",
  changes: { status: { before: "Pending", after: "Validated" }, assigned_officer: { before: "", after: "Officer Reyes" } }, notes: "Evidence checked." };
beforeEach(() => { jest.resetAllMocks(); API.get.mockResolvedValue({ data: { count: 1, results: [event] } }); });

test("shows real actor, before and after, private note, and opens the case", async () => {
  const open = jest.fn();
  render(<AdminActivityHistory onOpenReport={open} />);
  expect(await screen.findByText("Anna Reyes")).toBeInTheDocument();
  expect(screen.getByText("Pending Verification")).toBeInTheDocument();
  expect(screen.getByText("Validated")).toBeInTheDocument();
  expect(screen.getByText("Evidence checked.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "SUP-12345678" }));
  expect(open).toHaveBeenCalledWith(7);
  expect(API.get).toHaveBeenLastCalledWith("admin/activity/", { params: { page: 1, page_size: 25 } });
});

test("filters searches and actions and clears them", async () => {
  render(<AdminActivityHistory />);
  await screen.findByText("Anna Reyes");
  fireEvent.change(screen.getByRole("textbox", { name: "Search activity" }), { target: { value: " SUP-123 " } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(API.get).toHaveBeenLastCalledWith("admin/activity/", { params: { page: 1, page_size: 25, q: "SUP-123" } }));
  fireEvent.click(screen.getByRole("combobox", { name: "Filter activity action" }));
  fireEvent.click(screen.getByRole("option", { name: "Admin note added" }));
  await waitFor(() => expect(API.get).toHaveBeenLastCalledWith("admin/activity/", { params: { page: 1, page_size: 25, q: "SUP-123", action: "note_added" } }));
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(API.get).toHaveBeenLastCalledWith("admin/activity/", { params: { page: 1, page_size: 25 } }));
});

test("case history is scoped to the selected report", async () => {
  render(<AdminActivityHistory reportId={7} compact />);
  await screen.findByText("Anna Reyes");
  expect(API.get).toHaveBeenLastCalledWith("admin/activity/", { params: { page: 1, page_size: 10, report_id: 7 } });
  expect(screen.queryByRole("textbox", { name: "Search activity" })).not.toBeInTheDocument();
});

test("loads additional pages and resets to page one after a case update", async () => {
  API.get.mockImplementation((url, { params }) => Promise.resolve({ data: { count: 2, results: [{ ...event, id: params.page, notes: `Page ${params.page}` }] } }));
  const { rerender } = render(<AdminActivityHistory refreshKey={0} />);
  await screen.findByText("Page 1");
  fireEvent.click(screen.getByRole("button", { name: "Load more activity" }));
  await screen.findByText("Page 2");
  expect(screen.getByText("Showing 2 of 2 activities")).toBeInTheDocument();
  rerender(<AdminActivityHistory refreshKey={1} />);
  await waitFor(() => expect(screen.queryByText("Page 2")).not.toBeInTheDocument());
  expect(screen.getByText("Page 1")).toBeInTheDocument();
});

test("handles errors, retries, and explains empty history without inventing old events", async () => {
  API.get.mockRejectedValue(new Error("Offline"));
  render(<AdminActivityHistory />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load activity history");
  API.get.mockResolvedValue({ data: { count: 0, results: [] } });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No activity recorded yet")).toBeInTheDocument();
  expect(screen.getByText(/Earlier actions are not reconstructed/)).toBeInTheDocument();
});

test("retains deleted case references without an open-case button", async () => {
  API.get.mockResolvedValue({ data: { count: 1, results: [{ ...event, report_id: null }] } });
  render(<AdminActivityHistory onOpenReport={jest.fn()} />);
  expect(await screen.findByText("SUP-12345678 (deleted case)")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "SUP-12345678" })).not.toBeInTheDocument();
});
