import React from "react";
import { render, screen, act } from "@testing-library/react";
import PageLoadingScreen from "./PageLoadingScreen";

describe("PageLoadingScreen component", () => {
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

  test("renders patrol truck and HapsayDalan platform logo when active", () => {
    render(
      <PageLoadingScreen
        active={true}
        duration={600}
      />
    );

    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();

    const truckImg = screen.getByRole("img", { name: /Toyota Hilux CTMO Patrol Truck/i });
    expect(truckImg).toBeInTheDocument();

    const logoImg = screen.getByRole("img", { name: /HapsayDalan Platform Logo/i });
    expect(logoImg).toBeInTheDocument();
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
      jest.advanceTimersByTime(200);
    });

    expect(handleComplete).toHaveBeenCalledTimes(1);
  });
});
