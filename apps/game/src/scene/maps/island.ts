import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Builder, rng } from "../kit";
import {
  buildPlaza,
  instanced,
  lampRing,
  makeFillers,
  makeHome,
  mesh,
  plant,
  type Sprout,
  sectored,
  shuffle,
  sprout,
} from "./common";
import { type CottageStyle, cottage, mushroomHouse } from "./dwellings";
import {
  bushGeometry,
  grey,
  pineSpecies,
  plainGeometry,
  ringPoints,
  roundSpecies,
  tuftGeometry,
} from "./flora";
import { bellFrame } from "./landmarks";
import { barrels, bench, planter, signpost, stall } from "./props";
import { maxSeats } from "./ring";
import { floatingRock, type RockPalette, ropeBridge } from "./rock";
import type {
  Circle,
  GlowSpot,
  MapContext,
  MapDefinition,
  World,
} from "./types";

const bellAt = new T.Vector3(0, 0, -22.5);
const millAt = new T.Vector3(-21, 0, -18);
const pondAt = new T.Vector3(25, 0, -16);
const style: CottageStyle = {
  plasters: ["#f4efe4", "#efe6d2", "#e6eef0", "#f3e3d3", "#e9e4f0"],
  roofs: ["#3f7f8c", "#4a6fa5", "#d0705a", "#5b8f7a", "#7a5fa0", "#356a8a"],
  shutters: ["#3f7f8c", "#d0705a", "#4a6fa5", "#e0a84a", "#7a5fa0"],
  timber: "#5a4636",
  stone: "#a39d94",
  path: "#c9b48a",
};
const palette: RockPalette = {
  top: ["#7fb053", "#74a64c", "#8aba5c", "#6d9c48"],
  rim: "#8a7052",
  strata: ["#8a7052", "#8d8880", "#77726c", "#625e5a", "#4f4c4a"],
};
/** The shoreline of the main island, as a radius per bearing. */
const shore = (angle: number) =>
  37 + Math.sin(angle * 3 + 0.5) * 2.4 + Math.sin(angle * 5 + 2) * 1.5;
const inland = (x: number, z: number, margin: number) =>
  Math.hypot(x, z) < shore(Math.atan2(z, x)) - margin;
const onLane = (x: number, z: number) => z > 8 && Math.abs(x) < 3.2;

type Islet = { x: number; y: number; z: number; radius: number };

function islets(random: () => number) {
  const list: Islet[] = [
    { x: 55, y: 1.6, z: 6, radius: 9.5 },
    { x: -52, y: -1.2, z: 20, radius: 8.5 },
  ];
  for (let index = 0; index < 7; index++) {
    const angle = 0.9 + index * 0.83 + random() * 0.3;
    const reach = 66 + random() * 52;
    list.push({
      x: Math.cos(angle) * reach,
      y: -16 + random() * 34,
      z: Math.sin(angle) * reach,
      radius: 6 + random() * 9,
    });
  }
  return list;
}

function land(context: MapContext, random: () => number, satellites: Islet[]) {
  const { budget, materials } = context;
  const segments = budget.terrain > 60 ? 56 : 36;
  const main = floatingRock(random, shore, 46, segments, palette);
  const ground = mesh(main, materials.solid, false);
  ground.receiveShadow = budget.shadows;
  ground.position.y = -0.03;
  ground.updateMatrix();
  const rocks = satellites.map(({ x, y, z, radius }) => {
    const phase = random() * 6;
    return floatingRock(
      random,
      (angle) => radius * (1 + Math.sin(angle * 3 + phase) * 0.14),
      radius * (1.1 + random() * 0.7),
      14,
      palette,
      [0.6, 0.9, 1],
    ).translate(x, y, z);
  });
  const far = new T.Mesh(mergeGeometries(rocks) ?? rocks[0], materials.solid);
  for (const rock of rocks) rock.dispose();
  far.matrixAutoUpdate = false;
  return [ground, far];
}

