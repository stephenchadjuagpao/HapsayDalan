import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ReportRecovery from "./ReportRecovery";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  API.get.mockResolvedValue({ data: { csrfToken: "csrf" } });
});

async function requestCode() {
  API.post.mockResolvedValueOnce({ data: { challenge_id: "challenge", detail: "Check your inbox." } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
  await screen.findByLabelText("6-digit verification code");
}

test("verifies email before showing reports and opens the selected reference", async () => {
  const onSelect = jest.fn();
  render(<ReportRecovery onSelect={onSelect} />);
  expect(screen.queryByText("My Reports", { exact: true })).not.toBeInTheDocument();
  await requestCode();
  API.post.mockResolvedValueOnce({ data: { access_token: "verified-token" } });
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "csrf/" ? { csrfToken: "csrf" } : [
    { id: 1, reference_id: "SUP-12345678", violation_type: "Obstruction", status: "Pending", date_reported: "2026-10-23", location: "Surigao" },
  ] }));
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & View My Reports" }));
  const report = await screen.findByRole("button", { name: /SUP-12345678/ });
  expect(API.get).toHaveBeenCalledWith("reports/my-reports/", { headers: { "X-Report-Access": "verified-token" } });
  fireEvent.click(report);
  expect(onSelect).toHaveBeenCalledWith("SUP-12345678");
  fireEvent.click(screen.getByRole("button", { name: "Close My Reports" }));
  expect(screen.queryByRole("button", { name: /SUP-12345678/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Email address")).toHaveValue("");
});

test("shows expired-code feedback and allows requesting a new code", async () => {
  render(<ReportRecovery onSelect={jest.fn()} />);
  await requestCode();
  API.post.mockRejectedValueOnce({ response: { data: { detail: "Code expired or unavailable. Request a new code." } } });
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & View My Reports" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Code expired");
  fireEvent.click(screen.getByRole("button", { name: "Use Another Email / Request a New Code" }));
  expect(screen.getByLabelText("Email address")).toBeEnabled();
  expect(screen.queryByLabelText("6-digit verification code")).not.toBeInTheDocument();
});

test.each([
  ["1154", "Request was throttled. Expected available in 1154 seconds.", "19 minutes and 14 seconds"],
  [undefined, "Please wait 60 seconds before requesting another code.", "1 minute"],
  ["59", "Request was throttled.", "59 seconds"],
  ["1", "Request was throttled.", "1 second"],
])("shows a readable rate-limit wait (%s seconds) without opening verification", async (wait, detail, readable) => {
  API.post.mockRejectedValueOnce({ response: { status: 429, headers: wait ? { "retry-after": wait } : {}, data: { detail } } });
  render(<ReportRecovery onSelect={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "me@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(readable));
  expect(screen.queryByLabelText("6-digit verification code")).not.toBeInTheDocument();
});

test("filters report cards by status, shows rejection feedback and updates after refresh", async () => {
  const onSelect = jest.fn();
  render(<ReportRecovery onSelect={onSelect} />);
  await requestCode();
  API.post.mockResolvedValueOnce({ data: { access_token: "verified-token" } });
  let reports = [
    { id: 1, reference_id: "SUP-11111111", violation_type: "Obstruction", status: "Rejected", date_reported: "2026-10-25", location: "Surigao",
      rejection_reason_label: "Insufficient evidence", rejection_details: "Please provide a clearer image." },
    { id: 2, reference_id: "SUP-22222222", violation_type: "Illegal turn", status: "Pending", date_reported: "2026-10-25", location: "Surigao" },
    { id: 3, reference_id: "SUP-33333333", violation_type: "Illegal parking", status: "Resolved", date_reported: "2026-10-25", location: "Surigao" },
  ];
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "csrf/" ? { csrfToken: "csrf" } : reports }));
  fireEvent.change(screen.getByLabelText("6-digit verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify & View My Reports" }));
  const rejected = await screen.findByRole("button", { name: /View report SUP-11111111/ });
  expect(within(rejected).getByText("Insufficient evidence")).toBeInTheDocument();
  expect(within(rejected).getByText("Please provide a clearer image.")).toBeInTheDocument();
  expect(screen.getByText("3 of 3 reports")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
  fireEvent.click(screen.getByRole("option", { name: "Rejected" }));
  expect(screen.getByText("1 of 3 reports")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /View report SUP-22222222/ })).not.toBeInTheDocument();
  fireEvent.click(rejected);
  expect(onSelect).toHaveBeenCalledWith("SUP-11111111");
  reports = reports.map((report) => report.id === 1 ? { ...report, status: "Resolved" } : report);
  fireEvent.click(screen.getByRole("button", { name: "Refresh My Reports" }));
  expect(await screen.findByText("No reports match this status.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all reports" }));
  expect(screen.getByRole("button", { name: /View report SUP-11111111: Obstruction, Resolved/ })).toBeInTheDocument();
  expect(screen.queryByText("Please provide a clearer image.")).not.toBeInTheDocument();
});
