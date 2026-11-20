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
  sectored,
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
  bushGeometry,
  grey,
  pineSpecies,
  plainGeometry,
  ringPoints,
  roundSpecies,
  tuftGeometry,
} from "./flora";
import { bellTower, palisade } from "./landmarks";
import {
  barrels,
  bench,
  cart,
  haystacks,
  signpost,
  stall,
  woodpile,
} from "./props";
import { maxSeats } from "./ring";
import type {
  Circle,
  GlowSpot,
  MapContext,
  MapDefinition,
  World,
} from "./types";

const fence = 30;
const towerAt = new T.Vector3(0, 0, -22.5);
const fields = [
  { x: -24.8, z: 1.5, rx: 3.4, rz: 8.2 },
  { x: 24.8, z: -2.5, rx: 3.4, rz: 8.2 },
];
const style: CottageStyle = {
  plasters: ["#eadcbf", "#e2c595", "#dcb6a0", "#c8cfb4", "#e8d2ad", "#cfb79c"],
  roofs: ["#8f4936", "#58606f", "#ad8a52", "#7b4434", "#4e5668", "#9b7746"],
  shutters: ["#3f6b5e", "#7d3a3a", "#3d5a80", "#6d5c38", "#5b4a6e"],
  timber: "#4b3428",
  stone: "#7f786f",
  path: "#8a7052",
};
const height = (x: number, z: number) => rolling(x, z);
const inField = (x: number, z: number, margin = 0) =>
  fields.some(
    (field) =>
      ((x - field.x) / (field.rx + margin)) ** 2 +
        ((z - field.z) / (field.rz + margin)) ** 2 <
      1,
  );
const onLane = (x: number, z: number) => z > 8 && Math.abs(x) < 3.4;

function ground({ budget, materials }: MapContext) {
  const palette = {
    meadow: new T.Color("#6f8c46"),
    lush: new T.Color("#5b7a3a"),
    village: new T.Color("#859a58"),
    forest: new T.Color("#4a6533"),
    hill: new T.Color("#6e7b4b"),
    worn: new T.Color("#7d7650"),
  };
  return buildGround(budget, materials, 340, height, (x, z, y, color) => {
    const distance = Math.hypot(x, z);
    const noise =
      Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.07);
    color.copy(palette.meadow).lerp(palette.lush, noise * 0.35 + 0.5);
    if (distance < fence) color.lerp(palette.village, 0.45);
    if (distance > fence + 2)
      color.lerp(palette.forest, Math.min(1, (distance - fence) / 12) * 0.7);
    if (y > 4) color.lerp(palette.hill, Math.min(1, (y - 4) / 4));
    if (distance > 10.5 && distance < 13) color.lerp(palette.worn, 0.55);
  });
}

function dressing(random: () => number, spots: GlowSpot[]) {
  const b = new Builder(random, 0.05);
  const glow = new Builder(random, 0);
  b.cylinder("#6f685f", [1.75, 1.85, 0.1], [0, 0.11, 0], undefined, 14);
  firePit(b, glow, ["#8c847a", "#7a736a", "#6c655d"]);
  lampRing(b, glow, spots, 8, 11.4);
  b.box(style.path, [2.8, 0.05, 62], [0, 0.035, 41]);
  b.box(style.path, [2, 0.05, 9], [0, 0.035, -15.4]);
  for (const field of fields) {
    b.absorb(
      new Builder(random, 0.04)
        .cylinder("#a88a36", [1, 1, 0.07], [0, 0.03, 0], undefined, 14)
        .build()
        .scale(field.rx, 1, field.rz)
        .translate(field.x, 0, field.z),
    );
    for (let index = 0; index < 3; index++)
      b.cylinder(
        index % 2 ? "#d4b25e" : "#c9a44e",
        [0.5, 0.5, 0.95],
        [field.x - Math.sign(field.x) * 4.6, 0.5, field.z - 2.4 + index * 1.5],
        [0, 0.2 * index, Math.PI / 2],
        10,
      );
  }
  const [crow] = fields;
  b.box("#5d4534", [0.12, 2.4, 0.12], [crow.x, 1.2, crow.z]);
  b.box("#5d4534", [1.7, 0.1, 0.1], [crow.x, 1.75, crow.z]);
  b.box("#8c5a3c", [0.6, 0.8, 0.3], [crow.x, 1.5, crow.z]);
  b.ball("#d9b77a", 0.24, [crow.x, 2.2, crow.z]);
  b.cone("#3a2c28", 0.36, 0.42, [crow.x, 2.55, crow.z], undefined, 6);
  return { solid: b.build(), glow: glow.build() };
}

