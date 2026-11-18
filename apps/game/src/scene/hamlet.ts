import * as T from "three";
import { Builder, type Materials, rng } from "./kit";
import { towerPosition } from "./layout";
import type { Budget } from "./quality";

export type GlowSpot = { position: T.Vector3; size: number; color: string };
export type VillageBuild = {
  group: T.Group;
  chimneys: T.Vector3[];
  bell: T.Object3D;
  glowSpots: GlowSpot[];
  water: T.Mesh;
};

const plasters = [
  "#eadcbf",
  "#e2c595",
  "#dcb6a0",
  "#c8cfb4",
  "#e8d2ad",
  "#cfb79c",
  "#d9c39b",
  "#bec8c6",
];
const roofs = [
  "#8f4936",
  "#58606f",
  "#ad8a52",
  "#7b4434",
  "#4e5668",
  "#9b7746",
];
const shutters = ["#3f6b5e", "#7d3a3a", "#3d5a80", "#6d5c38", "#5b4a6e"];
const flowers = ["#e8584f", "#f2c14e", "#f6f1e7", "#c86fb0", "#ef8d3c"];
const timber = "#4b3428";
const stone = "#7f786f";

type HouseSpec = { width: number; depth: number; height: number; roof: number };

function windowFront(
  b: Builder,
  glow: Builder,
  random: () => number,
  x: number,
  y: number,
  z: number,
  shutter: string,
) {
  b.box(timber, [0.95, 0.95, 0.1], [x, y, z + 0.04]);
  glow.box("#ffc46a", [0.72, 0.72, 0.1], [x, y, z + 0.07]);
  b.box(timber, [0.06, 0.72, 0.13], [x, y, z + 0.09]);
  b.box(timber, [0.72, 0.06, 0.13], [x, y, z + 0.09]);
  b.box(shutter, [0.34, 0.88, 0.05], [x - 0.66, y, z + 0.08], [0, 0.25, 0]);
  b.box(shutter, [0.34, 0.88, 0.05], [x + 0.66, y, z + 0.08], [0, -0.25, 0]);
  b.box("#6e5440", [1.05, 0.08, 0.24], [x, y - 0.52, z + 0.12]);
  if (random() > 0.35) {
    b.box("#5f4433", [0.86, 0.18, 0.24], [x, y - 0.66, z + 0.16]);
    for (let index = 0; index < 4; index++)
      b.ball(flowers[Math.floor(random() * flowers.length)], 0.09, [
        x - 0.3 + index * 0.2,
        y - 0.52,
        z + 0.17,
      ]);
  }
}

