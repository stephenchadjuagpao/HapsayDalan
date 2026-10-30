import { act, renderHook } from "@testing-library/react";
import useReportLocation from "./useReportLocation";

let success;
let failure;
const clearWatch = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition: jest.fn((onSuccess, onError) => { success = onSuccess; failure = onError; return 7; }),
    getCurrentPosition: jest.fn(),
    clearWatch,
  } });
});

afterEach(() => jest.useRealTimers());

const fix = (accuracy = 12, latitude = 9.7843) => ({
  coords: { latitude, longitude: 125.4888, accuracy }, timestamp: Date.now(),
});

test("location is required and tracks subsequent device positions with high accuracy", () => {
  const { result, unmount } = renderHook(() => useReportLocation(true));
  expect(result.current.isReady).toBe(false);
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  expect(navigator.geolocation.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
    enableHighAccuracy: true, maximumAge: 0, timeout: 20000,
  });
  act(() => success(fix()));
  expect(result.current.isReady).toBe(true);
  act(() => success(fix(8, 9.785)));
  expect(result.current.position.latitude).toBe(9.785);
  unmount();
  expect(clearWatch).toHaveBeenCalledWith(7);
});

test("denied permission clears a previous position and blocks submission", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  act(() => failure({ code: 1 }));
  expect(result.current.position).toBeNull();
  expect(result.current.isReady).toBe(false);
  expect(result.current.message).toMatch(/permission is required/);
});

test("approximate locations can pin the map while outdated locations remain blocked", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix(500)));
  act(() => success(fix(500)));
  expect(result.current.isReady).toBe(true);
  expect(result.current.message).toMatch(/confirm the exact violation location/);
  act(() => success(fix(10)));
  expect(result.current.isReady).toBe(true);
  act(() => jest.advanceTimersByTime(65000));
  expect(result.current.isReady).toBe(false);
  expect(result.current.message).toMatch(/outdated/);
});

test("immediately requests a quick location and displays it before accurate GPS arrives", () => {
  const { result } = renderHook(() => useReportLocation(true));
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
    enableHighAccuracy: false, maximumAge: 15000, timeout: 8000,
  });
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix(149)));
  expect(result.current.isReady).toBe(true);
  expect(result.current.position.accuracy).toBe(149);
  act(() => success(fix(10)));
  expect(result.current.position.accuracy).toBe(10);
  act(() => failure({ code: 3 }));
  expect(result.current.isReady).toBe(true);
  expect(result.current.position.accuracy).toBe(10);
});

test("a slower quick callback cannot replace an accurate GPS result", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix(800, 10)));
  act(() => success(fix(8)));
  expect(result.current.position.accuracy).toBe(8);
  expect(result.current.position.latitude).toBe(9.7843);
});

test("old cached locations never become a report pin", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0]({ ...fix(), timestamp: Date.now() - 120000 }));
  expect(result.current.position).toBeNull();
  expect(result.current.isReady).toBe(false);
  act(() => success(fix()));
  expect(result.current.isReady).toBe(true);
});

test("late callbacks cannot restore a location after permission is denied", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][1]({ code: 1 }));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  expect(result.current.position).toBeNull();
  expect(result.current.isReady).toBe(false);
});

test("insecure phone connections give an HTTPS explanation instead of a false location", () => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
  const { result } = renderHook(() => useReportLocation(true));
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  expect(result.current.isReady).toBe(false);
  expect(result.current.message).toMatch(/HTTPS/);
});

test("leaving the location step stops tracking and ignores late callbacks", () => {
  const { result, rerender } = renderHook(({ enabled }) => useReportLocation(enabled), { initialProps: { enabled: true } });
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  rerender({ enabled: false });
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(result.current.isReady).toBe(false);
  act(() => success(fix(5, 10)));
  expect(result.current.position.latitude).toBe(9.7843);
});

test("retry starts a new watch and clears old state", () => {
  const { result } = renderHook(() => useReportLocation(true));
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][1]({ code: 3 }));
  expect(result.current.message).toMatch(/timed out/);
  act(() => result.current.retry());
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(result.current.position).toBeNull();
});

test("granting permission after a denial automatically requests and accepts a new fix", async () => {
  const originalPermissions = navigator.permissions;
  const permission = { state: "prompt", onchange: null };
  Object.defineProperty(navigator, "permissions", { configurable: true, value: {
    query: jest.fn().mockResolvedValue(permission),
  } });
  try {
    const { result } = renderHook(() => useReportLocation(true));
    await act(async () => {});
    act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][1]({ code: 1 }));
    expect(result.current.isReady).toBe(false);
    permission.state = "granted";
    act(() => permission.onchange());
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    act(() => navigator.geolocation.getCurrentPosition.mock.calls[1][0](fix()));
    expect(result.current.isReady).toBe(true);
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: originalPermissions });
  }
});

test("returning to a visible Safari tab retries location after site settings change", () => {
  const originalPermissions = navigator.permissions;
  Object.defineProperty(navigator, "permissions", { configurable: true, value: undefined });
  try {
    const { result } = renderHook(() => useReportLocation(true));
    act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][1]({ code: 1 }));
    expect(result.current.isReady).toBe(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    act(() => navigator.geolocation.getCurrentPosition.mock.calls[1][0](fix()));
    expect(result.current.isReady).toBe(true);
  } finally {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: originalPermissions });
  }
});

test("the location-step tap starts one request before the step effect and pins its result", () => {
  const { result, rerender } = renderHook(({ enabled }) => useReportLocation(enabled), {
    initialProps: { enabled: false },
  });
  act(() => result.current.startOnEntry());
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  rerender({ enabled: true });
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  act(() => navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix()));
  expect(result.current.isReady).toBe(true);
  expect(result.current.position.latitude).toBe(9.7843);
  expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
});

test("a location received during the step tap is kept until the map opens", () => {
  const { result, rerender } = renderHook(({ enabled }) => useReportLocation(enabled), {
    initialProps: { enabled: false },
  });
  act(() => {
    result.current.startOnEntry();
    navigator.geolocation.getCurrentPosition.mock.calls[0][0](fix());
  });
  rerender({ enabled: true });
  expect(result.current.isReady).toBe(true);
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
});
