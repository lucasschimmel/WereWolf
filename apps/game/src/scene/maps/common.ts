import * as T from "three";
import { Builder, type Materials, SceneryLod } from "../kit";
import type { Budget } from "../quality";
import type { Circle, Filler, GlowSpot, Home, MapContext } from "./types";

/** Radius of the walkable square; the ground stays flat well beyond it. */
export const plazaEdge = 10.6;
export const flatRadius = 24;

export function mesh(
  geometry: T.BufferGeometry,
  material: T.Material,
  shadows: boolean,
) {
  const result = new T.Mesh(geometry, material);
  result.castShadow = shadows;
  result.receiveShadow = shadows;
  result.matrixAutoUpdate = false;
  result.updateMatrix();
  return result;
}

export const pick = <Item>(random: () => number, items: readonly Item[]) =>
  items[Math.floor(random() * items.length)];

export function shuffle<Item>(random: () => number, items: Item[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export const blocked = (x: number, z: number, avoid: Circle[]) =>
  avoid.some((circle) => Math.hypot(x - circle.x, z - circle.z) < circle.r);

export type PlazaPalette = { base: string; curb: string; cobbles: string[] };

/** The walkable disc: phyllotaxis cobbles inside a kerb, one draw call. */
export function buildPlaza(
  { budget, materials }: MapContext,
  random: () => number,
  palette: PlazaPalette,
) {
  const b = new Builder(random, 0.1);
  b.cylinder(palette.base, [10.8, 11, 0.14], [0, 0, 0], undefined, 48);
  const count = budget.stones;
  const spacing = 10.2 * Math.sqrt(Math.PI / count);
  for (let index = 0; index < count; index++) {
    const radius = 10.15 * Math.sqrt((index + 0.5) / count);
    if (radius < 1.3) continue;
    const angle = index * 2.39996;
    b.box(
      pick(random, palette.cobbles),
      [
        spacing * (0.78 + random() * 0.15),
        0.07,
        spacing * (0.7 + random() * 0.15),
      ],
      [Math.cos(angle) * radius, 0.09, Math.sin(angle) * radius],
      [0, random() * Math.PI, 0],
    );
  }
  const curbs = 52;
  for (let index = 0; index < curbs; index++) {
    const angle = (index / curbs) * Math.PI * 2;
    b.box(
      palette.curb,
      [1.25, 0.16, 0.42],
      [Math.sin(angle) * plazaEdge, 0.1, Math.cos(angle) * plazaEdge],
      [0, angle, 0],
    );
  }
  const result = mesh(b.build(), materials.solid, false);
  result.receiveShadow = budget.shadows;
  return result;
}

export type Paint = (x: number, z: number, y: number, out: T.Color) => void;

/** Flat-shaded, vertex-coloured ground sculpted by a height function. */
export function buildGround(
  budget: Budget,
  materials: Materials,
  size: number,
  height: (x: number, z: number) => number,
  paint: Paint,
) {
  const plane = new T.PlaneGeometry(size, size, budget.terrain, budget.terrain);
  plane.rotateX(-Math.PI / 2);
  const geometry = plane.toNonIndexed();
  plane.dispose();
  const position = geometry.attributes.position as T.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const z = position.getZ(index);
    position.setY(index, Math.hypot(x, z) < 11 ? -0.06 : height(x, z) - 0.02);
  }
  const colors = new Float32Array(position.count * 3);
  const color = new T.Color();
  for (let index = 0; index < position.count; index += 3) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let corner = 0; corner < 3; corner++) {
      x += position.getX(index + corner) / 3;
      y += position.getY(index + corner) / 3;
      z += position.getZ(index + corner) / 3;
    }
    paint(x, z, y, color);
    for (let corner = 0; corner < 3; corner++)
      color.toArray(colors, (index + corner) * 3);
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const ground = new T.Mesh(geometry, materials.solid);
  ground.receiveShadow = budget.shadows;
  ground.matrixAutoUpdate = false;
  return ground;
}

export type Sprout = { matrix: T.Matrix4; tint: T.Color; kind: number };
/** `high` is omitted on profiles without level of detail. */
export type Species = {
  high?: T.BufferGeometry;
  low: T.BufferGeometry;
  sway: boolean;
};

const up = new T.Vector3(0, 1, 0);

export function sprout(
  kind: number,
  x: number,
  y: number,
  z: number,
  scale: number | [number, number, number],
  yaw: number,
  tint: T.Color,
): Sprout {
  const size = typeof scale === "number" ? [scale, scale, scale] : scale;
  return {
    kind,
    tint,
    matrix: new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromAxisAngle(up, yaw),
      new T.Vector3(...size),
    ),
  };
}

