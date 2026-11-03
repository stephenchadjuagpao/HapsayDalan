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

  test("renders vehicle image and appropriate status message when active", () => {
    render(
      <PageLoadingScreen
        active={true}
        targetPath="/report"
        duration={600}
      />
    );

    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();

    const carImg = screen.getByRole("img", { name: /HapsayDalan CTMO Patrol Vehicle/i });
    expect(carImg).toBeInTheDocument();

    expect(screen.getByText("Nag-andam sa Violation Report Form...")).toBeInTheDocument();
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
  });
});
