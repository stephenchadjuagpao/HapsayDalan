import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock("./HotspotMap", () => () => null);
jest.mock("./ReportDirections", () => () => null);
jest.mock("./AdditionalEvidence", () => () => null);
jest.mock("./AdminActivityHistory", () => () => null);
jest.mock("./TrafficAdvisories", () => () => null);
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

const report = { id: 7, reference_id: "SUP-12345678", violation_type: "Obstruction",
  location: "Surigao", date_reported: "2026-10-29T10:00:00Z", status: "Pending" };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.setItem("ctmo_admin_authenticated", "true");
});
afterEach(() => sessionStorage.clear());

async function openCase() {
  fireEvent.click(screen.getByRole("button", { name: /Reports Queue/ }));
  const queue = screen.getByRole("table", { name: "Reports queue" });
  await within(queue).findByText(report.reference_id);
  fireEvent.click(within(queue).getByRole("button", { name: "Review" }));
}

test("case deletion needs confirmation, removes the case, and refreshes the queue", async () => {
  let reports = [report];
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "reports/" ? reports
    : url === "admin/me/" ? { is_superuser: true } : { unread_count: 0 } }));
  API.delete.mockImplementation(() => { reports = []; return Promise.resolve({}); });
  render(<AdminDashboard />);
  await openCase();

  fireEvent.click(screen.getByRole("button", { name: "Delete Case" }));
  const confirmation = screen.getByRole("alertdialog", { name: `Delete Case ${report.reference_id}` });
  expect(within(confirmation).getByText(/This cannot be undone/)).toBeInTheDocument();
  expect(API.delete).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole("button", { name: "Keep Case" }));
  expect(screen.getByRole("dialog", { name: `Review Case ${report.reference_id}` })).toBeInTheDocument();
  expect(API.delete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Delete Case" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Case Permanently" }));
  await waitFor(() => expect(API.delete).toHaveBeenCalledWith("reports/7/"));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(within(screen.getByRole("table", { name: "Reports queue" })).queryByText(report.reference_id)).not.toBeInTheDocument();
  expect(screen.getByText(`Case ${report.reference_id} deleted.`)).toBeInTheDocument();
});

test("a failed delete leaves the case and shows the server error", async () => {
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "reports/" ? [report]
    : url === "admin/me/" ? { is_superuser: true } : { unread_count: 0 } }));
  API.delete.mockRejectedValue({ response: { data: { detail: "You do not have permission to delete this case." } } });
  render(<AdminDashboard />);
  await openCase();
  fireEvent.click(screen.getByRole("button", { name: "Delete Case" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Case Permanently" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to delete this case.");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "Reports queue" })).getByText(report.reference_id)).toBeInTheDocument();
});
