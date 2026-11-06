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

test.each(["Obstruction", "CITY ORDINANCE NO. 133"])("the report route accepts %s from the responsive violation menu", async (violation) => {
  window.history.pushState({}, "", "/report");
  window.scrollTo = jest.fn();
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Violation Details" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Type of Violation *" }));
  fireEvent.click(screen.getByRole("option", { name: violation }));
  expect(screen.getByRole("combobox", { name: "Type of Violation *" })).toHaveTextContent(violation);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("date and time pickers open on the first click or keyboard action", async () => {
  window.history.pushState({}, "", "/report");
  window.scrollTo = jest.fn();
  render(<App />);
  await screen.findByRole("heading", { name: "Violation Details" });
  for (const label of ["Date *", "Time *"]) {
    const input = screen.getByLabelText(label);
    input.showPicker = jest.fn();
    fireEvent.click(input);
    expect(input.showPicker).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.showPicker).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.showPicker).toHaveBeenCalledTimes(2);
    input.showPicker = () => { throw new Error("Unsupported browser"); };
    expect(() => fireEvent.click(input)).not.toThrow();
    input.showPicker = undefined;
    expect(() => fireEvent.click(input)).not.toThrow();
  }
});
