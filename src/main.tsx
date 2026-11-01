import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { lockZoom } from "./lib/zoom";
import { applyTheme, getTheme } from "./lib/theme";

lockZoom();
applyTheme(getTheme());
// the old List / Grid setting is gone (one day view now)
try { localStorage.removeItem("recalibrate.dayview"); } catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: offline support and notifications when the app is closed.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(() => {});
  });
}
