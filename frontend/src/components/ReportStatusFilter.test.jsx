import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportStatusFilter from "./ReportStatusFilter";

const options = [{ value: "all", label: "All statuses" }, { value: "pending", label: "Pending Verification" }, { value: "rejected", label: "Rejected" }];
function Filter() {
  const [value, setValue] = useState("all");
  return <><span id="filter-label">Status</span><ReportStatusFilter id="filter" labelId="filter-label"
    value={value} onChange={setValue} options={options} /></>;
}

test("keyboard users can choose a status and focus returns to the filter", () => {
  render(<Filter />);
  const trigger = screen.getByRole("combobox", { name: "Status" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("option", { name: "All statuses" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "End" });
  expect(screen.getByRole("option", { name: "Rejected" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Enter" });
  expect(trigger).toHaveTextContent("Rejected");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("Escape and clicking outside close the menu without changing the status", () => {
  render(<Filter />);
  const trigger = screen.getByRole("combobox", { name: "Status" });
  fireEvent.click(trigger);
  fireEvent.keyDown(document.activeElement, { key: "ArrowDown" });
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(trigger).toHaveTextContent("All statuses");
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("opens upward when there is not enough space below the filter", () => {
  render(<Filter />);
  const trigger = screen.getByRole("combobox", { name: "Status" });
  trigger.getBoundingClientRect = () => ({ top: window.innerHeight - 60, bottom: window.innerHeight - 16, left: 20, width: 180 });
  fireEvent.click(trigger);
  expect(screen.getByRole("listbox")).toHaveClass("opens-above");
  expect(screen.getByRole("listbox")).toHaveStyle({ maxHeight: "280px" });
});
