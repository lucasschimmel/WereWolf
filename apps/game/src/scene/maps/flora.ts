import * as T from "three";
import { Builder } from "../kit";
import { blocked, type Species } from "./common";
import type { Circle } from "./types";

type Trio = [string, string, string];

/** Layered conifer; `snow` whitens the upper faces of every tier. */
export function pineSpecies(
  random: () => number,
  detailed: boolean,
  greens: Trio,
  snow?: string,
): Species {
  let high: T.BufferGeometry | undefined;
  if (detailed) {
    const b = new Builder(random, 0.04)
      .cylinder("#5a4232", [0.14, 0.2, 1.1], [0, 0.55, 0], undefined, 6)
      .cone(greens[0], 1.35, 1.7, [0, 1.75, 0], undefined, 7)
      .cone(greens[1], 1.05, 1.45, [0, 2.55, 0], [0, 0.4, 0], 7)
      .cone(greens[2], 0.7, 1.15, [0, 3.3, 0], [0, 0.9, 0], 7);
    if (snow)
      b.cone(snow, 1.02, 0.95, [0, 2.2, 0], undefined, 7)
        .cone(snow, 0.8, 0.85, [0, 2.92, 0], [0, 0.4, 0], 7)
        .cone(snow, 0.55, 0.8, [0, 3.52, 0], [0, 0.9, 0], 7);
    high = b.build();
  }
  const low = new Builder(random, 0)
    .cylinder("#5a4232", [0.16, 0.2, 1], [0, 0.5, 0], undefined, 4)
    .cone(greens[1], 1.3, 3.4, [0, 2.3, 0], undefined, 5);
  if (snow) low.cone(snow, 0.82, 2.1, [0, 3.0, 0], undefined, 5);
  return { high, low: low.build(), sway: true };
}

/** Broadleaf made of a few faceted clumps. */
export function roundSpecies(
  random: () => number,
  detailed: boolean,
  leaves: [string, string, string, string],
  trunk = "#5d4535",
): Species {
  const high = detailed
    ? new Builder(random, 0.04)
        .cylinder(trunk, [0.16, 0.24, 1.7], [0, 0.85, 0], undefined, 6)
        .ball(leaves[0], [1.2, 1.05, 1.2], [0, 2.4, 0])
        .ball(leaves[1], 0.85, [0.6, 2.9, 0.3])
        .ball(leaves[2], 0.8, [-0.55, 2.75, -0.35])
        .ball(leaves[3], 0.7, [0.1, 3.3, -0.2])
        .build()
    : undefined;
  const low = new Builder(random, 0)
    .cylinder(trunk, [0.18, 0.24, 1.6], [0, 0.8, 0], undefined, 4)
    .ball(leaves[0], [1.4, 1.3, 1.4], [0, 2.65, 0])
    .build();
  return { high, low, sway: true };
}

/** An ancient trunk with roots and a wide crown, about 14 m tall unscaled. */
export function giantSpecies(
  random: () => number,
  detailed: boolean,
  leaves: Trio,
  bark = "#4a3a30",
): Species {
  let high: T.BufferGeometry | undefined;
  if (detailed) {
    const b = new Builder(random, 0.05).cylinder(
      bark,
      [0.75, 1.25, 9],
      [0, 4.5, 0],
      undefined,
      7,
    );
    for (let index = 0; index < 5; index++) {
      const angle = (index / 5) * Math.PI * 2 + 0.3;
      b.cylinder(
        bark,
        [0.22, 0.5, 2.6],
        [Math.sin(angle) * 1.5, 0.55, Math.cos(angle) * 1.5],
        [Math.cos(angle) * 1.05, 0, -Math.sin(angle) * 1.05],
        5,
      );
      b.cylinder(
        bark,
        [0.2, 0.36, 4.2],
        [Math.sin(angle + 0.6) * 1.9, 9.4, Math.cos(angle + 0.6) * 1.9],
        [Math.cos(angle + 0.6) * 0.85, 0, -Math.sin(angle + 0.6) * 0.85],
        5,
      );
      b.ball(
        leaves[index % 3],
        [3.1, 2.1, 3.1],
        [Math.sin(angle + 0.6) * 3.6, 11.2, Math.cos(angle + 0.6) * 3.6],
        [0, angle, 0],
      );
    }
    b.ball(leaves[1], [3.6, 2.6, 3.6], [0, 12.6, 0]);
    high = b.build();
  }
  const low = new Builder(random, 0)
    .cylinder(bark, [0.8, 1.3, 9], [0, 4.5, 0], undefined, 5)
    .ball(leaves[0], [5.6, 3.2, 5.6], [0, 11.6, 0])
    .build();
  return { high, low, sway: false };
}

export function bushGeometry(random: () => number, colors: Trio) {
  return new Builder(random, 0.05)
    .ball(colors[0], [0.7, 0.55, 0.7], [0, 0.35, 0])
    .ball(colors[1], 0.5, [0.45, 0.45, 0.2])
    .ball(colors[2], 0.45, [-0.4, 0.4, -0.15])
    .build();
}

export function tuftGeometry(
  random: () => number,
  colors: [string, string],
  tall = 0.55,
) {
  const tuft = new Builder(random, 0.1);
  for (let blade = 0; blade < 5; blade++) {
    const angle = (blade / 5) * Math.PI * 2;
    tuft.cone(
      colors[blade % 2],
      0.06,
      tall + (blade % 3) * 0.12,
      [Math.cos(angle) * 0.08, tall / 2, Math.sin(angle) * 0.08],
      [Math.sin(angle) * 0.25, 0, Math.cos(angle) * 0.25],
      3,
    );
  }
  return tuft.build();
}

/** White faceted shapes meant to be coloured per instance. */
export function plainGeometry(shape: "rock" | "petal" | "drift") {
  const geometry =
    shape === "rock"
      ? new T.DodecahedronGeometry(1, 0)
      : new T.IcosahedronGeometry(shape === "petal" ? 0.1 : 1, 0);
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute("uv");
  flat.setAttribute(
    "color",
    new T.BufferAttribute(
      new Float32Array(flat.attributes.position.count * 3).fill(1),
      3,
    ),
  );
  flat.computeVertexNormals();
  return flat;
}

export type Spot = { x: number; z: number; radius: number; angle: number };

/** Rejection-samples points in an annulus, denser near `inner` as power grows. */
export function ringPoints(
  random: () => number,
  count: number,
  inner: number,
  outer: number,
  avoid: Circle[],
  power = 1,
  reject?: (x: number, z: number) => boolean,
) {
  const spots: Spot[] = [];
  for (
    let attempt = 0;
    attempt < count * 6 && spots.length < count;
    attempt++
  ) {
    const radius = inner + random() ** power * (outer - inner);
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocked(x, z, avoid) || reject?.(x, z)) continue;
    spots.push({ x, z, radius, angle });
  }
  return spots;
}

export const grey = (random: () => number, base: number, spread: number) =>
  new T.Color().setScalar(base + random() * spread);
