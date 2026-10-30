import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock("./HotspotMap", () => () => null);
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

test("publishing an advisory saves it and shows it in the admin workspace", async () => {
  let saved = [];
  API.get.mockImplementation((url) => Promise.resolve({ data: url === "admin/advisories/" ? saved : [] }));
  API.post.mockImplementation((_url, payload) => {
    const advisory = { id: 1, ...payload, created_at: "2026-10-28T03:00:00Z" };
    saved = [advisory];
    return Promise.resolve({ data: advisory });
  });
  render(<AdminDashboard />);
  fireEvent.click(screen.getByRole("button", { name: "Send Advisory Alert" }));
  fireEvent.change(screen.getByPlaceholderText(/Heavy congestion along Rizal St/), { target: { value: "Road closed at Rizal St." } });
  fireEvent.click(screen.getByRole("button", { name: "Broadcast Advisory" }));
  await waitFor(() => expect(API.post).toHaveBeenCalledWith("admin/advisories/", {
    message: "Road closed at Rizal St.", audience: "all",
  }));
  expect(await screen.findByText("Road closed at Rizal St.")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Broadcast Traffic Advisory" })).not.toBeInTheDocument();
});
