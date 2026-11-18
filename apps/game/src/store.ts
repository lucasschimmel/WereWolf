import { create } from "zustand";
export const useControls = create<{
  sensitivity: number;
  setSensitivity: (value: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
}>((set) => ({
  sensitivity: 1,
  setSensitivity: (sensitivity) => set({ sensitivity }),
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
