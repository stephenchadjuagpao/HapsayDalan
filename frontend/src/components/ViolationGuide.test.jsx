import { fireEvent, render, screen, within } from "@testing-library/react";
import ViolationGuide, { VIOLATION_GUIDE } from "./ViolationGuide";

const cards = () => within(screen.getByRole("group", { name: /Slide \d of/ })).getAllByRole("button");

test("shows three cards per slide and makes all 17 types reachable without duplicates", () => {
  render(<ViolationGuide value="" onSelect={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Previous violation types" })).toBeDisabled();
  const seen = [];
  for (let page = 0; page < 6; page += 1) {
    expect(cards()).toHaveLength(page === 5 ? 2 : 3);
    expect(screen.getByRole("button", { name: `Go to slide ${page + 1}` })).toHaveAttribute("aria-current", "true");
    seen.push(...cards().map((card) => card.getAttribute("aria-label")));
    if (page < 5) fireEvent.click(screen.getByRole("button", { name: "Next violation types" }));
  }
  expect(new Set(seen).size).toBe(VIOLATION_GUIDE.length);
  expect(screen.getByText("16–17 of 17 types")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next violation types" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous violation types" }));
  expect(screen.getByRole("group", { name: "Slide 5 of 6" })).toBeInTheDocument();
});

test("card selection is preserved when browsing and external selection reveals the correct slide", () => {
  const select = jest.fn();
  const { rerender } = render(<ViolationGuide value="Obstruction" onSelect={select} />);
  expect(screen.getByRole("group", { name: "Slide 2 of 6" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select Road obstruction" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Go to slide 1" }));
  expect(screen.getByRole("status")).toHaveTextContent("Selected: Road obstruction.");
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Select Illegal / wrong parking" }));
  expect(select).toHaveBeenCalledWith("No Parking / Wrong Parking");
  rerender(<ViolationGuide value={VIOLATION_GUIDE[15].value} onSelect={select} />);
  expect(screen.getByRole("group", { name: "Slide 6 of 6" })).toBeInTheDocument();
  expect(cards()[0]).toHaveAttribute("aria-pressed", "true");
});

test("keyboard navigation stays within the carousel and does not select a violation", () => {
  const select = jest.fn();
  render(<ViolationGuide value="" onSelect={select} />);
  const viewport = screen.getByRole("group", { name: "Violation examples" });
  fireEvent.keyDown(cards()[0], { key: "ArrowRight" });
  expect(viewport).toHaveFocus();
  expect(screen.getByRole("group", { name: "Slide 2 of 6" })).toBeInTheDocument();
  fireEvent.keyDown(viewport, { key: "End" });
  expect(cards()).toHaveLength(2);
  fireEvent.keyDown(viewport, { key: "Home" });
  fireEvent.keyDown(viewport, { key: "ArrowLeft" });
  expect(screen.getByRole("group", { name: "Slide 1 of 6" })).toBeInTheDocument();
  expect(select).not.toHaveBeenCalled();
});

test("horizontal swipes browse while vertical scrolling leaves the slide unchanged", () => {
  const select = jest.fn();
  render(<ViolationGuide value="" onSelect={select} />);
  const viewport = screen.getByRole("group", { name: "Violation examples" });
  fireEvent.touchStart(viewport, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(viewport, { changedTouches: [{ clientX: 100, clientY: 110 }] });
  expect(screen.getByRole("group", { name: "Slide 2 of 6" })).toBeInTheDocument();
  fireEvent.click(cards()[0]);
  expect(select).not.toHaveBeenCalled();
  fireEvent.touchStart(viewport, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchEnd(viewport, { changedTouches: [{ clientX: 110, clientY: 250 }] });
  expect(screen.getByRole("group", { name: "Slide 2 of 6" })).toBeInTheDocument();
  fireEvent.click(cards()[0]);
  expect(select).toHaveBeenCalledWith(VIOLATION_GUIDE[3].value);
});
