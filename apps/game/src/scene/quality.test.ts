import { describe, expect, test } from "bun:test";
import { budgets, FrameGovernor, pixelRatio } from "./quality";

describe("scene quality budgets", () => {
  test("caps the drawing buffer even on a high-density 4K display", () => {
    const width = 3840;
    const height = 2160;
    const ratio = pixelRatio(budgets.high, width, height, 2);

    expect(width * height * ratio ** 2).toBeCloseTo(budgets.high.pixels);
  });

  test("uses at most native CSS resolution in the low profile on a phone", () => {
    expect(pixelRatio(budgets.low, 667, 375, 3)).toBe(1);
  });
});

describe("adaptive scene quality", () => {
  test("cuts optional effects and detail when frames stay slow", () => {
    const governor = new FrameGovernor(true, 60);

    for (let frame = 0; frame < 300; frame++) governor.tick(1 / 20);

    expect(governor.bloom).toBe(false);
    expect(governor.scale).toBeLessThan(1);
    expect(governor.detailReduction).toBeGreaterThan(0);
  });

  test("keeps full quality when the showcase meets its 30 FPS target", () => {
    const governor = new FrameGovernor(true, 30);

    for (let frame = 0; frame < 300; frame++) governor.tick(1 / 30);

    expect(governor.bloom).toBe(true);
    expect(governor.scale).toBe(1);
    expect(governor.detailReduction).toBe(0);
  });

  test("gives the renderer a fresh sample window after resuming", () => {
    const governor = new FrameGovernor(true, 60);
    for (let frame = 0; frame < 80; frame++) governor.tick(1 / 30);

    governor.resetSamples();
    for (let frame = 0; frame < 25; frame++) governor.tick(1 / 30);

    expect(governor.bloom).toBe(true);
  });
});