function clouds(random: () => number) {
  const b = new Builder(random, 0.03);
  for (let index = 0; index < 16; index++) {
    const angle = index * 0.71 + random();
    const reach = 46 + random() * 110;
    const y = -20 - random() * 26;
    for (let puff = 0; puff < 4; puff++)
      b.ball(
        "#f6f3ee",
        [7 + random() * 6, 2.6 + random() * 1.6, 6 + random() * 5],
        [
          Math.cos(angle) * reach + (puff - 1.5) * 7,
          y + random() * 2,
          Math.sin(angle) * reach + (random() - 0.5) * 8,
        ],
      );
  }
  return b.build();
}

function windmill({ budget, materials }: MapContext, random: () => number) {
  const b = new Builder(random, 0.04);
  const glow = new Builder(random, 0);
  b.cylinder("#8d8880", [3.1, 3.3, 0.6], [0, 0.3, 0], undefined, 8);
  b.cylinder("#f1ebdd", [1.9, 2.9, 7.4], [0, 4.3, 0], undefined, 8);
  b.cylinder("#5a4636", [2.1, 2.1, 0.3], [0, 8.1, 0], undefined, 8);
  b.cone("#d0705a", 2.5, 2.8, [0, 9.6, 0], undefined, 8);
  b.box("#5a4636", [1.1, 2.0, 0.2], [0, 1.6, 2.72]);
  glow.box("#ffc46a", [0.7, 0.9, 0.2], [0, 5.2, 2.3]);
  b.box("#5a4636", [0.9, 1.1, 0.16], [0, 5.2, 2.26]);
  b.cylinder(
    "#5a4636",
    [0.22, 0.22, 1.6],
    [0, 7.2, 2.3],
    [Math.PI / 2, 0, 0],
    6,
  );
  const group = new T.Group();
  group.position.copy(millAt);
  group.rotation.y = Math.atan2(-millAt.x, -millAt.z);
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  group.add(
    mesh(b.build(), materials.solid, budget.shadows),
    mesh(glow.build(), materials.glow, false),
  );
  const sails = new Builder(random, 0.04);
  for (let blade = 0; blade < 4; blade++) {
    const angle = (blade / 4) * Math.PI * 2;
    const along: [number, number, number] = [0, 0, angle];
    const reach = (distance: number, offset = 0): [number, number, number] => [
      -Math.sin(angle) * distance + Math.cos(angle) * offset,
      Math.cos(angle) * distance + Math.sin(angle) * offset,
      0,
    ];
    sails.box("#5a4636", [0.16, 5.6, 0.12], reach(2.8), along);
    sails.box("#f6f0e0", [1.25, 3.9, 0.05], reach(3.5, 0.7), along);
    for (let rung = 0; rung < 4; rung++)
      sails.box(
        "#5a4636",
        [1.3, 0.07, 0.08],
        reach(1.9 + rung * 1.1, 0.7),
        along,
      );
  }
  const blades = new T.Mesh(sails.build(), materials.solid);
  blades.castShadow = budget.shadows;
  blades.position.set(0, 7.2, 3.15);
  group.add(blades);
  const spot: GlowSpot = {
    position: new T.Vector3(0, 5.2, 2.5).applyMatrix4(group.matrix),
    size: 3,
    color: "#ffb760",
  };
  return { group, blades, spot };
}

