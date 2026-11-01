import { render, screen, waitFor } from "@testing-library/react";
import HotspotMap from "./HotspotMap";

jest.mock("../services/api", () => ({ get: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock("./ReportDirections", () => () => null);

test("renders intensity legend with High, Medium, and Low levels", async () => {
  render(<HotspotMap />);

  expect(screen.getByText("Community Hotspot Overview")).toBeInTheDocument();
  expect(screen.getByLabelText("Hotspot intensity legend")).toBeInTheDocument();
  expect(screen.getByText("Intensity")).toBeInTheDocument();
  expect(screen.getByText("High")).toBeInTheDocument();
  expect(screen.getByText("Medium")).toBeInTheDocument();
  expect(screen.getByText("Low")).toBeInTheDocument();

  await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
});

test("renders intensity legend in embedded mode for admin dashboard", async () => {
  render(<HotspotMap isEmbedded={true} />);

  expect(screen.getByLabelText("Hotspot intensity legend")).toBeInTheDocument();
  expect(screen.getByText("Intensity")).toBeInTheDocument();
  expect(screen.getByText("High")).toBeInTheDocument();
  expect(screen.getByText("Medium")).toBeInTheDocument();
  expect(screen.getByText("Low")).toBeInTheDocument();

  await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
});
