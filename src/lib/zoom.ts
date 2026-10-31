/**
 * Keep the app at its natural size, like a native app.
 * iPhone Safari ignores `user-scalable=no` in the viewport tag, so pinch zoom is stopped here.
 * Double-tap zoom is stopped by `touch-action: manipulation` in CSS, and fields are 16px+ so
 * tapping into one doesn't zoom either.
 */
export function lockZoom() {
  if (typeof document === "undefined") return;
  const stop = (e: Event) => e.preventDefault();
  // Safari's pinch gesture events
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, stop, { passive: false });
  // two-finger moves (pinch) on other browsers
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
