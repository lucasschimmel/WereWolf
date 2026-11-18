import { create } from "zustand";
export const useControls = create<{
  sensitivity: number;
  setSensitivity: (value: number) => void;
}>((set) => ({
  sensitivity: 1,
  setSensitivity: (sensitivity) => set({ sensitivity }),
}));
