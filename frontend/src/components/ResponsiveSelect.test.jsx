import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ResponsiveSelect from "./ResponsiveSelect";

function Select({ onEscape = () => {} }) {
  const [value, setValue] = useState("");
  return <form onKeyDown={(event) => { if (event.key === "Escape") onEscape(); }} data-testid="form">
    <label htmlFor="violation">Violation</label>
    <ResponsiveSelect id="violation" name="violation" required value={value} onChange={(event) => setValue(event.target.value)}>
      <option value="" disabled hidden>Select violation</option>
      <option value="parking">Illegal parking</option>
      <option value="assigned" disabled>Unavailable option</option>
      <option value="obstruction">Road obstruction</option>
    </ResponsiveSelect>
  </form>;
}

test("portaled options select the correct field value and preserve form data", () => {
  render(<Select />);
  const control = screen.getByRole("combobox", { name: "Violation" });
  expect(control).toHaveAttribute("aria-required", "true");
  fireEvent.click(control);
  expect(screen.queryByRole("option", { name: "Select violation" })).not.toBeInTheDocument();
  const option = screen.getByRole("option", { name: "Road obstruction" });
  expect(screen.getByRole("listbox").parentElement).toBe(document.body);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  expect(control).toHaveTextContent("Road obstruction");
  expect(new FormData(screen.getByTestId("form")).get("violation")).toBe("obstruction");
});

test("disabled choices cannot be selected and keyboard navigation skips them", () => {
  render(<Select />);
  fireEvent.click(screen.getByRole("combobox", { name: "Violation" }));
  fireEvent.click(screen.getByRole("option", { name: "Unavailable option" }));
  expect(screen.getByRole("combobox")).toHaveTextContent("Select violation");
  fireEvent.keyDown(screen.getByRole("option", { name: "Illegal parking" }), { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "Road obstruction" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Enter" });
  expect(screen.getByRole("combobox")).toHaveTextContent("Road obstruction");
});

test("Escape closes the dropdown before a containing dialog and typing finds a choice", () => {
  const onEscape = jest.fn();
  render(<Select onEscape={onEscape} />);
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.keyDown(document.activeElement, { key: "r" });
  expect(screen.getByRole("option", { name: "Road obstruction" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveFocus();
  expect(onEscape).not.toHaveBeenCalled();
});
