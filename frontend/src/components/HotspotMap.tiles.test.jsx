import { render, screen, waitFor } from "@testing-library/react";
import HotspotMap from "./HotspotMap";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn() }));
jest.mock("./ReportDirections", () => () => null);

afterEach(() => {
  delete window.L;
  jest.clearAllMocks();
});

test("admin hotspot tiles identify the website to OpenStreetMap and retain attribution", async () => {
  const controls = () => ({ enable: jest.fn() });
  const map = {
    scrollWheelZoom: controls(), dragging: controls(), doubleClickZoom: controls(),
    boxZoom: controls(), keyboard: controls(), touchZoom: controls(),
    invalidateSize: jest.fn(), setView: jest.fn(), fitBounds: jest.fn(),
  };
  const tileLayer = { addTo: jest.fn() };
  const markers = { addTo: jest.fn(), clearLayers: jest.fn(), addLayer: jest.fn() };
  markers.addTo.mockReturnValue(markers);
  window.L = {
    map: jest.fn(() => map),
    tileLayer: jest.fn(() => tileLayer),
    layerGroup: jest.fn(() => markers),
    circleMarker: jest.fn(() => ({ bindPopup: jest.fn(), bindTooltip: jest.fn(), on: jest.fn() })),
    latLngBounds: jest.fn(() => "hotspot-bounds"),
  };
  API.get.mockResolvedValue({ data: [{
    id: 1, location: "Rizal Street, Surigao City", latitude: 9.7843, longitude: 125.4888,
    violation_type: "Obstruction", date_reported: "2026-10-29T12:00:00Z",
  }] });

  render(<HotspotMap isEmbedded />);

  await waitFor(() => expect(window.L.tileLayer).toHaveBeenCalledWith(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    expect.objectContaining({
      referrerPolicy: "strict-origin-when-cross-origin",
      maxZoom: 19,
      attribution: expect.stringContaining('href="https://www.openstreetmap.org/copyright"'),
    })
  ));
  expect(window.L.tileLayer.mock.calls[0][1].attribution).toContain("OpenStreetMap</a> contributors");
  expect(tileLayer.addTo).toHaveBeenCalledWith(map);
  expect(API.get).toHaveBeenCalledWith("reports/");
  expect(await screen.findByRole("button", { name: /Rizal Street/ })).toBeInTheDocument();
});
