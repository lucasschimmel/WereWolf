import * as T from "three";
import { Builder, rng } from "../kit";
import {
  buildGround,
  buildMountains,
  buildPlaza,
  firePit,
  instanced,
  lampRing,
  makeFillers,
  makeHome,
  mesh,
  plant,
  rolling,
  type Sprout,
  shuffle,
  sprout,
} from "./common";
import {
  type CottageStyle,
  cottage,
  mushroomHouse,
  witchHouse,
} from "./dwellings";
import {
  grey,
  pineSpecies,
  plainGeometry,
  ringPoints,
  roundSpecies,
} from "./flora";
import { bellTower } from "./landmarks";
import { barrels, bench, signpost, sled, snowman, woodpile } from "./props";
import { maxSeats } from "./ring";
import type {
  Circle,
  GlowSpot,
  MapContext,
  MapDefinition,
  World,
} from "./types";

const snow = "#f4f6fb";
const towerAt = new T.Vector3(0, 0, -22.5);
const lake = { x: 34, z: 9, r: 11 };
const style: CottageStyle = {
  plasters: ["#7a563c", "#6b4a36", "#8a6244", "#5d4030"],
  roofs: ["#3e4a5e", "#4a3f3a", "#56525a"],
  shutters: ["#b8423a", "#3f6b5e", "#d9a441", "#3d5a80"],
  timber: "#3a2a22",
  stone: "#8a8f9a",
  path: "#c4bfb6",
  snow,
};
const lakeDistance = (x: number, z: number) =>
  Math.hypot(x - lake.x, z - lake.z);
function height(x: number, z: number) {
  const slope = rolling(x, z, 24, 1.9);
  const basin =
    1 - T.MathUtils.smoothstep(lakeDistance(x, z), lake.r - 2, lake.r + 5);
  return T.MathUtils.lerp(slope, -0.7, basin);
}
const onLane = (x: number, z: number) => z > 8 && Math.abs(x) < 3.2;
const inLake = (x: number, z: number) => lakeDistance(x, z) < lake.r + 2;

function ground({ budget, materials }: MapContext) {
  const fresh = new T.Color("#eef2f8");
  const blue = new T.Color("#d9e2ef");
  const trodden = new T.Color("#d2d6de");
  const rock = new T.Color("#8a8f9a");
  return buildGround(budget, materials, 340, height, (x, z, y, color) => {
    const distance = Math.hypot(x, z);
    const noise =
      Math.sin(x * 0.19) * Math.cos(z * 0.16) + Math.sin((x + z) * 0.06);
    color.copy(fresh).lerp(blue, noise * 0.3 + 0.45);
    if (distance < 22) color.lerp(trodden, 0.5);
    if (y > 9 && noise > 0.1) color.lerp(rock, Math.min(0.8, (y - 9) / 8));
  });
}

function dressing(random: () => number, spots: GlowSpot[]) {
  const b = new Builder(random, 0.05);
  const glow = new Builder(random, 0);
  b.cylinder("#6f747e", [1.75, 1.85, 0.1], [0, 0.11, 0], undefined, 14);
  firePit(b, glow, ["#8a8f9a", "#7a7f8a", "#9aa0aa"]);
  lampRing(b, glow, spots, 8, 11.4);
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    b.box(
      snow,
      [0.4, 0.07, 0.4],
      [Math.sin(angle) * 11.4, 3.04, Math.cos(angle) * 11.4],
    );
  }
  b.box(style.path, [2.8, 0.05, 62], [0, 0.035, 41]);
  b.box(style.path, [2, 0.05, 9], [0, 0.035, -15.4]);
  // The frozen tarn east of the village, with a little jetty caught in ice.
  b.cylinder(
    "#a9d3e8",
    [lake.r, lake.r, 0.08],
    [lake.x, -0.42, lake.z],
    undefined,
    16,
  );
  for (let streak = 0; streak < 7; streak++)
    b.box(
      "#d4ecf7",
      [1.2 + random() * 3, 0.03, 0.14],
      [
        lake.x + (random() - 0.5) * lake.r,
        -0.36,
        lake.z + (random() - 0.5) * lake.r,
      ],
      [0, random() * 3, 0],
    );
  for (let plank = 0; plank < 8; plank++)
    b.box(
      plank % 2 ? "#6b4a36" : "#7a563c",
      [0.5, 0.09, 1.8],
      [lake.x - lake.r - 1.2 + plank * 0.56, -0.12, lake.z],
    );
  for (const x of [lake.x - lake.r + 0.4, lake.x - lake.r + 2.6])
    for (const side of [-0.9, 0.9])
      b.box("#3a2a22", [0.14, 0.9, 0.14], [x, -0.1, lake.z + side]);
  return { solid: b.build(), glow: glow.build() };
}