function* nature(
  context: MapContext,
  random: () => number,
  group: T.Group,
  detail: T.Group,
  avoid: Circle[],
) {
  const { budget, materials } = context;
  const detailed = budget.treeLod > 0;
  const species = [
    pineSpecies(random, detailed, ["#2f5a43", "#376649", "#3f7350"]),
    roundSpecies(random, detailed, [
      "#5a7f3e",
      "#6a8f45",
      "#4f7438",
      "#73984c",
    ]),
  ];
  const autumn = new T.Color(1.55, 0.92, 0.45);
  const reject = (x: number, z: number) =>
    onLane(x, z) ||
    inField(x, z, 1.2) ||
    Math.abs(Math.hypot(x, z) - fence) < 1.8;
  // Homes move with the number of players, so their whole ring stays bare.
  const offLawn = (x: number, z: number) => {
    const radius = Math.hypot(x, z);
    return reject(x, z) || (radius > 13.4 && radius < 20.2);
  };
  const trees: Sprout[] = [];
  const stand = [
    ...ringPoints(random, 20, 21.5, fence - 2, avoid, 1, reject),
    ...ringPoints(
      random,
      budget.trees - 20,
      fence + 2,
      80,
      avoid,
      0.85,
      reject,
    ),
  ];
  for (const { x, z, radius } of stand) {
    const scale = (radius < fence ? 0.75 : 0.9) + random() * 0.75;
    const pine = random() > (radius > 46 ? 0.25 : 0.6);
    trees.push(
      sprout(
        pine ? 0 : 1,
        x,
        height(x, z) - 0.1,
        z,
        [scale, scale * (0.9 + random() * 0.3), scale],
        random() * 6,
        !pine && random() < 0.28
          ? autumn.clone().multiplyScalar(0.9 + random() * 0.2)
          : grey(random, 0.85, 0.3),
      ),
    );
  }
  group.add(...plant(context, species, trees, 46));
  yield;

  const bushes = ringPoints(random, budget.bushes, 20.5, 40, avoid, 1, reject);
  group.add(
    instanced(
      bushGeometry(random, ["#4f7a3a", "#5e8a42", "#466e34"]),
      materials.wind,
      bushes.map(({ x, z }) =>
        sprout(
          0,
          x,
          height(x, z),
          z,
          0.7 + random() * 0.8,
          random() * 6,
          grey(random, 0.85, 0.3),
        ),
      ),
    ),
  );
  const rocks = ringPoints(random, 40, 20.5, 70, avoid, 1, reject);
  group.add(
    instanced(
      plainGeometry("rock"),
      materials.solid,
      rocks.map(({ x, z }) => {
        const scale = 0.3 + random() ** 2 * 1.4;
        return sprout(
          0,
          x,
          height(x, z) + scale * 0.2,
          z,
          [scale * 1.3, scale * 0.8, scale],
          random() * 6,
          grey(random, 0.2, 0.14),
        );
      }),
    ),
  );
  yield;

  if (budget.grass > 0) {
    const tufts = ringPoints(random, budget.grass, 11.2, 40, [], 1.4, offLawn);
    detail.add(
      ...sectored(
        tuftGeometry(random, ["#7fa04f", "#6a8c42"]),
        materials.wind,
        tufts.map(({ x, z }) =>
          sprout(
            0,
            x,
            height(x, z) - 0.05,
            z,
            0.6 + random() * 0.8,
            random() * 6,
            grey(random, 0.8, 0.4),
          ),
        ),
      ),
    );
    const ears: Sprout[] = [];
    const wheat = Math.round(budget.grass * 0.55);
    for (let index = 0; index < wheat; index++) {
      const field = fields[index % fields.length];
      const angle = random() * Math.PI * 2;
      const reach = Math.sqrt(random()) * 0.94;
      ears.push(
        sprout(
          0,
          field.x + Math.cos(angle) * reach * field.rx,
          0.02,
          field.z + Math.sin(angle) * reach * field.rz,
          [1.5, 0.9 + random() * 0.5, 1.5],
          random() * 6,
          grey(random, 0.85, 0.3),
        ),
      );
    }
    detail.add(
      instanced(
        tuftGeometry(random, ["#e0bd55", "#cfa544"], 0.85),
        materials.wind,
        ears,
      ),
    );
    yield;
  }

  if (budget.flowerPatches > 0) {
    const petals = ["#e8584f", "#f2c14e", "#f6f1e7", "#c86fb0", "#7ea6e0"].map(
      (hex) => new T.Color(hex),
    );
    const blooms: Sprout[] = [];
    for (const [patch, spot] of ringPoints(
      random,
      budget.flowerPatches,
      11.8,
      fence - 2,
      [],
      1,
      offLawn,
    ).entries())
      for (let index = 0; index < 9; index++) {
        const x = spot.x + (random() - 0.5) * 2.2;
        const z = spot.z + (random() - 0.5) * 2.2;
        blooms.push(sprout(0, x, 0.2, z, 1, 0, petals[patch % petals.length]));
      }
    detail.add(instanced(plainGeometry("petal"), materials.solid, blooms));
    yield;
  }
  group.add(
    buildMountains(random, materials, {
      rock: ["#56617b", "#4b5670"],
      snow: "#dfe3ea",
      snowLine: 62,
    }),
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
      base: "#5a544c",
      curb: "#8a8274",
      cobbles: [
        "#8d877c",
        "#7d776d",
        "#978f82",
        "#716b63",
        "#a1978a",
        "#867a6c",
      ],
    }),
  );
  const parts = dressing(random, glowSpots);
  group.add(
    mesh(parts.solid, materials.solid, budget.shadows),
    mesh(parts.glow, materials.glow, false),
  );
  const tower = bellTower(context, towerAt, {
    stone: ["#9a9184", "#857c70", "#6f685f"],
    roof: "#4e5568",
  });
  glowSpots.push(tower.spot);
  const wall = palisade(context, random, fence, height, ["#7a5638", "#8c6a48"]);
  glowSpots.push(...wall.spots);
  group.add(tower.group, wall.group);

  const recipes = shuffle(random, [
    ...Array.from({ length: maxSeats - 4 }, () => "cottage" as const),
    "mushroom" as const,
    "mushroom" as const,
    "witch" as const,
    "witch" as const,
  ]);
  const homes = recipes.map((kind) =>
    makeHome(context, random, (home) =>
      kind === "cottage"
        ? cottage(home, random, style)
        : kind === "mushroom"
          ? mushroomHouse(home, random, {
              caps: ["#c8372f", "#b8423a", "#d2553a"],
              stem: "#efe6d2",
              spots: "#f8f1e2",
              path: style.path,
            })
          : witchHouse(home, random, style.path),
    ),
  );
  const fillers = makeFillers(
    context,
    random,
    shuffle(random, [
      stall(["#f0e4cc", "#b8423a"]),
      cart("#d4b25e"),
      haystacks(["#d4b25e", "#c9a44e"]),
      bench(),
      barrels(),
      signpost(),
      woodpile("#7b4434"),
      stall(["#f0e4cc", "#3d5a80"]),
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
    nature: nature(context, rng(seed + 19), group, detail, avoid),
  };
}

export const definition: MapDefinition = {
  id: "hamlet",
  name: "Hameau palissadé",
  mood: {},
  motes: { day: "#fff3c4", night: "#d9ff7a" },
  build,
};
