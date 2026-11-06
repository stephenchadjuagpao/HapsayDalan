import { render, screen } from "@testing-library/react";
import SuspiciousReportNotice from "./SuspiciousReportNotice";

test.each([
  [25919, "17 days, 23 hours, 59 minutes"],
  [1440, "1 day"],
  [60, "1 hour"],
  [61, "1 hour, 1 minute"],
  [11, "11 minutes"],
])("future incident warning formats %i minutes without changing report data", (minutes, expected) => {
  const detail = `The incident time is ${minutes} minutes after submission. Check the reported date and time.`;
  const report = { suspicious_flags: [{ code: "future_incident_time", title: "Incident time is in the future", detail }] };
  render(<SuspiciousReportNotice report={report} />);
  expect(screen.getByText(`The incident time is ${expected} after submission. Check the reported date and time.`)).toBeInTheDocument();
  expect(report.suspicious_flags[0].detail).toBe(detail);
  expect(screen.getByRole("heading", { name: "Review flags (1)" })).toBeInTheDocument();
});

test("other review flag messages keep their original wording", () => {
  const detail = "3 reports were submitted with this email within 10 minutes.";
  render(<SuspiciousReportNotice report={{ suspicious_flags: [{ code: "rapid_submissions", title: "Multiple reports", detail }] }} />);
  expect(screen.getByText(detail)).toBeInTheDocument();
});
