import { fireEvent, render, screen, within } from "@testing-library/react";
import ReportsAnalytics from "./ReportsAnalytics";

const lastUpdated = "2026-10-23T04:00:00Z";
const reports = [
  { id: 1, reference_id: "SUP-11111111", violation_type: "Obstruction", status: "Pending", date_reported: "2026-10-22T02:00:00Z", location: "Rizal Street" },
  { id: 2, reference_id: "SUP-22222222", violation_type: "No Parking", status: "Resolved", date_reported: "2026-10-01T02:00:00Z", location: "Borromeo Street" },
];
const metric = (label) => screen.getByText(label).closest(".ra-metric");

test("period filters update metrics and chart drilldown opens the chosen report", () => {
  const onOpenReport = jest.fn();
  render(<ReportsAnalytics reports={reports} lastUpdated={lastUpdated} onOpenReport={onOpenReport} />);
  expect(within(metric("Submitted reports")).getByText("2")).toBeInTheDocument();
  expect(within(metric("Resolution rate")).getByText("50.0%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Reporting period" }));
  fireEvent.click(screen.getByRole("option", { name: "Last 7 days" }));
  expect(within(metric("Submitted reports")).getByText("1")).toBeInTheDocument();
  expect(within(metric("Resolution rate")).getByText("0.0%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Oct 22.*1 reports/ }));
  fireEvent.click(screen.getByRole("button", { name: "SUP-11111111" }));
  expect(onOpenReport).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  expect(screen.getByRole("button", { name: "Clear day selection" })).toBeInTheDocument();
});

test("empty data does not show fake reports or a misleading percentage", () => {
  render(<ReportsAnalytics reports={[]} lastUpdated={lastUpdated} />);
  expect(screen.getByText("No reports in this period")).toBeInTheDocument();
  expect(within(metric("Resolution rate")).getByText("—")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
});

test("refresh failures identify a stale snapshot and offer retry", () => {
  const onRetry = jest.fn();
  render(<ReportsAnalytics reports={reports} lastUpdated={lastUpdated} error onRetry={onRetry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("last successfully loaded reports");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("custom dates are validated before showing analytics", () => {
  render(<ReportsAnalytics reports={reports} lastUpdated={lastUpdated} />);
  fireEvent.click(screen.getByRole("combobox", { name: "Reporting period" }));
  fireEvent.click(screen.getByRole("option", { name: "Custom dates" }));
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-23" } });
  fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-10-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a valid start and end date");
  expect(screen.queryByText("Submitted reports")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Print / PDF" })).toBeDisabled();
});

test("Print / PDF opens browser printing and keeps the selected reporting period", () => {
  const print = jest.spyOn(window, "print").mockImplementation(() => {});
  try {
    const { container } = render(<ReportsAnalytics reports={reports} lastUpdated={lastUpdated} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Reporting period" }));
    fireEvent.click(screen.getByRole("option", { name: "Last 7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(within(metric("Submitted reports")).getByText("1")).toBeInTheDocument();
    expect(container.querySelector(".ra-print-header")).toHaveTextContent("HapsayDalan");
    expect(container.querySelector(".ra-print-header")).toHaveTextContent("CTMO, Surigao City");
    expect(container.querySelectorAll(".ra-print-header")).toHaveLength(2);
    expect(container.querySelector(".ra-print-details .ra-print-header")).toHaveTextContent("Case Insights & Activity");
    expect(container.querySelector(".ra-print-header")).toHaveTextContent("Oct 16, 2026");
    expect(container.querySelector(".ra-print-header")).toHaveTextContent("Oct 23, 2026");
  } finally { print.mockRestore(); }
});

test("printing waits until reports have loaded", () => {
  const { rerender } = render(<ReportsAnalytics reports={[]} loading />);
  expect(screen.getByRole("button", { name: "Print / PDF" })).toBeDisabled();
  rerender(<ReportsAnalytics reports={[]} lastUpdated={lastUpdated} />);
  expect(screen.getByRole("button", { name: "Print / PDF" })).toBeEnabled();
});
