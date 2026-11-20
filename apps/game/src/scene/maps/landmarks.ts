import * as T from "three";
import { Builder, rng } from "../kit";
import { instanced, mesh, type Sprout, sprout } from "./common";
import type { GlowSpot, MapContext } from "./types";

function bellGeometry(random: () => number, scale = 1) {
  const b = new Builder(random, 0.02);
  b.cylinder("#b58a3c", [0.32, 0.78, 1.0], [0, -0.55, 0], undefined, 12);
  b.cylinder("#9a7430", [0.82, 0.82, 0.12], [0, -1.05, 0], undefined, 12);
  b.ball("#6b5224", 0.16, [0, -1.12, 0]);
  b.box("#4a3a2c", [1.6, 0.18, 0.18], [0, 0.02, 0]);
  const geometry = b.build();
  geometry.scale(scale, scale, scale);
  return geometry;
}

export type TowerStyle = {
  stone: [string, string, string];
  roof: string;
  snow?: string;
};

/** The clock tower north of the square; its bell tolls on phase changes. */
export function bellTower(
  { budget, materials }: MapContext,
  position: T.Vector3,
  style: TowerStyle,
) {
  const random = rng(31);
  const b = new Builder(random, 0.04);
  const glow = new Builder(random, 0);
  const [light, mid, dark] = style.stone;
  b.box(dark, [4, 0.6, 4], [0, 0.3, 0]);
  b.box(light, [3.4, 7.2, 3.4], [0, 3.9, 0]);
  for (let band = 0; band < 3; band++)
    b.box(mid, [3.5, 0.18, 3.5], [0, 1.6 + band * 2.4, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.box(mid, [0.5, 7.4, 0.5], [sx * 1.6, 3.9, sz * 1.6]);
  b.box("#3a2a24", [1.2, 2.1, 0.12], [0, 1.65, 1.72]);
  b.cylinder(
    "#3a2a24",
    [0.6, 0.6, 0.12],
    [0, 2.7, 1.72],
    [Math.PI / 2, 0, 0],
    12,
  );
  b.cylinder(
    "#5c4434",
    [0.78, 0.78, 0.1],
    [0, 6.2, 1.73],
    [Math.PI / 2, 0, 0],
    16,
  );
  glow.cylinder(
    "#fff0c8",
    [0.66, 0.66, 0.1],
    [0, 6.2, 1.77],
    [Math.PI / 2, 0, 0],
    16,
  );
  b.box("#2a2224", [0.07, 0.5, 0.06], [0, 6.38, 1.84]);
  b.box("#2a2224", [0.36, 0.06, 0.06], [0.14, 6.2, 1.84]);
  b.box(mid, [3.8, 0.3, 3.8], [0, 7.6, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.box(mid, [0.45, 2.5, 0.45], [sx * 1.55, 8.95, sz * 1.55]);
  b.box(mid, [3.9, 0.35, 3.9], [0, 10.35, 0]);
  b.cone(style.roof, 3.1, 4.4, [0, 12.7, 0], [0, Math.PI / 4, 0], 4);
  if (style.snow)
    b.cone(style.snow, 2.2, 3.1, [0, 13.5, 0], [0, Math.PI / 4, 0], 4);
  b.ball("#c9a24a", 0.2, [0, 15, 0]);
  b.box("#2a2224", [0.06, 1, 0.06], [0, 15.5, 0]);
  b.box("#2a2224", [0.6, 0.06, 0.06], [0, 15.75, 0]);
  const group = new T.Group();
  group.position.copy(position);
  group.add(
    mesh(b.build(), materials.solid, budget.shadows),
    mesh(glow.build(), materials.glow, false),
  );
  const bell = new T.Group();
  bell.position.set(0, 9.9, 0);
  bell.add(new T.Mesh(bellGeometry(random), materials.solid));
  group.add(bell);
  const spot: GlowSpot = {
    position: new T.Vector3(0, 6.2, 1.9).add(position),
    size: 4,
    color: "#ffe2a8",
  };
  return { group, bell, spot };
}

/** A timber gantry carrying a bell and two lanterns. */
export function bellFrame(
  { budget, materials }: MapContext,
  position: T.Vector3,
  wood: [string, string],
  snow?: string,
) {
  const random = rng(37);
  const b = new Builder(random, 0.05);
  const glow = new Builder(random, 0);
  b.cylinder("#6f685f", [2.3, 2.5, 0.4], [0, 0.2, 0], undefined, 8);
  for (const x of [-1.5, 1.5]) {
    b.box(wood[0], [0.34, 5, 0.34], [x, 2.9, 0]);
    b.box(wood[1], [0.22, 1.7, 0.22], [x * 0.72, 4.5, 0], [0, 0, x * 0.45]);
    b.box("#2d2324", [0.3, 0.06, 0.3], [x * 1.25, 3.3, 0.3]);
    glow.box("#ffcf7a", [0.22, 0.28, 0.22], [x * 1.25, 3.12, 0.3]);
  }
  b.box(wood[0], [4.1, 0.36, 0.4], [0, 5.3, 0]);
  b.prism(wood[1], [4.6, 0.8, 1.8], [0, 5.5, 0]);
  if (snow) b.prism(snow, [4.4, 0.6, 1.5], [0, 5.86, 0]);
  const group = new T.Group();
  group.position.copy(position);
  group.add(
    mesh(b.build(), materials.solid, budget.shadows),
    mesh(glow.build(), materials.glow, false),
  );
  const bell = new T.Group();
  bell.position.set(0, 5.1, 0);
  bell.add(new T.Mesh(bellGeometry(random, 0.85), materials.solid));
  group.add(bell);
  const spots: GlowSpot[] = [-1.5, 1.5].map((x) => ({
    position: new T.Vector3(x * 1.25, 3.12, 0.3).add(position),
    size: 2.8,
    color: "#ffb760",
  }));
  return { group, bell, spots };
}

/**
 * A ring of sharpened logs drawn in a single instanced call, left open on the
 * southern lane where two lit gate posts stand.
 */
export function palisade(
  { budget, materials }: MapContext,
  random: () => number,
  radius: number,
  height: (x: number, z: number) => number,
  wood: [string, string],
  snow?: string,
) {
  const log = new Builder(random, 0.08)
    .cylinder(wood[0], [0.26, 0.3, 3.2], [0, 1.6, 0], undefined, 5)
    .cone(snow ?? wood[1], 0.27, 0.6, [0, 3.5, 0], undefined, 5)
    .build();
  const spacing = budget.houseLod > 0 ? 0.6 : 1.2;
  const count = Math.floor((Math.PI * 2 * radius) / spacing);
  const opening = 3.2 / radius;
  const stakes: Sprout[] = [];
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(turn) < opening) continue;
    const wobble = radius + (random() - 0.5) * 0.3;
    const x = Math.sin(angle) * wobble;
    const z = Math.cos(angle) * wobble;
    const girth = budget.houseLod > 0 ? 1 : 2;
    stakes.push(
      sprout(
        0,
        x,
        height(x, z) - 0.4,
        z,
        [girth, 0.82 + random() * 0.4, girth],
        random() * 6,
        new T.Color().setScalar(0.8 + random() * 0.35),
      ),
    );
  }
  const group = new T.Group();
  const fence = instanced(log, materials.solid, stakes);
  fence.castShadow = budget.shadows;
  group.add(fence);

  const b = new Builder(random, 0.05);
  const glow = new Builder(random, 0);
  const spots: GlowSpot[] = [];
  const z = Math.cos(opening) * radius;
  for (const side of [-1, 1]) {
    const x = side * Math.sin(opening) * radius;
    b.box(wood[0], [0.6, 5.2, 0.6], [x, 2.4, z]);
    b.cone(snow ?? wood[1], 0.52, 0.9, [x, 5.4, z], [0, Math.PI / 4, 0], 4);
    b.box("#2d2324", [0.34, 0.06, 0.34], [x - side * 0.6, 3.5, z - 0.1]);
    glow.box("#ffcf7a", [0.26, 0.32, 0.26], [x - side * 0.6, 3.3, z - 0.1]);
    spots.push({
      position: new T.Vector3(x - side * 0.6, 3.3, z - 0.1),
      size: 3.4,
      color: "#ffb760",
    });
  }
  b.box(wood[1], [7.4, 0.4, 0.5], [0, 4.5, z]);
  b.box(wood[0], [3.0, 0.9, 0.16], [0, 3.85, z]);
  if (snow) b.box(snow, [7.5, 0.16, 0.6], [0, 4.76, z]);
  group.add(
    mesh(b.build(), materials.solid, budget.shadows),
    mesh(glow.build(), materials.glow, false),
  );
  return { group, spots };
}
