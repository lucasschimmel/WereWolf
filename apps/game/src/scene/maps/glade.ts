import * as T from "three";
import { Builder, rng } from "../kit";
import {
  buildGround,
  buildPlaza,
  firePit,
  instanced,
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
import { mushroomHouse, roundHut, witchHouse } from "./dwellings";
import {
  bushGeometry,
  giantSpecies,
  grey,
  pineSpecies,
  plainGeometry,
  ringPoints,
  roundSpecies,
  tuftGeometry,
} from "./flora";
import { bellFrame } from "./landmarks";
import { barrels, cauldron, glowShrooms, tent, woodpile } from "./props";
import { maxSeats } from "./ring";
import type {
  Circle,
  GlowSpot,
  MapContext,
  MapDefinition,
  World,
} from "./types";

const bellAt = new T.Vector3(0, 0, -21.5);
const elderAt = new T.Vector3(0, 0, -29);
const path = "#6e5a40";
const rune = "#7ff0e0";
const leaves: [string, string, string] = ["#2f5a3a", "#3a6a40", "#27503a"];
const height = (x: number, z: number) => rolling(x, z, 26, 0.7);
const onLane = (x: number, z: number) => z > 8 && Math.abs(x) < 3.2;

function ground({ budget, materials }: MapContext) {
  const moss = new T.Color("#4c6a3a");
  const deep = new T.Color("#33502f");
  const litter = new T.Color("#6a5e3e");
  const shade = new T.Color("#2a4230");
  return buildGround(budget, materials, 340, height, (x, z, _y, color) => {
    const distance = Math.hypot(x, z);
    const noise =
      Math.sin(x * 0.23) * Math.cos(z * 0.19) + Math.sin((x - z) * 0.09);
    color.copy(moss).lerp(deep, noise * 0.35 + 0.5);
    if (distance < 22) color.lerp(litter, 0.35 + noise * 0.15);
    if (distance > 24)
      color.lerp(shade, Math.min(1, (distance - 24) / 14) * 0.75);
  });
}

function dressing(random: () => number, spots: GlowSpot[]) {
  const b = new Builder(random, 0.06);
  const glow = new Builder(random, 0);
  b.cylinder("#5a5650", [1.75, 1.85, 0.1], [0, 0.11, 0], undefined, 12);
  firePit(b, glow, ["#6f7468", "#5e6258", "#7b7f70"]);
  // Standing stones just outside the kerb, each carved with a glowing rune.
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(angle) * 11.9;
    const z = Math.cos(angle) * 11.9;
    const tall = 2.5 + random() * 1.1;
    const lean = (random() - 0.5) * 0.16;
    b.cylinder(
      index % 2 ? "#6f7468" : "#7b7f70",
      [0.34, 0.56, tall],
      [x, tall / 2 - 0.1, z],
      [lean, angle + 0.6, lean],
      5,
    );
    b.ball("#4c6a3a", [0.5, 0.16, 0.5], [x, tall - 0.05, z]);
    const inward = 0.5;
    const rx = x - Math.sin(angle) * inward;
    const rz = z - Math.cos(angle) * inward;
    glow.box(rune, [0.1, 0.5, 0.06], [rx, tall * 0.55, rz], [0, angle, 0]);
    glow.box(rune, [0.34, 0.1, 0.06], [rx, tall * 0.62, rz], [0, angle, 0.4]);
    spots.push({
      position: new T.Vector3(rx, tall * 0.58, rz),
      size: 2.6,
      color: rune,
    });
  }
  b.box(path, [2.6, 0.05, 62], [0, 0.035, 41]);
  b.box(path, [2, 0.05, 9], [0, 0.035, -15.4]);
  return { solid: b.build(), glow: glow.build() };
}

/** The elder tree behind the bell, hung with lanterns. */
function elder(context: MapContext, random: () => number, spots: GlowSpot[]) {
  const { budget, materials } = context;
  const species = giantSpecies(random, true, ["#3a6a40", "#467a48", "#2f5a3a"]);
  species.low.dispose();
  const tree = mesh(
    (species.high as T.BufferGeometry).scale(1.55, 1.55, 1.55),
    materials.solid,
    budget.shadows,
  );
  const glow = new Builder(random, 0);
  for (let index = 0; index < 6; index++) {
    const angle = index * 1.05 + 0.4;
    const reach = 3.6 + (index % 3) * 1.3;
    const y = 6.5 + (index % 2) * 2.2;
    glow.ball("#ffcf7a", 0.22, [
      Math.sin(angle) * reach,
      y,
      Math.cos(angle) * reach,
    ]);
    spots.push({
      position: new T.Vector3(
        Math.sin(angle) * reach,
        y,
        Math.cos(angle) * reach,
      ).add(elderAt),
      size: 2.8,
      color: "#ffb760",
    });
  }
  const group = new T.Group();
  group.position.copy(elderAt);
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  group.add(tree, mesh(glow.build(), materials.glow, false));
  return group;
}