export function instanced(
  geometry: T.BufferGeometry,
  material: T.Material,
  items: Sprout[],
  origin = new T.Vector3(),
) {
  const result = new T.InstancedMesh(
    geometry,
    material,
    Math.max(items.length, 1),
  );
  result.count = items.length;
  const local = new T.Matrix4();
  const offset = new T.Matrix4().makeTranslation(
    -origin.x,
    -origin.y,
    -origin.z,
  );
  for (const [index, item] of items.entries()) {
    result.setMatrixAt(index, local.multiplyMatrices(offset, item.matrix));
    result.setColorAt(index, item.tint);
  }
  result.instanceMatrix.needsUpdate = true;
  if (result.instanceColor) result.instanceColor.needsUpdate = true;
  result.computeBoundingSphere();
  result.matrixAutoUpdate = false;
  return result;
}

/** Splits ground cover into angular batches that are culled separately. */
export function sectored(
  geometry: T.BufferGeometry,
  material: T.Material,
  sprouts: Sprout[],
  sectors = 8,
) {
  const batches = Array.from({ length: sectors }, () => [] as Sprout[]);
  const where = new T.Vector3();
  for (const item of sprouts) {
    where.setFromMatrixPosition(item.matrix);
    const turn = (Math.atan2(where.z, where.x) + Math.PI) / (Math.PI * 2);
    batches[Math.floor(turn * sectors) % sectors].push(item);
  }
  return batches
    .filter((items) => items.length)
    .map((items) => instanced(geometry, material, items));
}

/**
 * Groups sprouts into angular chunks so each one is culled and swaps its level
 * of detail on its own. Chunks beyond `split` use a shorter detail distance.
 */
export function plant(
  { budget, materials }: MapContext,
  species: Species[],
  sprouts: Sprout[],
  split: number,
  sectors = 8,
) {
  const chunks = Array.from({ length: sectors * 2 }, () => [] as Sprout[]);
  const where = new T.Vector3();
  for (const item of sprouts) {
    where.setFromMatrixPosition(item.matrix);
    const turn = (Math.atan2(where.z, where.x) + Math.PI) / (Math.PI * 2);
    const sector = Math.floor(turn * sectors) % sectors;
    chunks[sector + (Math.hypot(where.x, where.z) > split ? sectors : 0)].push(
      item,
    );
  }
  const used = new Set<T.BufferGeometry>();
  const result: T.Object3D[] = [];
  for (const [index, items] of chunks.entries()) {
    if (!items.length) continue;
    const origin = new T.Vector3();
    for (const item of items)
      origin.add(where.setFromMatrixPosition(item.matrix));
    origin.divideScalar(items.length);
    const near = new T.Group();
    const far = new T.Group();
    for (const [kind, { high, low, sway }] of species.entries()) {
      const subset = items.filter((item) => item.kind === kind);
      if (!subset.length) continue;
      if (high && budget.treeLod > 0) {
        const detailed = instanced(
          high,
          sway ? materials.wind : materials.solid,
          subset,
          origin,
        );
        detailed.castShadow = budget.shadows && index < sectors;
        near.add(detailed);
        used.add(high);
      }
      const simple = instanced(low, materials.solid, subset, origin);
      far.add(simple);
      used.add(low);
    }
    const chunk = near.children.length
      ? new SceneryLod(near, far, budget.treeLod * (index < sectors ? 1 : 0.75))
      : far;
    chunk.position.copy(origin);
    result.push(chunk);
  }
  for (const { high, low } of species)
    for (const geometry of [high, low])
      if (geometry && !used.has(geometry)) geometry.dispose();
  return result;
}

export type HomeParts = {
  high: Builder;
  highGlow: Builder;
  low: Builder;
  lowGlow: Builder;
};
export type HomeAnchors = {
  chimney?: T.Vector3;
  lamps: { position: T.Vector3; size: number }[];
};

/** Wraps a dwelling recipe into a near/far pair sharing two materials. */
export function makeHome(
  { budget, materials }: MapContext,
  random: () => number,
  recipe: (parts: HomeParts) => HomeAnchors,
  lampColor = "#ffb35c",
): Home {
  const detailed = budget.houseLod > 0;
  const parts: HomeParts = {
    high: new Builder(random, 0.06, detailed),
    highGlow: new Builder(random, 0.05, detailed),
    low: new Builder(random),
    lowGlow: new Builder(random, 0),
  };
  const anchors = recipe(parts);
  const far = new T.Group();
  far.add(
    mesh(parts.low.build(), materials.solid, false),
    mesh(parts.lowGlow.build(), materials.glow, false),
  );
  let object: T.Object3D = far;
  if (detailed) {
    const near = new T.Group();
    near.add(
      mesh(parts.high.build(), materials.solid, budget.shadows),
      mesh(parts.highGlow.build(), materials.glow, false),
    );
    object = new SceneryLod(near, far, budget.houseLod);
  }
  object.matrixAutoUpdate = false;
  return {
    object,
    chimney: anchors.chimney,
    lamps: anchors.lamps.map((lamp) => ({ ...lamp, color: lampColor })),
  };
}

/** A dirt lane from a home's door to the kerb, in the home's local frame. */
export function doorPath(parts: HomeParts, color: string, depth: number) {
  const length = 7.2 - depth / 2;
  for (const builder of [parts.high, parts.low])
    builder.box(color, [1.5, 0.05, length], [0, 0.04, depth / 2 + length / 2]);
}

