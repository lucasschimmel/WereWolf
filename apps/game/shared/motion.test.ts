import { describe, expect, test } from "bun:test";
import {
  MotionBuffer,
  maxExtrapolation,
  normalizePose,
  plazaRadius,
} from "./motion";

const pose = (t: number, x: number, z = 0, yaw = 0) => ({ t, x, z, yaw });

describe("MotionBuffer", () => {
  test("renders a fixed delay behind and interpolates between snapshots", () => {
    const buffer = new MotionBuffer(100);
    // Sender clock runs 5 s ahead of the receiver; transit is 50 ms.
    buffer.push("a", pose(5000, 0), 50);
    buffer.push("a", pose(5100, 1), 150);
    buffer.push("a", pose(5200, 2), 250);
    // Local 300 → render time 200 → halfway between x=1 (150) and x=2 (250).
    expect(buffer.sample("a", 300)?.x).toBeCloseTo(1.5);
  });

  test("absorbs jitter by keeping the smallest transit as offset", () => {
    const buffer = new MotionBuffer(100);
    buffer.push("a", pose(0, 0), 80); // slow packet
    buffer.push("a", pose(100, 1), 120); // fast packet: offset drops to 20
    buffer.push("a", pose(200, 2), 260);
    const sample = buffer.sample("a", 270)?.x ?? Number.NaN;
    expect(sample).toBeGreaterThan(1);
    expect(sample).toBeLessThan(2);
  });

  test("extrapolates briefly, then holds", () => {
    const buffer = new MotionBuffer(0);
    buffer.push("a", pose(0, 0), 0);
    buffer.push("a", pose(100, 1), 100);
    expect(buffer.sample("a", 150)?.x).toBeCloseTo(1.5);
    const far = buffer.sample("a", 100 + maxExtrapolation * 10)?.x;
    expect(far).toBeCloseTo(1 + maxExtrapolation / 100);
  });

  test("does not extrapolate after a long silence", () => {
    const buffer = new MotionBuffer(0);
    buffer.push("a", pose(0, 0), 0);
    buffer.push("a", pose(1000, 1), 1000);
    expect(buffer.sample("a", 1100)?.x).toBe(1);
  });

  test("keeps late packets in order and drops duplicates", () => {
    const buffer = new MotionBuffer(0);
    buffer.push("a", pose(0, 0), 10);
    buffer.push("a", pose(200, 2), 210);
    buffer.push("a", pose(100, 1), 110);
    buffer.push("a", pose(100, 1), 110);
    expect(buffer.sample("a", 160)?.x).toBeCloseTo(1.5);
  });

  test("ignores a snapshot re-delivered later with the same sender stamp", () => {
    const buffer = new MotionBuffer(0);
    buffer.push("a", pose(0, 0), 10);
    buffer.push("a", pose(100, 1), 110);
    buffer.push("a", pose(0, 0), 500);
    expect(buffer.sample("a", 60)?.x).toBeCloseTo(0.5);
  });

  test("interpolates yaw along the shortest arc", () => {
    const buffer = new MotionBuffer(0);
    buffer.push("a", pose(0, 0, 0, 3), 0);
    buffer.push("a", pose(100, 0, 0, -3), 100);
    const yaw = buffer.sample("a", 50)?.yaw ?? 0;
    expect(Math.abs(Math.abs(yaw) - Math.PI)).toBeLessThan(0.01);
  });

  test("reset places a player immediately", () => {
    const buffer = new MotionBuffer(100);
    buffer.reset("a", pose(9999, 4), 0);
    expect(buffer.sample("a", 0)?.x).toBe(4);
    expect(buffer.latest("a")?.x).toBe(4);
  });
});

describe("normalizePose", () => {
  test("keeps an in-range pose unchanged", () => {
    expect(normalizePose(pose(1, 3, 4, 1))).toEqual(pose(1, 3, 4, 1));
  });

  test("wraps a yaw that drifted past ±π instead of dropping the pose", () => {
    const yaw = normalizePose(pose(1, 0, 0, Math.PI + 0.5))?.yaw ?? 0;
    expect(yaw).toBeCloseTo(-Math.PI + 0.5);
  });

  test("clamps a position past the edge back onto the square", () => {
    const clamped = normalizePose(pose(1, 30, 0));
    expect(clamped?.x).toBeCloseTo(plazaRadius);
  });

  test("rejects frames that are not poses", () => {
    expect(normalizePose(pose(Number.NaN, 0))).toBeNull();
    expect(normalizePose({ x: 0, z: 0, yaw: 0 })).toBeNull();
    expect(normalizePose("hello")).toBeNull();
  });
});
