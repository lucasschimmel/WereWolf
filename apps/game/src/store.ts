import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QualityPreference } from "./scene/quality";

type Controls = {
  sensitivity: number;
  setSensitivity: (value: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  quality: QualityPreference;
  setQuality: (value: QualityPreference) => void;
  stick: { x: number; y: number };
  setStick: (x: number, y: number) => void;
};

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useControls = create<Controls>()(
  persist(
    (set) => ({
      sensitivity: 1,
      setSensitivity: (sensitivity) => set({ sensitivity }),
      reducedMotion: prefersReduced(),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      quality: "auto",
      setQuality: (quality) => set({ quality }),
      stick: { x: 0, y: 0 },
      setStick: (x, y) => set({ stick: { x, y } }),
    }),
    {
      name: "werewolf.controls",
      partialize: ({ sensitivity, reducedMotion, quality }) => ({
        sensitivity,
        reducedMotion,
        quality,
      }),
    },
  ),
);
