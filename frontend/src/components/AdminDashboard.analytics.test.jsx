import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), patch: jest.fn() }));
jest.mock("./HotspotMap", () => () => null);
jest.mock("../hooks/useOfficers", () => () => ({ loading: false, error: "", officers: [
  { id: 1, name: "Officer Santos", badge: "CTMO-104", unit: "Traffic Enforcer Unit 1" },
  { id: 2, name: "Officer Reyes", badge: "CTMO-118", unit: "Mobile Patrol Unit" },
  { id: 3, name: "Officer Dela Cruz", badge: "CTMO-205", unit: "Central District Unit" },
  { id: 4, name: "Officer Martinez", badge: "CTMO-312", unit: "Highway Patrol Unit" },
] }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  sessionStorage.setItem("ctmo_admin_authenticated", "true");
});
test("Messages menu badge refreshes and decreases after a message is read", async () => {
  let unread = 2;
  const message = { id: 1, subject: "Help needed", name: "Citizen", email: "citizen@example.com", message: "Tracking question", created_at: "2026-10-27T12:00:00Z", read_at: null };
  API.get.mockImplementation((url) => Promise.resolve({ data: url.includes("unread-count") ? { unread_count: unread } :
    url === "admin/messages/" ? { count: 1, results: [message] } : [] }));
  API.patch.mockImplementation(() => {
    unread = 1;
    return Promise.resolve({ data: { ...message, read_at: "2026-10-27T13:00:00Z" } });
  });
  render(<AdminDashboard />);
  expect(await screen.findByLabelText("2 unread messages")).toHaveClass("admin-tab-badge");
  fireEvent.click(screen.getByRole("button", { name: /Messages/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Help needed/ }));
  expect(await screen.findByLabelText("1 unread messages")).toBeInTheDocument();
  unread = 0;
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(screen.queryByLabelText(/unread messages/)).not.toBeInTheDocument();
});
afterEach(() => { jest.useRealTimers(); sessionStorage.clear(); });

test("admin menu opens, closes after selection or Escape, and resets when resizing to desktop", async () => {
  const original = window.matchMedia;
  const desktop = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn((query) => query === "(min-width:1101px)" ? desktop :
    { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  API.get.mockResolvedValue({ data: [] });
  try {
    const { unmount } = render(<AdminDashboard />);
    await act(async () => {});
    const open = screen.getByRole("button", { name: "Open admin navigation" });
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Your workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Case Assignment" }));
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { name: "Case Assignment" })).toBeInTheDocument();
    fireEvent.click(open);
    fireEvent.keyDown(open, { key: "Escape" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(open).toHaveFocus();
    fireEvent.click(open);
    act(() => desktop.addEventListener.mock.calls[0][1]({ matches: true }));
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(API.patch).not.toHaveBeenCalled();
    unmount();
    expect(desktop.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  } finally { window.matchMedia = original; }
});

test("private admin notes are sent with the saved review and activity has a dedicated tab", async () => {
  const report = { id: 1, reference_id: "SUP-12345678", violation_type: "Obstruction", location: "Surigao",
    date_reported: new Date().toISOString(), status: "Pending" };
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "reports/" ? [report] : { count: 0, results: [] } }));
  API.patch.mockResolvedValue({ data: report });
  render(<AdminDashboard />);
  await screen.findByText(report.reference_id);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /SUP-12345678/ })); });
  expect(screen.getByRole("region", { name: "Case activity" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Officer Admin Action Notes"), { target: { value: "  Checked original photo.  " } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save & Update Case" })); });
  expect(API.patch).toHaveBeenCalledWith("reports/1/", { status: "Pending", assigned_officer: "", admin_note: "Checked original photo." });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Activity History" })); });
  expect(screen.getByRole("region", { name: "Admin Activity History" })).toBeInTheDocument();
});