function dressing(
  random: () => number,
  spots: GlowSpot[],
  satellites: Islet[],
) {
  const b = new Builder(random, 0.05);
  const glow = new Builder(random, 0);
  // A shallow basin: the rim stays below a seated player's knees.
  b.cylinder("#a39d94", [1.5, 1.65, 0.42], [0, 0.27, 0], undefined, 12);
  b.cylinder("#4f9bb8", [1.25, 1.25, 0.06], [0, 0.47, 0], undefined, 12);
  b.cylinder("#8d8880", [0.3, 0.42, 0.5], [0, 0.6, 0], undefined, 6);
  glow.ball("#bfeaff", 0.24, [0, 0.98, 0]);
  spots.push({ position: new T.Vector3(0, 1, 0), size: 3, color: "#8fd4ff" });
  lampRing(b, glow, spots, 8, 11.4, "#ffd08a");
  b.box(style.path, [2.8, 0.05, 23.5], [0, 0.035, 22.3]);
  b.box(style.path, [2, 0.05, 9], [0, 0.035, -15.4]);
  // A lookout pier reaching over the void at the end of the lane.
  for (let plank = 0; plank < 11; plank++)
    b.box(
      plank % 2 ? "#8a6a4a" : "#7a5a3e",
      [3.2, 0.1, 0.56],
      [0, 0.05, 34 + plank * 0.6],
    );
  for (const x of [-1.5, 1.5]) {
    for (const z of [34.2, 37, 39.8])
      b.box("#5a4636", [0.14, 1.1, 0.14], [x, 0.55, z]);
    b.box("#5a4636", [0.08, 0.08, 5.8], [x, 1.05, 37]);
    b.box("#2d2324", [0.16, 2.6, 0.16], [x, 1.3, 40]);
    glow.box("#ffcf7a", [0.26, 0.32, 0.26], [x, 2.7, 40]);
    spots.push({
      position: new T.Vector3(x, 2.7, 40),
      size: 3.2,
      color: "#ffb760",
    });
  }
  b.box("#5a4636", [3.2, 0.08, 0.08], [0, 1.05, 39.9]);
  b.cylinder(
    "#4f9bb8",
    [2.6, 2.6, 0.06],
    [pondAt.x, 0.04, pondAt.z],
    undefined,
    10,
  );
  b.cylinder(
    "#a39d94",
    [2.9, 3.0, 0.05],
    [pondAt.x, 0.01, pondAt.z],
    undefined,
    10,
  );
  for (const [index, islet] of satellites.slice(0, 2).entries()) {
    const angle = Math.atan2(islet.z, islet.x);
    const start = shore(angle) - 1.2;
    const reach = Math.hypot(islet.x, islet.z) - islet.radius * 0.82;
    ropeBridge(
      b,
      new T.Vector3(Math.cos(angle) * start, 0.08, Math.sin(angle) * start),
      new T.Vector3(
        Math.cos(angle) * reach,
        islet.y + 0.08,
        Math.sin(angle) * reach,
      ),
      ["#8a6a4a", "#7a5a3e"],
    );
    b.cylinder(
      "#a39d94",
      [1.3, 1.5, 0.5],
      [islet.x, islet.y + 0.25, islet.z],
      undefined,
      7,
    );
    glow.ball(index ? "#ffd76a" : "#bfeaff", 0.34, [
      islet.x,
      islet.y + 1.2,
      islet.z,
    ]);
    b.box("#8d8880", [0.2, 0.7, 0.2], [islet.x, islet.y + 0.7, islet.z]);
    spots.push({
      position: new T.Vector3(islet.x, islet.y + 1.2, islet.z),
      size: 4,
      color: index ? "#ffc860" : "#8fd4ff",
    });
  }
  return { solid: b.build(), glow: glow.build() };
}

/** Water spilling off the rim, with foam that loops as it falls. */
function waterfall({ materials }: MapContext, random: () => number) {
  const angle = Math.atan2(pondAt.z, pondAt.x);
  const rim = shore(angle) - 0.4;
  const lip = new T.Vector3(Math.cos(angle) * rim, 0, Math.sin(angle) * rim);
  const yaw = Math.atan2(lip.x, lip.z);
  const b = new Builder(random, 0.04);
  const middle = lip.clone().add(pondAt).multiplyScalar(0.5);
  b.box(
    "#4f9bb8",
    [1.5, 0.05, lip.distanceTo(pondAt)],
    [middle.x, 0.04, middle.z],
    [0, yaw, 0],
  );
  b.box(
    "#7fc3dc",
    [1.5, 30, 0.3],
    [lip.x * 1.01, -15, lip.z * 1.01],
    [0, yaw, 0],
  );
  b.box(
    "#a9dcee",
    [0.5, 30, 0.34],
    [lip.x * 1.012, -15, lip.z * 1.012],
    [0, yaw, 0],
  );
  const fall = new T.Mesh(b.build(), materials.solid);
  fall.matrixAutoUpdate = false;
  const froth = new Builder(random, 0);
  for (let index = 0; index < 9; index++)
    froth.box(
      "#f4fbff",
      [0.25 + random() * 0.3, 0.9 + random() * 0.8, 0.1],
      [(random() - 0.5) * 1.2, -index * 3.2 - random(), 0.2],
    );
  const foam = new T.Mesh(froth.build(), materials.solid);
  foam.position.copy(lip).multiplyScalar(1.012);
  foam.rotation.y = yaw;
  return { fall, foam };
}

