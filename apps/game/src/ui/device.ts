import { useEffect, useState } from "react";

const coarseQuery = "(pointer: coarse)";

/** Whether the main pointer is a finger, kept in sync with the device. */
export function useCoarse() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(coarseQuery);
    setCoarse(query.matches);
    const change = () => setCoarse(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return coarse;
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

/**
 * On touch devices, goes full screen and locks the screen in landscape.
 * Must run inside a user gesture. Browsers that refuse (iOS Safari, desktop)
 * keep the CSS "turn your phone" prompt as the fallback, so a refusal is
 * only logged.
 */
export async function enterLandscape() {
  if (!window.matchMedia(coarseQuery).matches) return;
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement && root.requestFullscreen)
      await root.requestFullscreen({ navigationUI: "hide" });
    const orientation = screen.orientation as LockableOrientation | undefined;
    await orientation?.lock?.("landscape");
  } catch (cause) {
    console.info(
      "Landscape lock unavailable, showing the rotate prompt",
      cause,
    );
  }
}

/** Whether `enterLandscape` can do anything on this browser. */
export const canLockLandscape = () =>
  typeof document !== "undefined" && document.fullscreenEnabled === true;

/**
 * True on an iPhone/iPad browser tab: Safari cannot go full screen there, so
 * the game suggests installing it on the home screen, where it opens without
 * tabs or address bar.
 */
export function suggestInstall() {
  if (typeof navigator === "undefined") return false;
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)")
      .matches;
  return ios && !installed && !canLockLandscape();
}