test("overview shortcuts clear stale queue filters and open the intended reports", async () => {
  const base = { violation_type: "Obstruction", location: "Surigao", date_reported: new Date().toISOString() };
  API.get.mockResolvedValue({ data: [
    { ...base, id: 1, reference_id: "SUP-PENDING", status: "Pending" },
    { ...base, id: 2, reference_id: "SUP-FLAGGED", status: "Validated", suspicious_flags: [{ code: "rapid_submissions", title: "Review submissions" }] },
    { ...base, id: 3, reference_id: "SUP-DUPLICATE", status: "Resolved", possible_duplicate: true },
  ] });
  render(<AdminDashboard />);
  await screen.findByRole("button", { name: /1 report with review flags/ });
  fireEvent.click(screen.getByRole("button", { name: "Review pending reports" }));
  const table = screen.getByRole("table", { name: "Reports queue" });
  expect(within(table).getByText("SUP-PENDING")).toBeInTheDocument();
  expect(within(table).queryByText("SUP-FLAGGED")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Search reports" }), { target: { value: "missing" } });
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: /1 report with review flags/ }));
  expect(screen.getByRole("textbox", { name: "Search reports" })).toHaveValue("");
  const flaggedTable = screen.getByRole("table", { name: "Reports queue" });
  expect(within(flaggedTable).getByText("SUP-FLAGGED")).toBeInTheDocument();
  expect(within(flaggedTable).queryByText("SUP-PENDING")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  fireEvent.click(screen.getByRole("button", { name: /1 possible duplicate/ }));
  expect(screen.getByRole("checkbox", { name: "Show reports with review flags only" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Show possible duplicates only" })).toBeChecked();
  expect(within(screen.getByRole("table", { name: "Reports queue" })).getByText("SUP-DUPLICATE")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByText("3 of 3 reports")).toBeInTheDocument();
  expect(API.patch).not.toHaveBeenCalled();
});

test("officer workload counts current assignments and excludes closed reports", async () => {
  API.get.mockResolvedValue({ data: ["Assigned", "Resolved", "Rejected"].map((status, id) => ({
    id, reference_id: `SUP-${id}`, status, assigned_officer: "Officer Santos", date_reported: new Date().toISOString(),
  })) });
  render(<AdminDashboard />);
  await screen.findByText("SUP-0");
  fireEvent.click(screen.getByRole("button", { name: "Case Assignment" }));
  const santos = screen.getByText("Officer Santos").closest(".admin-officer-card");
  const reyes = screen.getByText("Officer Reyes").closest(".admin-officer-card");
  expect(santos.querySelector(".admin-officer-cases strong")).toHaveTextContent("1");
  expect(reyes.querySelector(".admin-officer-cases strong")).toHaveTextContent("0");
});

test("assigning a new case to Reyes keeps Santos's existing case", async () => {
  const base = { violation_type: "Obstruction", location: "Surigao", public_verified_at: "2026-10-29T10:00:00Z" };
  let reports = [
    { ...base, id: 1, reference_id: "SUP-SANTOS", status: "Assigned", assigned_officer: "Officer Santos" },
    { ...base, id: 2, reference_id: "SUP-AVAILABLE", status: "Validated", assigned_officer: "" },
    { ...base, id: 3, reference_id: "SUP-PENDING", status: "Pending", assigned_officer: "" },
  ];
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "reports/" ? reports : [] }));
  API.patch.mockImplementation((url, payload) => {
    reports = reports.map((report) => report.id === 2 ? { ...report, ...payload } : report);
    return Promise.resolve({ data: reports[1] });
  });
  render(<AdminDashboard />);
  await screen.findByText("SUP-SANTOS");
  fireEvent.click(screen.getByRole("button", { name: "Case Assignment" }));
  const santos = screen.getByText("Officer Santos").closest(".admin-officer-card");
  const reyes = screen.getByText("Officer Reyes").closest(".admin-officer-card");
  fireEvent.click(within(reyes).getByRole("button", { name: "Assign Cases" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("SUP-AVAILABLE")).toBeInTheDocument();
  expect(within(dialog).queryByText("SUP-SANTOS")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("SUP-PENDING")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(API.patch).toHaveBeenCalledWith("reports/2/", { assigned_officer: "Officer Reyes", status: "Assigned" });
  expect(santos.querySelector(".admin-officer-cases strong")).toHaveTextContent("1");
  expect(reyes.querySelector(".admin-officer-cases strong")).toHaveTextContent("1");
  fireEvent.click(within(reyes).getByRole("button", { name: "Assign Cases" }));
  expect(within(screen.getByRole("dialog")).getByText(/No verified, unassigned cases are available/)).toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
});

test("admin must provide a reason and reporter explanation before rejecting", async () => {
  const report = { id: 1, reference_id: "SUP-11111111", violation_type: "Obstruction", location: "Surigao",
    date_reported: new Date().toISOString(), status: "Pending" };
  API.get.mockResolvedValue({ data: [report] });
  API.patch.mockResolvedValue({ data: { ...report, status: "Rejected" } });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: /Reports Queue/ }));
  const row = (await screen.findByText(report.reference_id)).closest("tr");
  await act(async () => { fireEvent.click(within(row).getByRole("button", { name: "Review" })); });
  fireEvent.click(screen.getByRole("combobox", { name: "Update Case Status" }));
  fireEvent.click(screen.getByRole("option", { name: "Rejected" }));
  fireEvent.click(screen.getByRole("button", { name: "Save & Update Case" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Select a rejection reason");
  expect(API.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Rejection reason *"));
  fireEvent.click(screen.getByRole("option", { name: "Insufficient evidence" }));
  fireEvent.click(screen.getByRole("button", { name: "Save & Update Case" }));
  expect(API.patch).not.toHaveBeenCalled();
  const explanation = screen.getByLabelText("Explanation for the reporter *");
  expect(explanation).toHaveAttribute("maxlength", "1000");
  fireEvent.change(explanation, { target: { value: "  Please provide a clearer image.  " } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save & Update Case" })); });
  expect(API.patch).toHaveBeenCalledWith("reports/1/", { status: "Rejected", assigned_officer: "",
    rejection_reason: "insufficient_evidence", rejection_details: "Please provide a clearer image." });
  expect(screen.queryByRole("heading", { name: /Review Case/ })).not.toBeInTheDocument();
});

test("admin can filter review flags and inspect reasons and related reports without changing cases", async () => {
  const base = { violation_type: "Obstruction", location: "Surigao", date_reported: new Date().toISOString(), status: "Pending" };
  API.get.mockResolvedValue({ data: [
    { ...base, id: 1, reference_id: "SUP-11111111", suspicious_flags: [{ code: "rapid_submissions", title: "Multiple reports from the same email",
      detail: "3 reports within 10 minutes. Review them together.", related_reports: [{ id: 2, reference_id: "SUP-22222222" }] }] },
    { ...base, id: 2, reference_id: "SUP-22222222", suspicious_flags: [] },
  ] });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: /Reports Queue/ }));
  await screen.findByText("SUP-22222222");
  fireEvent.click(screen.getByRole("checkbox", { name: "Show reports with review flags only" }));
  expect(screen.queryByText("SUP-22222222")).not.toBeInTheDocument();
  const row = screen.getByText("SUP-11111111").closest("tr");
  expect(within(row).getByText("Review flags (1)")).toBeInTheDocument();
  await act(async () => { fireEvent.click(within(row).getByRole("button", { name: "Review" })); });
  expect(screen.getByRole("region", { name: "Suspicious report flags" })).toHaveTextContent("They do not prove a false report");
  expect(screen.getByText("Multiple reports from the same email")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review SUP-22222222" })); });
  expect(screen.getByRole("heading", { name: "Review Case SUP-22222222" })).toBeInTheDocument();
  expect(API.patch).not.toHaveBeenCalled();
});

test.each([true, false])("review saves approval and handles server success=%s", async (succeeds) => {
  const report = { id: 1, reference_id: "SUP-11111111", violation_type: "Obstruction", location: "Surigao",
    date_reported: new Date().toISOString(), status: "Pending", public_verified_at: null };
  API.get.mockResolvedValue({ data: [report] });
  if (succeeds) API.patch.mockResolvedValue({ data: { ...report, status: "Validated", public_verified_at: new Date().toISOString() } });
  else API.patch.mockRejectedValue({ response: { data: { status: ["Validation could not be saved."] } } });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: /Reports Queue/ }));
  const row = (await screen.findByText(report.reference_id)).closest("tr");
  expect(within(row).getByText("Pending Verification")).toBeInTheDocument();
  await act(async () => { fireEvent.click(within(row).getByRole("button", { name: "Review" })); });
  fireEvent.click(screen.getByRole("combobox", { name: "Update Case Status" }));
  expect(screen.getByRole("option", { name: "Assigned" })).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(screen.getByRole("option", { name: /approve for public map/ }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save & Update Case" })); });
  await waitFor(() => expect(API.patch).toHaveBeenCalledWith("reports/1/", { status: "Validated", assigned_officer: "" }));
  if (succeeds) {
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Review Case/ })).not.toBeInTheDocument());
    expect(screen.getByText("Case SUP-11111111 updated successfully!")).toBeInTheDocument();
  } else {
    expect(await screen.findByRole("alert")).toHaveTextContent("Validation could not be saved.");
    expect(screen.getByRole("heading", { name: /Review Case/ })).toBeInTheDocument();
    expect(screen.queryByText(/updated successfully/)).not.toBeInTheDocument();
  }
});

