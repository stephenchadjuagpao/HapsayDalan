import { fireEvent, render, screen, within } from "@testing-library/react";
import TrackReport from "./TrackReport";
import API from "../services/api";

jest.mock("../components/reusablecode/Navbar", () => () => null);
jest.mock("../services/api", () => ({ get: jest.fn() }));

beforeEach(() => jest.resetAllMocks());

async function lookup(assigned_officer, status = "Pending", extra = {}) {
  API.get.mockResolvedValue({ data: {
    id: 1, reference_id: "SUP-12345678", violation_type: "Obstruction",
    location: "Surigao City", date_reported: "2026-10-25T08:00:00Z", status, assigned_officer, ...extra,
  } });
  render(<TrackReport />);
  fireEvent.change(screen.getByLabelText("Reference ID *"), { target: { value: "SUP-12345678" } });
  fireEvent.click(screen.getByRole("button", { name: "View Status" }));
  return (await screen.findByRole("heading", { name: "Report Details" })).closest("section");
}

test.each(["", null, undefined, "   "])("no officer is displayed for an unassigned report (%s)", async (officer) => {
  const details = await lookup(officer);
  expect(within(details).queryByText("Assigned Officer")).not.toBeInTheDocument();
  expect(screen.queryByText(/Officer Santos/)).not.toBeInTheDocument();
});

test("rejected reports show the admin explanation and red closed status without an assigned step", async () => {
  await lookup("", "Rejected", { rejection_reason_label: "Insufficient evidence", rejection_details: "Please provide a clearer image." });
  expect(screen.getByRole("complementary", { name: "Rejection explanation" })).toHaveTextContent("Insufficient evidence");
  expect(screen.getByText("Please provide a clearer image.")).toBeInTheDocument();
  expect(screen.getByText("Closed")).toHaveClass("track-status-badge-red");
  expect(screen.queryByText("Active")).not.toBeInTheDocument();
  expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  expect(screen.queryByText("Awaiting officer assignment.")).not.toBeInTheDocument();
});

test("legacy rejected reports explain that no rejection explanation was recorded", async () => {
  await lookup("", "Rejected");
  expect(screen.getByRole("complementary", { name: "Rejection explanation" })).toHaveTextContent("No rejection explanation was recorded");
});

test("displays only the officer returned by the backend", async () => {
  const details = await lookup("Officer Reyes", "Assigned");
  expect(within(details).getByText("Assigned Officer")).toBeInTheDocument();
  expect(within(details).getByText("Officer Reyes")).toBeInTheDocument();
  expect(screen.getByText("Case assigned to Officer Reyes for action.")).toBeInTheDocument();
  expect(screen.queryByText(/Officer Santos/)).not.toBeInTheDocument();
});

test("an assigned status without an officer never fabricates an officer in the timeline", async () => {
  await lookup("", "Assigned");
  expect(screen.getByText("Awaiting officer assignment.")).toBeInTheDocument();
  expect(screen.queryByText(/Officer Santos/)).not.toBeInTheDocument();
});