function* nature(
  context: MapContext,
  random: () => number,
  group: T.Group,
  detail: T.Group,
  avoid: Circle[],
  satellites: Islet[],
) {
  const { budget, materials } = context;
  const detailed = budget.treeLod > 0;
  const species = [
    pineSpecies(random, detailed, ["#2f6a55", "#3a7a5f", "#46896a"]),
    roundSpecies(random, detailed, [
      "#6aa046",
      "#7bb04f",
      "#5c9240",
      "#8cbe58",
    ]),
    roundSpecies(
      random,
      detailed,
      ["#e79ab4", "#f0b3c6", "#dd86a4", "#f6c8d4"],
      "#6a5244",
    ),
  ];
  const reject = (x: number, z: number) => onLane(x, z) || !inland(x, z, 2.6);
  const trees: Sprout[] = [];
  const count = Math.round(budget.trees * 0.24);
  for (const { x, z } of ringPoints(
    random,
    count,
    21.5,
    40,
    avoid,
    1,
    reject,
  )) {
    const kind = random() < 0.3 ? 0 : random() < 0.72 ? 1 : 2;
    const scale = 0.8 + random() * 0.7;
    trees.push(
      sprout(kind, x, -0.1, z, scale, random() * 6, grey(random, 0.88, 0.26)),
    );
  }
  for (const islet of satellites) {
    const grove = 2 + Math.floor(random() * (islet.radius * 0.45));
    for (let index = 0; index < grove; index++) {
      const angle = random() * Math.PI * 2;
      const reach = Math.sqrt(random()) * islet.radius * 0.62;
      const kind = random() < 0.45 ? 0 : random() < 0.75 ? 1 : 2;
      trees.push(
        sprout(
          kind,
          islet.x + Math.cos(angle) * reach,
          islet.y - 0.1,
          islet.z + Math.sin(angle) * reach,
          0.9 + random() * 0.9,
          random() * 6,
          grey(random, 0.88, 0.26),
        ),
      );
    }
  }
  group.add(...plant(context, species, trees, 46));
  yield;

  const bushes = ringPoints(random, budget.bushes, 20.5, 40, avoid, 1, reject);
  group.add(
    instanced(
      bushGeometry(random, ["#5a9442", "#6aa64c", "#4f863a"]),
      materials.wind,
      bushes.map(({ x, z }) =>
        sprout(
          0,
          x,
          0,
          z,
          0.7 + random() * 0.8,
          random() * 6,
          grey(random, 0.85, 0.3),
        ),
      ),
    ),
  );
  const stones: Sprout[] = [];
  for (let index = 0; index < 44; index++) {
    const angle = random() * Math.PI * 2;
    const reach = shore(angle) - 0.6 - random() * 2.2;
    const x = Math.cos(angle) * reach;
    const z = Math.sin(angle) * reach;
    if (onLane(x, z)) continue;
    const scale = 0.4 + random() ** 2 * 1.3;
    stones.push(
      sprout(
        0,
        x,
        scale * 0.25,
        z,
        [scale * 1.3, scale * 0.8, scale],
        random() * 6,
        grey(random, 0.2, 0.14),
      ),
    );
  }
  group.add(instanced(plainGeometry("rock"), materials.solid, stones));
  yield;

  const offLawn = (x: number, z: number) => {
    const radius = Math.hypot(x, z);
    return reject(x, z) || (radius > 13.4 && radius < 20.2);
  };
  if (budget.grass > 0) {
    const tufts = ringPoints(random, budget.grass, 11.2, 38, [], 1.2, offLawn);
    detail.add(
      ...sectored(
        tuftGeometry(random, ["#8cc05a", "#79ae4c"]),
        materials.wind,
        tufts.map(({ x, z }) =>
          sprout(
            0,
            x,
            -0.05,
            z,
            0.6 + random() * 0.8,
            random() * 6,
            grey(random, 0.8, 0.4),
          ),
        ),
      ),
    );
    yield;
  }
  if (budget.flowerPatches > 0) {
    const petals = ["#f06a8a", "#ffd24e", "#ffffff", "#b48af0", "#6ec8f0"].map(
      (hex) => new T.Color(hex),
    );
    const blooms: Sprout[] = [];
    const patches = ringPoints(
      random,
      budget.flowerPatches * 2,
      11.8,
      36,
      [],
      1,
      offLawn,
    );
    for (const [patch, spot] of patches.entries())
      for (let index = 0; index < 9; index++)
        blooms.push(
          sprout(
            0,
            spot.x + (random() - 0.5) * 2.2,
            0.2,
            spot.z + (random() - 0.5) * 2.2,
            1,
            0,
            petals[patch % petals.length],
          ),
        );
    detail.add(instanced(plainGeometry("petal"), materials.solid, blooms));
    yield;
  }
  const sea = new T.Mesh(clouds(random), materials.solid);
  sea.matrixAutoUpdate = false;
  group.add(sea);
}

