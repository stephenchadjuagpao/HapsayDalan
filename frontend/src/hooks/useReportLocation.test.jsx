import { act, renderHook } from "@testing-library/react";
import useReportLocation from "./useReportLocation";

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition: jest.fn(() => 1), clearWatch: jest.fn(), getCurrentPosition: jest.fn(),
  } });
});
afterEach(() => jest.useRealTimers());

test("refreshes stationary GPS readings and stops polling on unmount", () => {
  const { result, unmount } = renderHook(() => useReportLocation(true));
  const fix = () => ({ coords: { latitude: 9.79, longitude: 125.49, accuracy: 12 }, timestamp: Date.now() });
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  expect(result.current.isReady).toBe(true);
  navigator.geolocation.getCurrentPosition.mockImplementation((success) => success(fix()));
  act(() => jest.advanceTimersByTime(90000));
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(4);
  expect(result.current.isReady).toBe(true);
  unmount();
  act(() => jest.advanceTimersByTime(60000));
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(4);
  expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(1);
});

test("refresh never bypasses denied location permission", () => {
  const { result } = renderHook(() => useReportLocation(true));
  navigator.geolocation.getCurrentPosition.mockImplementation((success, failure) => failure({ code: 1 }));
  act(() => jest.advanceTimersByTime(30000));
  expect(result.current.isReady).toBe(false);
  expect(result.current.message).toMatch(/permission is required/);
});

test("approximate GPS stays usable and asks for manual pin confirmation", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0]({
    coords: { latitude: 9.79, longitude: 125.49, accuracy: 149 }, timestamp: Date.now(),
  }));
  act(() => navigator.geolocation.watchPosition.mock.calls[0][0]({
    coords: { latitude: 9.79, longitude: 125.49, accuracy: 149 }, timestamp: Date.now(),
  }));
  expect(result.current.isReady).toBe(true);
  expect(result.current.position.accuracy).toBe(149);
  expect(result.current.message).toMatch(/confirm the exact violation location/);
});
