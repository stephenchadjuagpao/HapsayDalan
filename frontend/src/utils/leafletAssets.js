let assets;
export default function loadLeafletAssets() {
  if (window.L) return Promise.resolve(window.L);
  if (assets) return assets;
  assets = new Promise((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }
    const existing = document.querySelector('script[src*="leaflet.js"]');
    const script = existing || document.createElement("script");
    const timeout = setTimeout(() => reject(new Error("Map loading timed out. Please reopen the map.")), 15000);
    script.addEventListener("load", () => { clearTimeout(timeout); window.L ? resolve(window.L) : reject(new Error("Map unavailable.")); }, { once: true });
    script.addEventListener("error", () => { clearTimeout(timeout); script.remove(); reject(new Error("Unable to load the map. Check your connection.")); }, { once: true });
    if (!existing) {
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => { assets = null; throw error; });
  return assets;
}
