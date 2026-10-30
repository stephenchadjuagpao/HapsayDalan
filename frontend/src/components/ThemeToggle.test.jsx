import { act, fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle";
import { initializeTheme, THEME_KEY } from "../hooks/useTheme";

const originalMedia = window.matchMedia;
let scheme;
beforeEach(() => {
  localStorage.clear();
  scheme = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => scheme);
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
  initializeTheme();
});
afterEach(() => { window.matchMedia = originalMedia; localStorage.clear(); delete document.documentElement.dataset.theme; });

test("sun/moon switch applies the theme, saves the choice, and synchronizes mounted switches", () => {
  render(<><ThemeToggle /><ThemeToggle showLabel /></>);
  const switches = screen.getAllByRole("switch", { name: "Dark mode" });
  expect(switches[0]).not.toBeChecked();
  fireEvent.click(switches[0]);
  expect(switches.every((input) => input.checked)).toBe(true);
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(screen.getByText("Dark mode")).toBeInTheDocument();
  fireEvent.click(switches[1]);
  expect(switches.every((input) => !input.checked)).toBe(true);
  expect(localStorage.getItem(THEME_KEY)).toBe("light");
});

test("restores a saved choice after initialization and prefers it over the system theme", () => {
  localStorage.setItem(THEME_KEY, "light");
  scheme.matches = true;
  initializeTheme();
  render(<ThemeToggle />);
  expect(screen.getByRole("switch")).not.toBeChecked();
  act(() => { localStorage.setItem(THEME_KEY, "dark"); initializeTheme(); });
  expect(screen.getByRole("switch")).toBeChecked();
});

test("defaults to light on dark devices and only switches after an explicit choice", () => {
  scheme.matches = true; initializeTheme();
  render(<ThemeToggle />);
  expect(screen.getByRole("switch")).not.toBeChecked();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  fireEvent.click(screen.getByRole("switch"));
  act(() => { scheme.matches = false; initializeTheme(); });
  expect(screen.getByRole("switch")).toBeChecked();
});

test("updates an open page when the saved theme changes in another tab", () => {
  render(<ThemeToggle />);
  act(() => {
    localStorage.setItem(THEME_KEY, "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: "dark" }));
  });
  expect(screen.getByRole("switch")).toBeChecked();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("defaults to light and allows switching when browser storage is unavailable", () => {
  const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
  const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
  const { unmount } = render(<ThemeToggle />);
  expect(screen.getByRole("switch")).not.toBeChecked();
  fireEvent.click(screen.getByRole("switch"));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("switch")).toBeChecked();
  unmount();
  get.mockRestore(); set.mockRestore();
});