test("an empty API refresh clears previous reports and analytics", async () => {
  let reportLoads = 0;
  API.get.mockImplementation((url) => {
    if (url !== "reports/") return Promise.resolve({ data: { unread_count: 0 } });
    return Promise.resolve({ data: reportLoads++ === 0 ? [{ id: 1, reference_id: "SUP-12345678", violation_type: "Obstruction",
      location: "Surigao", date_reported: new Date().toISOString(), status: "Pending" }] : [] });
  });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Analytics" }));
  await waitFor(() => expect(within(screen.getByText("Submitted reports").closest(".ra-metric")).getByText("1")).toBeInTheDocument());
  await act(async () => jest.advanceTimersByTime(3000));
  expect(screen.getByText("No reports in this period")).toBeInTheDocument();
  expect(within(screen.getByText("Submitted reports").closest(".ra-metric")).getByText("0")).toBeInTheDocument();
});

test("initial API failure shows a connection error without sample analytics", async () => {
  API.get.mockRejectedValue(new Error("Offline"));
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Analytics" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Reports could not be loaded"));
  expect(screen.queryByText("SUP-24091201")).not.toBeInTheDocument();
  expect(within(screen.getByText("Submitted reports").closest(".ra-metric")).getByText("0")).toBeInTheDocument();
});