/** Luminous toadstools scattered under the trees: two instanced draws. */
function shrooms(
  { materials }: MapContext,
  random: () => number,
  spots: GlowSpot[],
  avoid: Circle[],
) {
  const stem = new Builder(random, 0.04)
    .cylinder("#d8cfb8", [0.07, 0.1, 0.5], [0, 0.25, 0], undefined, 5)
    .build();
  const cap = new Builder(random, 0)
    .cylinder("#ffffff", [0.06, 0.3, 0.2], [0, 0.56, 0], undefined, 6)
    .build();
  const tints = [
    new T.Color(rune),
    new T.Color("#c8a0ff"),
    new T.Color("#b6ff7a"),
  ];
  const items: Sprout[] = [];
  const clusters = ringPoints(random, 18, 20.8, 36, avoid, 1, onLane);
  for (const [cluster, spot] of clusters.entries()) {
    const tint = tints[cluster % tints.length];
    for (let index = 0; index < 5; index++) {
      const x = spot.x + (random() - 0.5) * 1.6;
      const z = spot.z + (random() - 0.5) * 1.6;
      items.push(
        sprout(0, x, height(x, z), z, 0.7 + random() * 1.3, random() * 6, tint),
      );
    }
    spots.push({
      position: new T.Vector3(spot.x, height(spot.x, spot.z) + 0.7, spot.z),
      size: 2.6,
      color: `#${tint.getHexString()}`,
    });
  }
  const white = items.map((item) => ({ ...item, tint: new T.Color(1, 1, 1) }));
  return [
    instanced(stem, materials.solid, white),
    instanced(cap, materials.glow, items),
  ];
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
    pineSpecies(random, detailed, ["#234a3a", "#2b5640", "#336247"]),
    roundSpecies(random, detailed, [
      "#3a6a40",
      "#467a48",
      "#2f5a3a",
      "#528650",
    ]),
    giantSpecies(random, detailed, leaves),
  ];
  const trees: Sprout[] = [];
  // Giants stay clear of the spot the camera cuts to when the night ends.
  const clear = [...avoid, { x: -26, z: 30, r: 14 }];
  for (const { x, z } of ringPoints(random, 14, 29, 48, clear, 1, onLane))
    trees.push(
      sprout(
        2,
        x,
        height(x, z) - 0.3,
        z,
        0.85 + random() * 0.5,
        random() * 6,
        grey(random, 0.85, 0.25),
      ),
    );
  const giants = trees.map((tree) => {
    const where = new T.Vector3().setFromMatrixPosition(tree.matrix);
    return { x: where.x, z: where.z, r: 2.6 };
  });
  const crowd = [...avoid, ...giants];
  for (const { x, z, radius } of ringPoints(
    random,
    budget.trees,
    21.5,
    84,
    crowd,
    0.7,
    onLane,
  )) {
    const scale = (radius < 30 ? 0.9 : 1.1) + random() * 0.9;
    trees.push(
      sprout(
        random() > 0.38 ? 0 : 1,
        x,
        height(x, z) - 0.1,
        z,
        [scale, scale * (1 + random() * 0.4), scale],
        random() * 6,
        grey(random, 0.78, 0.3),
      ),
    );
  }
  group.add(...plant(context, species, trees, 44));
  yield;

  const bushes = ringPoints(
    random,
    budget.bushes * 2,
    20.5,
    42,
    crowd,
    1,
    onLane,
  );
  group.add(
    instanced(
      bushGeometry(random, ["#3f6a3a", "#4a7a42", "#356034"]),
      materials.wind,
      bushes.map(({ x, z }) =>
        sprout(
          0,
          x,
          height(x, z),
          z,
          0.8 + random() * 1.0,
          random() * 6,
          grey(random, 0.8, 0.3),
        ),
      ),
    ),
  );
  const mossy = new T.Color("#5a6a4a");
  const rocks = ringPoints(random, 50, 20.5, 60, crowd, 1, onLane);
  group.add(
    instanced(
      plainGeometry("rock"),
      materials.solid,
      rocks.map(({ x, z }) => {
        const scale = 0.4 + random() ** 2 * 1.8;
        return sprout(
          0,
          x,
          height(x, z) + scale * 0.2,
          z,
          [scale * 1.3, scale * 0.8, scale],
          random() * 6,
          mossy.clone().multiplyScalar(0.5 + random() * 0.35),
        );
      }),
    ),
  );
  yield;

  if (budget.grass > 0) {
    const offLawn = (x: number, z: number) => {
      const radius = Math.hypot(x, z);
      return onLane(x, z) || (radius > 13.4 && radius < 20.2);
    };
    const ferns = ringPoints(
      random,
      budget.grass,
      11.2,
      40,
      giants,
      1.3,
      offLawn,
    );
    detail.add(
      ...sectored(
        tuftGeometry(random, ["#4f8a46", "#3f763c"], 0.7),
        materials.wind,
        ferns.map(({ x, z }) =>
          sprout(
            0,
            x,
            height(x, z) - 0.05,
            z,
            [1.6, 0.8 + random() * 0.6, 1.6],
            random() * 6,
            grey(random, 0.75, 0.4),
          ),
        ),
      ),
    );
    yield;
  }
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
      base: "#4a463c",
      curb: "#6f7468",
      cobbles: [
        "#7b7f70",
        "#6f7468",
        "#5e6258",
        "#868a78",
        "#5a6a4a",
        "#70705e",
      ],
    }),
  );
  const parts = dressing(random, glowSpots);
  group.add(
    mesh(parts.solid, materials.solid, budget.shadows),
    mesh(parts.glow, materials.glow, false),
  );
  const frame = bellFrame(context, bellAt, ["#4b3428", "#5a4636"]);
  glowSpots.push(...frame.spots);
  const avoid: Circle[] = [
    { x: 0, z: 0, r: 20.4 },
    { x: bellAt.x, z: bellAt.z, r: 3.6 },
    { x: elderAt.x, z: elderAt.z, r: 5 },
  ];
  group.add(
    frame.group,
    elder(context, random, glowSpots),
    ...shrooms(context, random, glowSpots, avoid),
  );

  const recipes = shuffle(random, [
    ...Array.from({ length: maxSeats - 6 }, () => "hut" as const),
    ...Array.from({ length: 4 }, () => "mushroom" as const),
    "witch" as const,
    "witch" as const,
  ]);
  const homes = recipes.map((kind) =>
    makeHome(context, random, (home) =>
      kind === "hut"
        ? roundHut(home, random, {
            walls: ["#b9a888", "#a8987a", "#c4b494"],
            thatch: ["#a08a4e", "#8f7a44", "#b09a5a"],
            path,
          })
        : kind === "mushroom"
          ? mushroomHouse(home, random, {
              caps: ["#8c5a3c", "#3f7a6e", "#7a4f8c", "#b8423a"],
              stem: "#e6dcc4",
              spots: "#f4ecd8",
              path,
            })
          : witchHouse(home, random, path),
    ),
  );
  const fillers = makeFillers(
    context,
    random,
    shuffle(random, [
      glowShrooms(rune),
      cauldron("#b6ff7a"),
      tent(["#a89a78", "#8a7d60"]),
      woodpile("#4c6a3a"),
      barrels(),
      glowShrooms("#c8a0ff"),
      tent(["#8c6a4a", "#75583e"]),
    ]),
    maxSeats,
  );
  for (const { object } of [...homes, ...fillers]) group.add(object);
  group.add(detail);
  return {
    group,
    homes,
    fillers,
    glowSpots,
    bell: frame.bell,
    detail,
    nature: nature(context, rng(seed + 19), group, detail, avoid),
  };
}

export const definition: MapDefinition = {
  id: "glade",
  name: "Clairière des brumes",
  mood: {
    day: { fog: "#b9c9b4", near: 18, far: 125, sunIntensity: 2.1 },
    golden: { fog: "#cdb98c", near: 18, far: 125 },
    dusk: { fog: "#7a6a70", near: 15, far: 110 },
    night: { fog: "#0f1c22", near: 10, far: 92 },
    dawn: { fog: "#c4c8b8", near: 13, far: 100 },
    eclipse: { near: 11, far: 95 },
  },
  motes: { day: "#e8ffd0", night: rune },
  build,
};