function cottage(
  high: Builder,
  highGlow: Builder,
  low: Builder,
  lowGlow: Builder,
  random: () => number,
  spec: HouseSpec,
) {
  const { width: w, depth: d, height: h, roof: r } = spec;
  const plaster = plasters[Math.floor(random() * plasters.length)];
  const roofColor = roofs[Math.floor(random() * roofs.length)];
  const shutter = shutters[Math.floor(random() * shutters.length)];
  const base = 0.5 + h;
  const slope = Math.atan2(r, d / 2);
  const eaveZ = d / 2 + 0.4;
  const eaveY = base - 0.4 * Math.tan(slope);
  const length = Math.hypot(eaveZ, base + r - eaveY) + 0.12;

  high.box(stone, [w + 0.3, 0.5, d + 0.3], [0, 0.25, 0]);
  high.box(plaster, [w, h, d], [0, 0.5 + h / 2, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      high.box(
        timber,
        [0.18, h, 0.18],
        [(sx * w) / 2, 0.5 + h / 2, (sz * d) / 2],
      );
  for (const sz of [-1, 1]) {
    high.box(
      timber,
      [w + 0.04, 0.15, 0.07],
      [0, base - 0.05, (sz * (d + 0.02)) / 2],
    );
    high.box(
      timber,
      [w + 0.04, 0.12, 0.07],
      [0, 0.5 + h * 0.18, (sz * (d + 0.02)) / 2],
    );
  }
  high.prism(plaster, [w, r, d], [0, base, 0]);
  for (const side of [-1, 1])
    high.box(
      roofColor,
      [w + 0.6, 0.16, length],
      [0, (base + r + eaveY) / 2 + 0.06, (side * eaveZ) / 2],
      [side * slope, 0, 0],
    );
  high.box("#3a2c28", [w + 0.7, 0.2, 0.32], [0, base + r + 0.06, 0]);
  const chimney: [number, number, number] = [
    w * 0.28,
    base + r * 0.55,
    -d * 0.2,
  ];
  high.box(
    stone,
    [0.55, 1.7, 0.55],
    [chimney[0], chimney[1] + 0.45, chimney[2]],
  );
  high.box(
    "#5d5650",
    [0.7, 0.12, 0.7],
    [chimney[0], chimney[1] + 1.32, chimney[2]],
  );

  high.box(timber, [1.06, 1.78, 0.08], [0, 0.5 + 0.88, d / 2 + 0.03]);
  high.box(
    random() > 0.5 ? "#6b4630" : shutter,
    [0.84, 1.6, 0.08],
    [0, 0.5 + 0.8, d / 2 + 0.06],
  );
  high.ball("#d8b46a", 0.05, [0.28, 1.25, d / 2 + 0.12]);
  high.box(stone, [1.3, 0.3, 0.55], [0, 0.15, d / 2 + 0.42]);
  highGlow.box("#ffcf7a", [0.18, 0.24, 0.18], [0.78, 0.5 + 1.75, d / 2 + 0.2]);
  high.box("#2d2324", [0.26, 0.06, 0.26], [0.78, 0.5 + 1.9, d / 2 + 0.2]);
  high.box("#2d2324", [0.05, 0.05, 0.25], [0.78, 0.5 + 1.95, d / 2 + 0.07]);

  for (const x of [-w * 0.32, w * 0.32])
    windowFront(high, highGlow, random, x, 0.5 + h * 0.52, d / 2, shutter);
  for (const side of [-1, 1]) {
    high.box(
      timber,
      [0.1, 0.85, 0.85],
      [(side * (w + 0.04)) / 2, 0.5 + h * 0.52, 0],
    );
    highGlow.box(
      "#ffc46a",
      [0.1, 0.62, 0.62],
      [(side * (w + 0.1)) / 2, 0.5 + h * 0.52, 0],
    );
  }
  highGlow.box(
    "#ffc46a",
    [0.42, 0.42, 0.08],
    [0, base + r * 0.36, d / 2 + 0.02],
  );
  high.box(timber, [0.55, 0.55, 0.06], [0, base + r * 0.36, d / 2 + 0.01]);

  const extra = random();
  if (extra < 0.35) {
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 4 - row; column++)
        high.cylinder(
          random() > 0.5 ? "#8a6a4a" : "#a07c55",
          [0.13, 0.13, 0.95],
          [
            -w / 2 - 0.45,
            0.14 + row * 0.24,
            -d * 0.3 + column * 0.27 + row * 0.13,
          ],
          [Math.PI / 2, 0, Math.PI / 2],
          6,
        );
  } else if (extra < 0.7) {
    high.cylinder(
      "#7a5638",
      [0.3, 0.27, 0.8],
      [w / 2 + 0.55, 0.4, d * 0.25],
      undefined,
      9,
    );
    high.cylinder(
      "#3d3330",
      [0.31, 0.31, 0.06],
      [w / 2 + 0.55, 0.62, d * 0.25],
      undefined,
      9,
    );
    high.box(
      "#9a7650",
      [0.6, 0.55, 0.6],
      [w / 2 + 0.6, 0.27, d * 0.25 - 0.8],
      [0, 0.4, 0],
    );
  } else {
    for (let index = 0; index < 5; index++)
      high.box(
        "#8b6b4c",
        [0.08, 0.75, 0.08],
        [-w / 2 + index * (w / 4), 0.37, d / 2 + 1.5],
      );
    high.box("#8b6b4c", [w, 0.08, 0.06], [0, 0.55, d / 2 + 1.5]);
  }

  low.box(plaster, [w, h + 0.5, d], [0, (h + 0.5) / 2, 0]);
  low.prism(roofColor, [w + 0.5, r + 0.3, d + 0.8], [0, base - 0.3, 0]);
  low.box(
    stone,
    [0.55, 1.7, 0.55],
    [chimney[0], chimney[1] + 0.45, chimney[2]],
  );
  for (const x of [-w * 0.32, w * 0.32])
    lowGlow.box(
      "#ffc46a",
      [0.72, 0.72, 0.1],
      [x, 0.5 + h * 0.52, d / 2 + 0.04],
    );
  lowGlow.box("#ffcf7a", [0.2, 0.26, 0.2], [0.78, 0.5 + 1.75, d / 2 + 0.2]);

  return {
    chimney: new T.Vector3(chimney[0], chimney[1] + 1.45, chimney[2]),
    lamps: [
      { position: new T.Vector3(0.78, 0.5 + 1.75, d / 2 + 0.25), size: 2.2 },
      {
        position: new T.Vector3(-w * 0.32, 0.5 + h * 0.52, d / 2 + 0.2),
        size: 2.6,
      },
      {
        position: new T.Vector3(w * 0.32, 0.5 + h * 0.52, d / 2 + 0.2),
        size: 2.6,
      },
    ],
  };
}

function mesh(
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

function tower(materials: Materials, shadows: boolean) {
  const random = rng(31);
  const b = new Builder(random, 0.04);
  const glow = new Builder(random, 0);
  const stoneLight = "#9a9184";
  b.box("#6f685f", [4, 0.6, 4], [0, 0.3, 0]);
  b.box(stoneLight, [3.4, 7.2, 3.4], [0, 3.9, 0]);
  for (let band = 0; band < 3; band++)
    b.box("#857c70", [3.5, 0.18, 3.5], [0, 1.6 + band * 2.4, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.box("#8a8175", [0.5, 7.4, 0.5], [sx * 1.6, 3.9, sz * 1.6]);
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
  b.box("#7a7266", [3.8, 0.3, 3.8], [0, 7.6, 0]);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.box("#8a8175", [0.45, 2.5, 0.45], [sx * 1.55, 8.95, sz * 1.55]);
  b.box("#7a7266", [3.9, 0.35, 3.9], [0, 10.35, 0]);
  b.cone("#4e5568", 3.1, 4.4, [0, 12.7, 0], [0, Math.PI / 4, 0], 4);
  b.ball("#c9a24a", 0.2, [0, 15, 0]);
  b.box("#2a2224", [0.06, 1, 0.06], [0, 15.5, 0]);
  b.box("#2a2224", [0.6, 0.06, 0.06], [0, 15.75, 0]);
  const group = new T.Group();
  group.position.copy(towerPosition);
  group.add(
    mesh(b.build(), materials.solid, shadows),
    mesh(glow.build(), materials.glow, false),
  );

  const bellBuilder = new Builder(random, 0.02);
  bellBuilder.cylinder(
    "#b58a3c",
    [0.32, 0.78, 1.0],
    [0, -0.55, 0],
    undefined,
    12,
  );
  bellBuilder.cylinder(
    "#9a7430",
    [0.82, 0.82, 0.12],
    [0, -1.05, 0],
    undefined,
    12,
  );
  bellBuilder.ball("#6b5224", 0.16, [0, -1.12, 0]);
  bellBuilder.box("#4a3a2c", [1.6, 0.18, 0.18], [0, 0.02, 0]);
  const bell = new T.Group();
  bell.position.set(0, 9.9, 0);
  bell.add(new T.Mesh(bellBuilder.build(), materials.solid));
  group.add(bell);
  return { group, bell, clock: new T.Vector3(0, 6.2, 1.9).add(towerPosition) };
}

function well(materials: Materials, shadows: boolean) {
  const random = rng(11);
  const b = new Builder(random, 0.08);
  const blocks = 14;
  for (let index = 0; index < blocks; index++) {
    const angle = (index / blocks) * Math.PI * 2;
    b.box(
      index % 2 ? "#8c847a" : "#7a736a",
      [0.52, 0.8, 0.32],
      [Math.sin(angle) * 1.12, 0.4, Math.cos(angle) * 1.12],
      [0, angle, 0],
    );
    b.box(
      "#6c655d",
      [0.6, 0.1, 0.42],
      [Math.sin(angle) * 1.14, 0.85, Math.cos(angle) * 1.14],
      [0, angle, 0],
    );
  }
  for (const x of [-1.08, 1.08]) b.box(timber, [0.18, 2.4, 0.18], [x, 1.2, 0]);
  b.cylinder(
    "#5d4534",
    [0.08, 0.08, 2.4],
    [0, 2.05, 0],
    [0, 0, Math.PI / 2],
    6,
  );
  b.box("#3a2f2c", [0.1, 0.5, 0.08], [1.25, 1.88, 0]);
  b.prism("#7b4434", [2.9, 0.75, 1.9], [0, 2.38, 0]);
  b.cylinder("#6b4c34", [0.2, 0.17, 0.32], [0, 1.45, 0], undefined, 8);
  b.cylinder("#3c302b", [0.012, 0.012, 0.45], [0, 1.82, 0], undefined, 3);
  const group = new T.Group();
  group.add(mesh(b.build(), materials.solid, shadows));
  const water = new T.Mesh(
    new T.CircleGeometry(0.98, 20),
    new T.MeshStandardMaterial({
      color: "#1d3a46",
      roughness: 0.12,
      metalness: 0.35,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.55;
  group.add(water);
  return { group, water };
}

function plaza(budget: Budget, materials: Materials, shadows: boolean) {
  const random = rng(3);
  const b = new Builder(random, 0.1);
  b.cylinder("#5a544c", [10.8, 11, 0.14], [0, 0.0, 0], undefined, 48);
  const count = budget.stones;
  const spacing = 10.2 * Math.sqrt(Math.PI / count);
  const cobbles = [
    "#8d877c",
    "#7d776d",
    "#978f82",
    "#716b63",
    "#a1978a",
    "#867a6c",
  ];
  for (let index = 0; index < count; index++) {
    const radius = 10.15 * Math.sqrt((index + 0.5) / count);
    if (radius < 1.45) continue;
    const angle = index * 2.39996;
    b.box(
      cobbles[Math.floor(random() * cobbles.length)],
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
      "#8a8274",
      [1.25, 0.16, 0.42],
      [Math.sin(angle) * 10.6, 0.1, Math.cos(angle) * 10.6],
      [0, angle, 0],
    );
  }
  const result = mesh(b.build(), materials.solid, false);
  result.receiveShadow = shadows;
  return result;
}

function props(
  random: () => number,
  b: Builder,
  glow: Builder,
  spots: GlowSpot[],
) {
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(angle) * 11.4;
    const z = Math.cos(angle) * 11.4;
    b.box("#3b2f2c", [0.16, 2.8, 0.16], [x, 1.4, z]);
    b.box("#3b2f2c", [0.5, 0.07, 0.07], [x, 2.75, z], [0, angle, 0]);
    b.box("#2d2324", [0.36, 0.06, 0.36], [x, 2.98, z]);
    glow.box("#ffcf7a", [0.26, 0.32, 0.26], [x, 2.78, z]);
    spots.push({
      position: new T.Vector3(x, 2.78, z),
      size: 3.4,
      color: "#ffb760",
    });
  }
  const stall = new T.Matrix4().makeRotationY(0.32 + Math.PI);
  stall.setPosition(Math.sin(0.32) * 12.8, 0, Math.cos(0.32) * 12.8);
  const local = new Builder(random, 0.05);
  for (const x of [-1.2, 1.2])
    for (const z of [-0.6, 0.6])
      local.box("#5d4534", [0.12, 2.3, 0.12], [x, 1.15, z]);
  local.box("#7a5a3e", [2.6, 0.12, 1.3], [0, 0.95, 0]);
  local.box("#6b4c34", [2.5, 0.85, 0.08], [0, 0.5, 0.62]);
  for (let index = 0; index < 6; index++)
    local.box(
      index % 2 ? "#f0e4cc" : "#b8423a",
      [0.45, 0.06, 1.7],
      [-1.13 + index * 0.45, 2.3, 0],
      [0.25, 0, 0],
    );
  for (let index = 0; index < 9; index++)
    local.ball(["#e2873a", "#a9c24f", "#d9493f"][index % 3], 0.13, [
      -0.9 + (index % 5) * 0.42,
      1.12,
      -0.25 + Math.floor(index / 5) * 0.35,
    ]);
  for (let index = 0; index < 3; index++)
    local.box(
      "#9a7650",
      [0.55, 0.5, 0.55],
      [
        1.7 + (index % 2) * 0.15,
        0.25 + Math.floor(index / 2) * 0.5,
        -0.3 + index * 0.25,
      ],
      [0, index, 0],
    );
  b.absorb(local.build(), stall);
  for (const angle of [1.83, 4.45, 2.92]) {
    const x = Math.sin(angle) * 11.1;
    const z = Math.cos(angle) * 11.1;
    b.box("#7a5a3e", [1.9, 0.1, 0.5], [x, 0.5, z], [0, angle, 0]);
    for (const offset of [-0.7, 0.7])
      b.box(
        "#5d4534",
        [0.1, 0.45, 0.4],
        [x + Math.cos(angle) * offset, 0.23, z - Math.sin(angle) * offset],
        [0, angle, 0],
      );
  }
  for (let index = 0; index < 3; index++) {
    const angle = 2.24 + index * 0.12;
    b.cylinder(
      "#d4b25e",
      [0.48, 0.48, 0.9],
      [Math.sin(angle) * 13.3, 0.48, Math.cos(angle) * 13.3],
      [0, angle, Math.PI / 2],
      10,
    );
  }
}

export function buildVillage(
  budget: Budget,
  materials: Materials,
): VillageBuild {
  const random = rng(42);
  const group = new T.Group();
  const shadows = budget.shadows;
  const chimneys: T.Vector3[] = [];
  const glowSpots: GlowSpot[] = [];
  group.add(plaza(budget, materials, shadows));
  const wellParts = well(materials, shadows);
  group.add(wellParts.group);

  const scenery = new Builder(random, 0.05);
  const sceneryGlow = new Builder(random, 0);
  props(random, scenery, sceneryGlow, glowSpots);

  const slots = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
  for (const [index, slot] of slots.entries()) {
    const angle = (slot * Math.PI) / 6 + (random() - 0.5) * 0.12;
    const radius = (index % 2 ? 17.6 : 16) + random() * 0.8;
    const spec: HouseSpec = {
      width: 3.6 + random() * 1.1,
      depth: 3.2 + random() * 0.8,
      height: 2.5 + random() * 0.7,
      roof: 1.6 + random() * 0.8,
    };
    const high = new Builder(random);
    const highGlow = new Builder(random, 0.05);
    const low = new Builder(random);
    const lowGlow = new Builder(random, 0);
    const parts = cottage(high, highGlow, low, lowGlow, random, spec);
    const house = new T.LOD();
    house.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    house.rotation.y = angle + Math.PI;
    const near = new T.Group();
    near.add(
      mesh(high.build(), materials.solid, shadows),
      mesh(highGlow.build(), materials.glow, false),
    );
    const far = new T.Group();
    far.add(
      mesh(low.build(), materials.solid, false),
      mesh(lowGlow.build(), materials.glow, false),
    );
    house.addLevel(near, 0);
    house.addLevel(far, 42);
    group.add(house);
    house.updateMatrixWorld(true);
    chimneys.push(parts.chimney.applyMatrix4(house.matrixWorld));
    for (const lamp of parts.lamps)
      glowSpots.push({
        position: lamp.position.applyMatrix4(house.matrixWorld),
        size: lamp.size,
        color: "#ffb35c",
      });
    const pathLength = radius - spec.depth / 2 - 10.6;
    const pathRadius = 10.6 + pathLength / 2;
    scenery.box(
      "#8a7052",
      [1.5, 0.05, pathLength + 0.6],
      [Math.sin(angle) * pathRadius, 0.04, Math.cos(angle) * pathRadius],
      [0, angle, 0],
    );
  }
  scenery.box("#8a7052", [2.6, 0.05, 14], [0, 0.04, 17.5]);
  scenery.box("#8a7052", [2, 0.05, 7.5], [0, 0.04, -15]);

  const towerParts = tower(materials, shadows);
  group.add(towerParts.group);
  glowSpots.push({ position: towerParts.clock, size: 4, color: "#ffe2a8" });
  group.add(
    mesh(scenery.build(), materials.solid, shadows),
    mesh(sceneryGlow.build(), materials.glow, false),
  );
  return {
    group,
    chimneys,
    bell: towerParts.bell,
    glowSpots,
    water: wellParts.water,
  };
}