test("duplicate flags can be filtered and compared without automatically updating reports", async () => {
  const base = { violation_type: "Obstruction", location: "Surigao", date_reported: new Date().toISOString(),
    status: "Pending", image: "/media/example.jpg", latitude: 9.79, longitude: 125.49 };
  const match = (id, reference_id) => ({ id, reference_id, violation_type: "Obstruction", location: "Surigao",
    distance_m: 25, time_difference_minutes: 10, time_basis: "incident time", image: "/media/example.jpg",
    match_type: id === 1 ? "visual" : "exact" });
  API.get.mockResolvedValue({ data: [
    { ...base, id: 1, reference_id: "SUP-11111111", possible_duplicate: true, duplicate_matches: [match(2, "SUP-22222222")] },
    { ...base, id: 2, reference_id: "SUP-22222222", possible_duplicate: true, duplicate_matches: [match(1, "SUP-11111111")] },
    { ...base, id: 3, reference_id: "SUP-33333333", possible_duplicate: false, duplicate_matches: [] },
  ] });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: /Reports Queue/ }));
  await screen.findByText("SUP-33333333");
  fireEvent.click(screen.getByRole("checkbox", { name: "Show possible duplicates only" }));
  expect(screen.queryByText("SUP-33333333")).not.toBeInTheDocument();
  const row = screen.getByText("SUP-22222222").closest("tr");
  await act(async () => { fireEvent.click(within(row).getByRole("button", { name: "Review" })); });
  expect(screen.getByRole("heading", { name: /Possible duplicate/ })).toBeInTheDocument();
  expect(screen.getByText(/25 m apart/)).toBeInTheDocument();
  expect(screen.getByText("Visually similar photo")).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Review matched report" })); });
  expect(screen.getByRole("heading", { name: "Review Case SUP-11111111" })).toBeInTheDocument();
  expect(API.patch).not.toHaveBeenCalled();
});