function build(context: MapContext): World {
  const { budget, materials, seed } = context;
  const random = rng(seed);
  const group = new T.Group();
  const detail = new T.Group();
  const glowSpots: GlowSpot[] = [];
  const satellites = islets(rng(seed + 5));
  group.add(
    ...land(context, random, satellites),
    buildPlaza(context, rng(3), {
      base: "#8d8880",
      curb: "#b9b2a6",
      cobbles: [
        "#c9c2b4",
        "#b9b2a6",
        "#d6cfc0",
        "#a8a297",
        "#c2b6a2",
        "#d9d4c8",
      ],
    }),
  );
  const parts = dressing(random, glowSpots, satellites);
  group.add(
    mesh(parts.solid, materials.solid, budget.shadows),
    mesh(parts.glow, materials.glow, false),
  );
  const frame = bellFrame(context, bellAt, ["#5a4636", "#3f7f8c"]);
  const mill = windmill(context, random);
  const water = waterfall(context, random);
  glowSpots.push(...frame.spots, mill.spot);
  group.add(frame.group, mill.group, water.fall, water.foam);

  const recipes = shuffle(random, [
    ...Array.from({ length: maxSeats - 2 }, () => "cottage" as const),
    "mushroom" as const,
    "mushroom" as const,
  ]);
  const homes = recipes.map((kind) =>
    makeHome(context, random, (home) =>
      kind === "cottage"
        ? cottage(home, random, style)
        : mushroomHouse(home, random, {
            caps: ["#3f7f8c", "#4a6fa5", "#7a5fa0"],
            stem: "#f4efe4",
            spots: "#ffffff",
            path: style.path,
          }),
    ),
  );
  const fillers = makeFillers(
    context,
    random,
    shuffle(random, [
      planter(["#f06a8a", "#ffd24e", "#ffffff", "#b48af0"]),
      bench(),
      stall(["#f4efe4", "#3f7f8c"]),
      barrels(),
      signpost(),
      planter(["#6ec8f0", "#ffffff", "#f06a8a"]),
      stall(["#f4efe4", "#d0705a"]),
    ]),
    maxSeats,
  );
  for (const { object } of [...homes, ...fillers]) group.add(object);
  group.add(detail);
  const avoid: Circle[] = [
    { x: 0, z: 0, r: 20.4 },
    { x: bellAt.x, z: bellAt.z, r: 4 },
    { x: millAt.x, z: millAt.z, r: 5.5 },
    { x: pondAt.x, z: pondAt.z, r: 4 },
  ];
  return {
    group,
    homes,
    fillers,
    glowSpots,
    bell: frame.bell,
    detail,
    nature: nature(context, rng(seed + 19), group, detail, avoid, satellites),
    animate: (time) => {
      mill.blades.rotation.z = time * 0.45;
      water.foam.position.y = -((time * 5) % 3.2);
    },
  };
}

export const definition: MapDefinition = {
  id: "island",
  name: "Île flottante",
  mood: {
    day: { bottom: "#a9cdea", fog: "#dbe9f2", near: 70, far: 340 },
    golden: { bottom: "#e0b48c", near: 60, far: 300 },
    dusk: { bottom: "#8a5a66", near: 50, far: 260 },
    night: { bottom: "#10193a", near: 40, far: 220 },
    dawn: { bottom: "#d9a892", near: 55, far: 280 },
    eclipse: { bottom: "#3a1216", near: 40, far: 220 },
  },
  motes: { day: "#ffffff", night: "#bfeaff" },
  build,
};
