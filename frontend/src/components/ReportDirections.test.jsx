import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportDirections from "./ReportDirections";
import loadLeafletAssets from "../utils/leafletAssets";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn() }));
jest.mock("../utils/leafletAssets");
let clickMap;
let map;
beforeEach(() => {
  jest.clearAllMocks();
  map = { setView: jest.fn(), on: jest.fn((event, callback) => { clickMap = callback; }), remove: jest.fn(),
    removeLayer: jest.fn(), fitBounds: jest.fn(), invalidateSize: jest.fn() };
  map.setView.mockReturnValue(map);
  const layer = () => { const value = { addTo: jest.fn(), bindTooltip: jest.fn(), getBounds: jest.fn(() => "bounds") };
    value.addTo.mockReturnValue(value); return value; };
  window.L = { map: jest.fn(() => map), tileLayer: jest.fn(layer), marker: jest.fn(layer), circleMarker: jest.fn(layer), geoJSON: jest.fn(layer) };
  loadLeafletAssets.mockResolvedValue(window.L);
  API.get.mockResolvedValue({ data: { geometry: { type: "LineString", coordinates: [[125.48, 9.78], [125.49, 9.79]] },
    distance: 2000, duration: 240, preference: "shortest", steps: [{ instruction: "Turn left", distance: 200 }] } });
});

test("missing coordinates never substitute a default destination", () => {
  render(<ReportDirections latitude={null} longitude={null} />);
  expect(screen.getByText(/no valid map coordinates/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(API.get).not.toHaveBeenCalled();
});

test("admin selects origin and requests shortest route to the report pin", async () => {
  const { unmount } = render(<ReportDirections latitude={9.79} longitude={125.49} label="Reported street" />);
  fireEvent.click(screen.getByRole("button", { name: "Get directions to this location" }));
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  expect(window.L.tileLayer).toHaveBeenCalledWith("https://tile.openstreetmap.org/{z}/{x}/{y}.png", expect.objectContaining({
    referrerPolicy: "strict-origin-when-cross-origin", maxZoom: 19,
  }));
  expect(screen.getByRole("button", { name: "Show driving route" })).toBeDisabled();
  act(() => clickMap({ latlng: { lat: 9.78, lng: 125.48 } }));
  fireEvent.click(screen.getByRole("button", { name: "Show driving route" }));
  await screen.findByText(/2.0 km/);
  expect(API.get).toHaveBeenCalledWith("report-route/", expect.objectContaining({ params: {
    start_lat: 9.78, start_lng: 125.48, end_lat: 9.79, end_lng: 125.49, preference: "shortest",
  } }));
  expect(map.fitBounds).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("combobox", { name: "Route preference" }));
  fireEvent.click(screen.getByRole("option", { name: "Fastest estimated drive" }));
  expect(screen.queryByText(/2.0 km/)).not.toBeInTheDocument();
  unmount();
  expect(map.remove).toHaveBeenCalled();
});

test("unavailable service shows error without drawing a route", async () => {
  API.get.mockRejectedValue({ response: { data: { detail: "Routing key is missing." } } });
  render(<ReportDirections latitude={9.79} longitude={125.49} />);
  fireEvent.click(screen.getByRole("button", { name: "Get directions to this location" }));
  await waitFor(() => expect(window.L.map).toHaveBeenCalled());
  act(() => clickMap({ latlng: { lat: 9.78, lng: 125.48 } }));
  fireEvent.click(screen.getByRole("button", { name: "Show driving route" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Routing key is missing");
  expect(window.L.geoJSON).not.toHaveBeenCalled();
});