/** Gentle hills that only start rising past the village's flat apron. */
export function rolling(x: number, z: number, start = flatRadius, lift = 1) {
  const distance = Math.hypot(x, z);
  const rise = T.MathUtils.smoothstep(distance, start, start + 46);
  const hills =
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.052 - 0.4) * 2.6 +
    Math.sin(x * 0.11 - z * 0.08) * 0.9 +
    Math.cos(z * 0.13 + x * 0.03) * 0.6;
  return rise * (hills + 1.2 + (distance - start) * 0.05) * lift;
}

export type FillerRecipe = {
  width: number;
  build: (
    b: Builder,
    glow: Builder,
  ) => { position: T.Vector3; size: number; color?: string }[] | undefined;
};

/** One prop per possible gap, cycling through a handful of shared meshes. */
export function makeFillers(
  { budget, materials }: MapContext,
  random: () => number,
  recipes: FillerRecipe[],
  slots: number,
): Filler[] {
  const built = recipes.map((recipe) => {
    const b = new Builder(random, 0.05);
    const glow = new Builder(random, 0);
    const lamps = recipe.build(b, glow) ?? [];
    return {
      width: recipe.width,
      solid: b.build(),
      glow: glow.size ? glow.build() : undefined,
      lamps: lamps.map((lamp) => ({ color: "#ffb760", ...lamp })),
    };
  });
  return Array.from({ length: slots }, (_, slot) => {
    const source = built[slot % built.length];
    const object = new T.Group();
    object.matrixAutoUpdate = false;
    object.add(mesh(source.solid, materials.solid, budget.shadows));
    if (source.glow) object.add(mesh(source.glow, materials.glow, false));
    return { object, width: source.width, lamps: source.lamps };
  });
}

export type Peaks = { rock: string[]; snow: string; snowLine: number };

/** A distant ring of low-poly summits closing the horizon. */
export function buildMountains(
  random: () => number,
  materials: Materials,
  palette: Peaks,
  distance = 175,
  count = 28,
) {
  const peaks = new Builder(random, 0.05);
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + random() * 0.15;
    const reach = distance + random() * 50;
    const height = 35 + random() * 50;
    const radius = 28 + random() * 22;
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    peaks.cone(
      palette.rock[index % palette.rock.length],
      radius,
      height,
      [x, height / 2 - 4, z],
      [0, random() * 3, 0],
      5,
    );
    if (height > palette.snowLine)
      peaks.cone(
        palette.snow,
        radius * 0.32,
        height * 0.32,
        [x, height * 0.84 - 4, z],
        [0, random() * 3, 0],
        5,
      );
  }
  const range = new T.Mesh(peaks.build(), materials.solid);
  range.matrixAutoUpdate = false;
  return range;
}

/** Tall lanterns standing just outside the kerb. */
export function lampRing(
  b: Builder,
  glow: Builder,
  spots: GlowSpot[],
  count: number,
  radius: number,
  color = "#ffb760",
) {
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + Math.PI / count;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    b.box("#3b2f2c", [0.16, 2.8, 0.16], [x, 1.4, z]);
    b.box("#3b2f2c", [0.5, 0.07, 0.07], [x, 2.75, z], [0, angle, 0]);
    b.box("#2d2324", [0.36, 0.06, 0.36], [x, 2.98, z]);
    glow.box("#ffcf7a", [0.26, 0.32, 0.26], [x, 2.78, z]);
    spots.push({ position: new T.Vector3(x, 2.78, z), size: 3.4, color });
  }
}

/** A low fire ring: nothing here rises above a seated player's knees. */
export function firePit(
  b: Builder,
  glow: Builder,
  stone: string[],
  radius = 1.05,
) {
  const blocks = 11;
  for (let index = 0; index < blocks; index++) {
    const angle = (index / blocks) * Math.PI * 2;
    b.box(
      stone[index % stone.length],
      [0.5, 0.34, 0.36],
      [Math.sin(angle) * radius, 0.24, Math.cos(angle) * radius],
      [0, angle, 0],
    );
  }
  b.cylinder("#2a2422", [radius, radius, 0.1], [0, 0.14, 0], undefined, 11);
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2 + 0.4;
    b.cylinder(
      index % 2 ? "#5a3f2c" : "#4a3426",
      [0.09, 0.11, 1.15],
      [Math.sin(angle) * 0.24, 0.42, Math.cos(angle) * 0.24],
      [Math.cos(angle) * 0.95, 0, -Math.sin(angle) * 0.95],
      5,
    );
  }
  glow.cone("#ff8a2e", 0.4, 0.75, [0, 0.62, 0], undefined, 5);
  glow.cone("#ffc24a", 0.26, 0.6, [0.06, 0.6, -0.04], [0, 0.6, 0], 4);
  glow.cone("#fff0a8", 0.13, 0.38, [-0.03, 0.56, 0.05], [0, 1.2, 0], 4);
}
