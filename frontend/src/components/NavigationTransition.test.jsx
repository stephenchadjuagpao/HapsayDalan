import React from "react";
import { render, screen, act } from "@testing-library/react";

const { TextEncoder, TextDecoder } = require("util");
Object.assign(global, { TextEncoder, TextDecoder });

jest.mock("react-router-dom", () => jest.requireActual("react-router"), { virtual: true });
const { BrowserRouter, Link } = require("react-router");
const NavigationTransition = require("./NavigationTransition").default;

describe("NavigationTransition component", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.useRealTimers();
  });

  test("renders safely inside a router without errors", () => {
    render(
      <BrowserRouter>
        <NavigationTransition />
        <Link to="/report">Go to report</Link>
      </BrowserRouter>
    );

    expect(screen.getByRole("link", { name: "Go to report" })).toBeInTheDocument();
  });

  test("admin section events restart the loader and respect their duration", () => {
    process.env.NODE_ENV = "production";
    jest.useFakeTimers();
    render(<BrowserRouter><NavigationTransition /></BrowserRouter>);
    const trigger = () => window.dispatchEvent(new CustomEvent("hapsay:show-loader", { detail: { duration: 600 } }));
    act(trigger);
    expect(screen.getByRole("status", { name: "Loading page" })).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(500); });
    act(trigger);
    act(() => { jest.advanceTimersByTime(300); });
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(300); });
    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
