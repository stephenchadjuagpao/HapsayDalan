import { useSyncExternalStore } from "react";

export const THEME_KEY = "hapsay-theme";
let memoryPreference;
function preference() {
  try { const saved = localStorage.getItem(THEME_KEY); return saved === "dark" || saved === "light" ? saved : memoryPreference; }
  catch { return memoryPreference; }
}
function initialTheme() { return preference() || "light"; }
let theme = initialTheme();
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111c30" : "#f1f5fd");
}
export function initializeTheme() {
  memoryPreference = undefined;
  theme = initialTheme(); applyTheme();
  window.dispatchEvent(new Event("hapsay-theme-change"));
}
export function setTheme(value) {
  if (!["light", "dark"].includes(value)) return;
  memoryPreference = value;
  try { localStorage.setItem(THEME_KEY, value); } catch { /* Keep the choice for this visit when storage is unavailable. */ }
  theme = value; applyTheme();
  window.dispatchEvent(new Event("hapsay-theme-change"));
}
function subscribe(listener) {
  const storageChanged = (event) => {
    if (event.key === THEME_KEY || event.key === null) { memoryPreference = undefined; theme = initialTheme(); applyTheme(); listener(); }
  };
  window.addEventListener("hapsay-theme-change", listener);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener("hapsay-theme-change", listener);
    window.removeEventListener("storage", storageChanged);
  };
}
export default function useTheme() {
  return [useSyncExternalStore(subscribe, () => theme, () => "light"), setTheme];
}
