import { act, renderHook } from "@testing-library/react";
import useAutomaticReportRoute from "./useAutomaticReportRoute";
import API from "../services/api";

jest.mock("../services/api", () => ({ get: jest.fn() }));
const origin = { latitude: 9.78, longitude: 125.48 };
const destination = { latitude: 9.79, longitude: 125.49 };
const route = { geometry: { type: "LineString", coordinates: [[125.48, 9.78], [125.49, 9.79]] }, distance: 700, duration: 180, steps: [] };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); API.get.mockResolvedValue({ data: route }); });
afterEach(() => jest.useRealTimers());

test("automatically requests shortest route after destination is selected", async () => {
  const { result, rerender } = renderHook((props) => useAutomaticReportRoute(props), {
    initialProps: { enabled: true, origin, destination: null },
  });
  await act(async () => jest.advanceTimersByTime(1000));
  expect(API.get).not.toHaveBeenCalled();
  rerender({ enabled: true, origin, destination });
  await act(async () => jest.advanceTimersByTime(800));
  expect(API.get).toHaveBeenCalledWith("public-report-route/", expect.objectContaining({ params: {
    start_lat: 9.78, start_lng: 125.48, end_lat: 9.79, end_lng: 125.49, preference: "shortest",
  } }));
  expect(result.current.route).toEqual(route);
  rerender({ enabled: true, origin: { ...origin, latitude: 9.780001 }, destination });
  await act(async () => jest.advanceTimersByTime(30000));
  expect(API.get).toHaveBeenCalledTimes(1);
});

test("does not request a route without location permission or to the current position", async () => {
  const { rerender } = renderHook((props) => useAutomaticReportRoute(props), {
    initialProps: { enabled: false, origin, destination },
  });
  await act(async () => jest.advanceTimersByTime(30000));
  expect(API.get).not.toHaveBeenCalled();
  rerender({ enabled: true, origin, destination: origin });
  await act(async () => jest.advanceTimersByTime(30000));
  expect(API.get).not.toHaveBeenCalled();
});

test("ignores superseded routes when the selected pin changes", async () => {
  let resolve;
  API.get.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook((props) => useAutomaticReportRoute(props), {
    initialProps: { enabled: true, origin, destination },
  });
  await act(async () => jest.advanceTimersByTime(800));
  const signal = API.get.mock.calls[0][1].signal;
  rerender({ enabled: true, origin, destination: { latitude: 9.8, longitude: 125.5 } });
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ data: route }));
  expect(result.current.route).toBeNull();
  await act(async () => jest.advanceTimersByTime(200));
  expect(API.get.mock.calls[1][1].params.end_lat).toBe(9.8);
  expect(result.current.route).toEqual(route);
});

test("reselecting a cached pin draws immediately without another API request", async () => {
  const { result, rerender } = renderHook((props) => useAutomaticReportRoute(props), {
    initialProps: { enabled: true, origin, destination },
  });
  await act(async () => jest.advanceTimersByTime(199));
  expect(API.get).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(API.get).toHaveBeenCalledTimes(1);
  rerender({ enabled: true, origin, destination: { latitude: 9.8, longitude: 125.5 } });
  await act(async () => jest.advanceTimersByTime(200));
  expect(API.get).toHaveBeenCalledTimes(2);
  rerender({ enabled: true, origin, destination });
  expect(result.current.route).toEqual(route);
  expect(result.current.loading).toBe(false);
  expect(API.get).toHaveBeenCalledTimes(2);
});

test("rapid clicks request only the last selected pin", async () => {
  const { rerender } = renderHook((props) => useAutomaticReportRoute(props), {
    initialProps: { enabled: true, origin, destination },
  });
  await act(async () => jest.advanceTimersByTime(100));
  rerender({ enabled: true, origin, destination: { latitude: 9.8, longitude: 125.5 } });
  await act(async () => jest.advanceTimersByTime(200));
  expect(API.get).toHaveBeenCalledTimes(1);
  expect(API.get.mock.calls[0][1].params.end_lat).toBe(9.8);
});

test("service failure is visible and never invents a road route", async () => {
  API.get.mockRejectedValue({ response: { data: { detail: "Quota reached" } } });
  const { result } = renderHook(() => useAutomaticReportRoute({ enabled: true, origin, destination }));
  await act(async () => jest.advanceTimersByTime(800));
  expect(result.current.route).toBeNull();
  expect(result.current.error).toBe("Quota reached");
  expect(result.current.loading).toBe(false);
});
