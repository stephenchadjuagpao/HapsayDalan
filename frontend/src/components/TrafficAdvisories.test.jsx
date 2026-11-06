import { act, fireEvent, render, screen } from "@testing-library/react";
import TrafficAdvisories from "./TrafficAdvisories";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), patch: jest.fn() }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); window.localStorage.clear(); });
afterEach(() => jest.useRealTimers());

test("public advisory component renders nothing (users go to /advisory page instead)", async () => {
  API.get.mockResolvedValue({ data: [{ id: 1, message: "Road work on Rizal St.", created_at: "2026-10-28T03:00:00Z" }] });
  const { container } = render(<TrafficAdvisories />);
  await act(async () => {});
  // Public users now navigate to /advisory; this component returns null for non-admin
  expect(container.firstChild).toBeNull();
});

test("public advisory does not display even when API returns data", async () => {
  API.get.mockResolvedValue({ data: [{ id: 42, message: "Lane closure", created_at: "2026-10-28T03:00:00Z" }] });
  const { container } = render(<TrafficAdvisories />);
  await act(async () => {});
  expect(container.firstChild).toBeNull();
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
