import React from "react";
import { render, screen, act } from "@testing-library/react";
import PageLoadingScreen from "./PageLoadingScreen";

describe("PageLoadingScreen component (FEZ Loading Page)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test("does not render when active is false", () => {
    render(<PageLoadingScreen active={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("renders centered HapsayDalan logo and FEZ loading text when active", () => {
    render(
      <PageLoadingScreen
        active={true}
        duration={600}
      />
    );

    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();

    const logoImg = screen.getByRole("img", { name: /HapsayDalan Logo/i });
    expect(logoImg).toBeInTheDocument();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("calls onComplete after duration finishes", () => {
    const handleComplete = jest.fn();

    render(
      <PageLoadingScreen
        active={true}
        duration={500}
        onComplete={handleComplete}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("cancels the completion callback when unmounted during the exit animation", () => {
    const onComplete = jest.fn();
    const { unmount } = render(<PageLoadingScreen active duration={500} onComplete={onComplete} />);
    act(() => { jest.advanceTimersByTime(500); });
    unmount();
    act(() => { jest.advanceTimersByTime(500); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("rerenders do not restart the loader timer", () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<PageLoadingScreen active duration={500} onComplete={first} />);
    act(() => { jest.advanceTimersByTime(400); });
    rerender(<PageLoadingScreen active duration={500} onComplete={latest} />);
    act(() => { jest.advanceTimersByTime(100); });
    act(() => { jest.advanceTimersByTime(200); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
