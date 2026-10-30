import { act, fireEvent, render, screen } from "@testing-library/react";
import TrafficAdvisories from "./TrafficAdvisories";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), patch: jest.fn() }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); window.localStorage.clear(); });
afterEach(() => jest.useRealTimers());

test("public advisory counts down from five seconds and only reappears for a new advisory", async () => {
  let rows = [{ id: 1, message: "Road work on Rizal St.", created_at: "2026-10-28T03:00:00Z" }];
  API.get.mockImplementation(() => Promise.resolve({ data: rows }));
  const { rerender } = render(<TrafficAdvisories />);
  await act(async () => {});
  expect(screen.getByText("Road work on Rizal St.")).toBeInTheDocument();
  expect(screen.getByText("Closes in 5s")).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText("Closes in 4s")).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(4000));
  expect(screen.queryByText("Road work on Rizal St.")).not.toBeInTheDocument();
  rerender(<TrafficAdvisories refreshKey={1} />);
  await act(async () => {});
  expect(screen.queryByText("Road work on Rizal St.")).not.toBeInTheDocument();
  rows = [{ id: 2, message: "New traffic update", created_at: "2026-10-28T03:01:00Z" }];
  rerender(<TrafficAdvisories refreshKey={2} />);
  await act(async () => {});
  expect(screen.getByText("New traffic update")).toBeInTheDocument();
  expect(screen.getByText("Closes in 5s")).toBeInTheDocument();
});

test("a citizen does not see the same advisory again after reopening the homepage", async () => {
  API.get.mockResolvedValue({ data: [{ id: 42, message: "Lane closure", created_at: "2026-10-28T03:00:00Z" }] });
  const firstVisit = render(<TrafficAdvisories />);
  await act(async () => {});
  expect(screen.getByText("Lane closure")).toBeInTheDocument();
  firstVisit.unmount();
  render(<TrafficAdvisories />);
  await act(async () => {});
  expect(screen.queryByText("Lane closure")).not.toBeInTheDocument();
});

test("admin can find an archived advisory in All Advisories", async () => {
  const rows = [{ id: 7, message: "Temporary road closure", audience: "public", created_at: "2026-10-28T03:00:00Z", archived_at: null }];
  API.get.mockImplementation((path) => Promise.resolve({ data: path.includes("status=all")
    ? { count: rows.length, results: [...rows] }
    : rows.filter((row) => !row.archived_at) }));
  API.patch.mockImplementation(() => {
    rows[0].archived_at = "2026-10-28T04:00:00Z";
    return Promise.resolve({ data: rows[0] });
  });
  render(<TrafficAdvisories admin />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Archive advisory" }));
  await act(async () => {});
  expect(screen.queryByText("Temporary road closure")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All Advisories" }));
  await act(async () => {});
  expect(screen.getByText("Temporary road closure")).toBeInTheDocument();
  expect(screen.getByText(/Archived Oct/)).toBeInTheDocument();
});
