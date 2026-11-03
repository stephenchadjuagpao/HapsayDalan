import React from "react";
import { render, screen } from "@testing-library/react";

const { TextEncoder, TextDecoder } = require("util");
Object.assign(global, { TextEncoder, TextDecoder });

jest.mock("react-router-dom", () => jest.requireActual("react-router"), { virtual: true });
const { BrowserRouter, Link } = require("react-router");
const NavigationTransition = require("./NavigationTransition").default;

describe("NavigationTransition component", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
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
});
