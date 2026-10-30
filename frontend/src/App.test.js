import { fireEvent, render, screen } from "@testing-library/react";

// CRA's Jest resolver does not follow react-router-dom v7's export map.
// Its browser APIs are re-exported from react-router; exercise the real router.
jest.mock("react-router-dom", () => jest.requireActual("react-router"), { virtual: true });
jest.mock("./services/api", () => ({ get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn() }));
const { TextEncoder, TextDecoder } = require("util");
Object.assign(global, { TextEncoder, TextDecoder });
const App = require("./App").default;

test("the public homepage links to report submission", () => {
  window.history.pushState({}, "", "/");
  render(<App />);
  expect(screen.getByRole("heading", { name: /Report Road.*Traffic.*Violations/i })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Report a Violation" })[0]).toHaveAttribute("href", "/report");
});

test("the report route renders the responsive violation menu", async () => {
  window.history.pushState({}, "", "/report");
  window.scrollTo = jest.fn();
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Violation Details" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Type of Violation *" }));
  fireEvent.click(screen.getByRole("option", { name: "Obstruction" }));
  expect(screen.getByRole("combobox", { name: "Type of Violation *" })).toHaveTextContent("Obstruction");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