function* nature(
  context: MapContext,
  random: () => number,
  group: T.Group,
  avoid: Circle[],
) {
  const { budget, materials } = context;
  const detailed = budget.treeLod > 0;
  const species = [
    pineSpecies(random, detailed, ["#2c5346", "#33604e", "#3b6c57"], snow),
    roundSpecies(
      random,
      detailed,
      ["#e9eef5", "#dfe6f0", "#f4f6fb", "#d4dce8"],
      "#4a3a34",
    ),
  ];
  const reject = (x: number, z: number) => onLane(x, z) || inLake(x, z);
  const trees: Sprout[] = [];
  for (const { x, z, radius } of ringPoints(
    random,
    budget.trees,
    21.5,
    82,
    avoid,
    0.8,
    reject,
  )) {
    const scale = (radius < 30 ? 0.8 : 1) + random() * 0.8;
    trees.push(
      sprout(
        random() > 0.2 ? 0 : 1,
        x,
        height(x, z) - 0.1,
        z,
        [scale, scale * (0.95 + random() * 0.35), scale],
        random() * 6,
        grey(random, 0.9, 0.2),
      ),
    );
  }
  group.add(...plant(context, species, trees, 46));
  yield;

  const drifts = ringPoints(
    random,
    budget.bushes * 2,
    12,
    46,
    [],
    1,
    (x, z) => {
      const radius = Math.hypot(x, z);
      return reject(x, z) || (radius > 13.4 && radius < 20.2);
    },
  );
  group.add(
    instanced(
      plainGeometry("drift"),
      materials.solid,
      drifts.map(({ x, z }) => {
        const scale = 0.8 + random() * 1.6;
        return sprout(
          0,
          x,
          height(x, z) - scale * 0.12,
          z,
          [scale * 1.5, scale * 0.34, scale],
          random() * 6,
          grey(random, 0.9, 0.1),
        );
      }),
    ),
  );
  const rocks = ringPoints(random, 60, 20.5, 80, avoid, 1, reject);
  group.add(
    instanced(
      plainGeometry("rock"),
      materials.solid,
      rocks.map(({ x, z }) => {
        const scale = 0.5 + random() ** 2 * 2.4;
        return sprout(
          0,
          x,
          height(x, z) + scale * 0.2,
          z,
          [scale * 1.3, scale * 0.85, scale],
          random() * 6,
          grey(random, 0.3, 0.2),
        );
      }),
    ),
  );
  yield;
  group.add(
    buildMountains(
      random,
      materials,
      { rock: ["#6a7388", "#5b6478"], snow: "#f1f4f9", snowLine: 30 },
      128,
      34,
    ),
  );
}

function build(context: MapContext): World {
  const { budget, materials, seed } = context;
  const random = rng(seed);
  const group = new T.Group();
  const detail = new T.Group();
  const glowSpots: GlowSpot[] = [];
  group.add(
    ground(context),
    buildPlaza(context, rng(3), {
      base: "#5c616b",
      curb: "#aab0ba",
      cobbles: [
        "#8a8f9a",
        "#7a7f8a",
        "#9aa0aa",
        "#e6eaf1",
        "#6f747e",
        "#dfe4ec",
      ],
    }),
  );
  const parts = dressing(random, glowSpots);
  group.add(
    mesh(parts.solid, materials.solid, budget.shadows),
    mesh(parts.glow, materials.glow, false),
  );
  const tower = bellTower(context, towerAt, {
    stone: ["#9aa0aa", "#868c98", "#6f747e"],
    roof: "#3e4a5e",
    snow,
  });
  glowSpots.push(tower.spot);
  group.add(tower.group);

  const recipes = shuffle(random, [
    ...Array.from({ length: maxSeats - 3 }, () => "chalet" as const),
    "mushroom" as const,
    "mushroom" as const,
    "witch" as const,
  ]);
  const homes = recipes.map((kind) =>
    makeHome(context, random, (home) =>
      kind === "chalet"
        ? cottage(home, random, style)
        : kind === "mushroom"
          ? mushroomHouse(home, random, {
              caps: ["#c8372f", "#b8423a"],
              stem: "#efe6d2",
              spots: "#f8f1e2",
              path: style.path,
              snow,
            })
          : witchHouse(home, random, style.path, snow),
    ),
  );
  const fillers = makeFillers(
    context,
    random,
    shuffle(random, [
      snowman,
      sled,
      woodpile(snow),
      barrels(snow),
      bench(snow),
      signpost(snow),
      snowman,
    ]),
    maxSeats,
  );
  for (const { object } of [...homes, ...fillers]) group.add(object);
  group.add(detail);
  const avoid: Circle[] = [
    { x: 0, z: 0, r: 20.4 },
    { x: towerAt.x, z: towerAt.z, r: 4.6 },
  ];
  return {
    group,
    homes,
    fillers,
    glowSpots,
    bell: tower.bell,
    detail,
    nature: nature(context, rng(seed + 19), group, avoid),
  };
}

export const definition: MapDefinition = {
  id: "pass",
  name: "Col enneigé",
  mood: {
    day: {
      top: "#6f9fd0",
      horizon: "#e6eef6",
      fog: "#e4ebf2",
      sky: "#eaf2ff",
      ground: "#aab4c4",
      hemi: 1.35,
    },
    golden: { fog: "#ecd3bd", ground: "#9a94a0" },
    dusk: { fog: "#9a8296", ground: "#5a5a78" },
    night: { fog: "#1a2440", ground: "#252a40", hemi: 1.15 },
    dawn: { fog: "#e0c6c4", ground: "#8a8a9a" },
  },
  motes: { day: "#ffffff", night: "#cfe0ff" },
  build,
};
