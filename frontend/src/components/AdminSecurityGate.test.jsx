import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AdminSecurityGate from "./AdminSecurityGate";

describe("AdminSecurityGate Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders all security gate elements and initial locked state", () => {
    render(<AdminSecurityGate onUnlock={jest.fn()} />);

    expect(screen.getByText("RESTRICTED ACCESS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CTMO Security Gate" })).toBeInTheDocument();
    expect(
      screen.getByText("Enter the 4-digit security PIN to unlock the CTMO Admin portal")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Security PIN digit 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Security PIN digit 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock CTMO Portal" })).toBeDisabled();
    expect(screen.getByText("Return to Homepage")).toHaveAttribute("href", "/");
  });

  test("rejects an incorrect PIN and displays error alert", () => {
    render(<AdminSecurityGate onUnlock={jest.fn()} />);

    const d1 = screen.getByLabelText("Security PIN digit 1");
    const d2 = screen.getByLabelText("Security PIN digit 2");
    const d3 = screen.getByLabelText("Security PIN digit 3");
    const d4 = screen.getByLabelText("Security PIN digit 4");

    fireEvent.change(d1, { target: { value: "9" } });
    fireEvent.change(d2, { target: { value: "9" } });
    fireEvent.change(d3, { target: { value: "9" } });
    fireEvent.change(d4, { target: { value: "9" } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Incorrect Security PIN. Authorized CTMO personnel only."
    );
  });

  test("accepts the correct PIN 1016 and calls onUnlock", () => {
    const onUnlockMock = jest.fn();
    render(<AdminSecurityGate onUnlock={onUnlockMock} />);

    const d1 = screen.getByLabelText("Security PIN digit 1");
    const d2 = screen.getByLabelText("Security PIN digit 2");
    const d3 = screen.getByLabelText("Security PIN digit 3");
    const d4 = screen.getByLabelText("Security PIN digit 4");

    fireEvent.change(d1, { target: { value: "1" } });
    fireEvent.change(d2, { target: { value: "0" } });
    fireEvent.change(d3, { target: { value: "1" } });
    fireEvent.change(d4, { target: { value: "6" } });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Access granted. Unlocking CTMO Login..."
    );

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(onUnlockMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("ctmo_security_gate_unlocked")).toBe("true");
  });

  test("supports on-screen keypad entry and clear functionality", () => {
    const onUnlockMock = jest.fn();
    render(<AdminSecurityGate onUnlock={onUnlockMock} />);

    const key1 = screen.getByRole("button", { name: "1" });
    const key0 = screen.getByRole("button", { name: "0" });
    const key6 = screen.getByRole("button", { name: "6" });
    const keyClear = screen.getByLabelText("Clear all digits");

    // Press 1, 0, then Clear
    fireEvent.click(key1);
    fireEvent.click(key0);
    expect(screen.getByLabelText("Security PIN digit 1")).toHaveValue("1");
    expect(screen.getByLabelText("Security PIN digit 2")).toHaveValue("0");

    fireEvent.click(keyClear);
    expect(screen.getByLabelText("Security PIN digit 1")).toHaveValue("");
    expect(screen.getByLabelText("Security PIN digit 2")).toHaveValue("");

    // Now enter full 1 0 1 6
    fireEvent.click(key1);
    fireEvent.click(key0);
    fireEvent.click(key1);
    fireEvent.click(key6);

    expect(screen.getByRole("status")).toHaveTextContent("Access granted");

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(onUnlockMock).toHaveBeenCalledTimes(1);
  });

  test("toggles PIN visibility", () => {
    render(<AdminSecurityGate onUnlock={jest.fn()} />);

    const d1 = screen.getByLabelText("Security PIN digit 1");
    expect(d1).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: "Show PIN digits" });
    fireEvent.click(toggleBtn);

    expect(d1).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide PIN digits" })).toBeInTheDocument();
  });
});

