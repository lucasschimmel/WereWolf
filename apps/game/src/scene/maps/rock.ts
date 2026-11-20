import * as T from "three";
import type { Builder } from "../kit";
import { pick } from "./common";

export type RockPalette = { top: string[]; rim: string; strata: string[] };

const underside: [number, number][] = [
  [0.93, 0.07],
  [0.7, 0.3],
  [0.44, 0.58],
  [0.2, 0.84],
  [0, 1],
];

/**
 * A chunk of land torn from the ground: a flat faceted top and a ragged cone
 * of strata beneath it. Returns a coloured, non-indexed geometry.
 */
export function floatingRock(
  random: () => number,
  radiusAt: (angle: number) => number,
  depth: number,
  segments: number,
  palette: RockPalette,
  topRings = [0.4, 0.7, 0.92, 1],
) {
  const rings: { reach: number; y: number }[] = [
    { reach: 0, y: 0 },
    ...topRings.map((reach) => ({ reach, y: 0 })),
    ...underside.map(([reach, drop]) => ({ reach, y: -drop * depth })),
  ];
  const grid = rings.map(({ reach, y }, ring) =>
    Array.from({ length: segments }, (_, segment) => {
      const angle = (segment / segments) * Math.PI * 2;
      const below = ring > topRings.length;
      const wobble = below && reach > 0 ? 0.88 + random() * 0.24 : 1;
      const radius = radiusAt(angle) * reach * wobble;
      return new T.Vector3(
        Math.cos(angle) * radius,
        y + (below && reach > 0 ? (random() - 0.5) * depth * 0.08 : 0),
        Math.sin(angle) * radius,
      );
    }),
  );
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new T.Color();
  const face = (a: T.Vector3, b: T.Vector3, c: T.Vector3, hex: string) => {
    color.set(hex).multiplyScalar(0.92 + random() * 0.16);
    for (const corner of [a, b, c]) {
      positions.push(corner.x, corner.y, corner.z);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const hex = () =>
      ring < topRings.length - 1
        ? pick(random, palette.top)
        : ring === topRings.length - 1
          ? palette.rim
          : palette.strata[
              Math.min(ring - topRings.length, palette.strata.length - 1)
            ];
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = grid[ring][segment];
      const b = grid[ring + 1][segment];
      const c = grid[ring + 1][next];
      const d = grid[ring][next];
      face(a, c, b, hex());
      if (rings[ring].reach > 0) face(a, d, c, hex());
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A sagging plank bridge with rope rails between two anchors. */
export function ropeBridge(
  b: Builder,
  from: T.Vector3,
  to: T.Vector3,
  wood: [string, string],
) {
  const span = to.clone().sub(from);
  const length = span.length();
  const yaw = Math.atan2(span.x, span.z);
  const planks = Math.ceil(length / 0.62);
  const side = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const at = new T.Vector3();
  for (let index = 0; index <= planks; index++) {
    const t = index / planks;
    at.copy(from).addScaledVector(span, t);
    at.y -= Math.sin(t * Math.PI) * length * 0.07;
    b.box(wood[index % 2], [1.7, 0.08, 0.5], [at.x, at.y, at.z], [0, yaw, 0]);
    if (index % 3) continue;
    for (const sign of [-1, 1])
      b.box(
        wood[0],
        [0.09, 1.1, 0.09],
        [at.x + side.x * sign * 0.85, at.y + 0.5, at.z + side.z * sign * 0.85],
      );
  }
  for (const sign of [-1, 1])
    for (let index = 0; index < 6; index++) {
      const t = (index + 0.5) / 6;
      at.copy(from).addScaledVector(span, t);
      at.y += 1.0 - Math.sin(t * Math.PI) * length * 0.07;
      const slope = -Math.cos(t * Math.PI) * 0.22;
      b.box(
        "#c9b58c",
        [0.05, 0.05, length / 6 + 0.1],
        [at.x + side.x * sign * 0.85, at.y, at.z + side.z * sign * 0.85],
        [slope, yaw, 0],
      );
    }
}
