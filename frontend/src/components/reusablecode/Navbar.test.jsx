import { act, fireEvent, render, screen, within } from "@testing-library/react";
import Navbar from "./Navbar";

const originalMatchMedia = window.matchMedia;
afterEach(() => { document.body.style.overflow = ""; window.matchMedia = originalMatchMedia; });

test("the icon dock keeps real destinations, accessible labels, and the current page", () => {
  const { container, rerender } = render(<Navbar currentPage="report" />);
  const dock = within(container.querySelector('.sc-nav-links'));
  expect(dock.getAllByRole("link")).toHaveLength(8);
  expect(dock.getByRole("link", { name: "Report a Violation" })).toHaveAttribute("aria-current", "page");
  expect(dock.getByRole("link", { name: "Track My Report" })).toHaveAttribute("href", "/track");
  expect(dock.getByRole("link", { name: "Admin/CTMO" })).toHaveAttribute("href", "/admin-ctmo");
  dock.getAllByRole("link").forEach((link) => expect(link.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument());
  rerender(<Navbar currentPage="map" />);
  expect(dock.getByRole("link", { name: "Hotspot Map" })).toHaveAttribute("aria-current", "page");
  expect(dock.getByRole("link", { name: "Report a Violation" })).not.toHaveAttribute("aria-current");
});

test("mobile navigation exposes the current page and restores scrolling and focus on dismissal", () => {
  document.body.style.overflow = "clip";
  const { container } = render(<Navbar currentPage="track" />);
  const toggle = screen.getByRole("button", { name: "Open menu" });
  fireEvent.click(toggle);
  const menu = screen.getByRole("region", { name: "Explore HapsayDalan" });
  expect(within(menu).getAllByRole("link")).toHaveLength(8);
  expect(within(menu).getByRole("link", { name: "Track My Report" })).toHaveAttribute("aria-current", "page");
  expect(within(menu).getByRole("link", { name: "Report a Violation" })).toHaveAttribute("href", "/report");
  expect(within(menu).getByRole("link", { name: "Admin/CTMO" })).toHaveAttribute("href", "/admin-ctmo");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Explore HapsayDalan" })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("clip");
  expect(toggle).toHaveFocus();
  fireEvent.click(toggle);
  fireEvent.click(container.querySelector(".sc-menu-backdrop"));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(document.body.style.overflow).toBe("clip");
});

test("resizing to desktop closes the mobile panel and unmounting restores the previous scroll state", () => {
  const media = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn((query) => query === "(min-width:901px)" ? media :
    { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const { unmount } = render(<Navbar />);
  const toggle = screen.getByRole("button", { name: "Open menu" });
  fireEvent.click(toggle);
  act(() => media.addEventListener.mock.calls[0][1]({ matches: true }));
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(document.body.style.overflow).toBe("");
  fireEvent.click(toggle);
  unmount();
  expect(document.body.style.overflow).toBe("");
  expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
});
