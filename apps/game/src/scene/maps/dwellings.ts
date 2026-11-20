import * as T from "three";
import type { Builder } from "../kit";
import { doorPath, type HomeAnchors, type HomeParts, pick } from "./common";

const flowers = ["#e8584f", "#f2c14e", "#f6f1e7", "#c86fb0", "#ef8d3c"];
const pane = "#ffc46a";
const lantern = "#ffcf7a";

export type CottageStyle = {
  plasters: string[];
  roofs: string[];
  shutters: string[];
  timber: string;
  stone: string;
  path: string;
  /** Lays a white blanket over the roof and the sills. */
  snow?: string;
};

function windowFront(
  b: Builder,
  glow: Builder,
  random: () => number,
  style: CottageStyle,
  x: number,
  y: number,
  z: number,
  shutter: string,
) {
  const { timber } = style;
  b.box(timber, [0.95, 0.95, 0.1], [x, y, z + 0.04]);
  glow.box(pane, [0.72, 0.72, 0.1], [x, y, z + 0.07]);
  b.box(timber, [0.06, 0.72, 0.13], [x, y, z + 0.09]);
  b.box(timber, [0.72, 0.06, 0.13], [x, y, z + 0.09]);
  b.box(shutter, [0.34, 0.88, 0.05], [x - 0.66, y, z + 0.08], [0, 0.25, 0]);
  b.box(shutter, [0.34, 0.88, 0.05], [x + 0.66, y, z + 0.08], [0, -0.25, 0]);
  b.box("#6e5440", [1.05, 0.08, 0.24], [x, y - 0.52, z + 0.12]);
  if (style.snow)
    b.box(style.snow, [1.08, 0.07, 0.26], [x, y - 0.45, z + 0.12]);
  else if (random() > 0.35) {
    b.box("#5f4433", [0.86, 0.18, 0.24], [x, y - 0.66, z + 0.16]);
    for (let index = 0; index < 4; index++)
      b.ball(pick(random, flowers), 0.09, [
        x - 0.3 + index * 0.2,
        y - 0.52,
        z + 0.17,
      ]);
  }
}

function sideDressing(b: Builder, random: () => number, w: number, d: number) {
  const extra = random();
  if (extra < 0.35) {
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 4 - row; column++)
        b.cylinder(
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
    b.cylinder(
      "#7a5638",
      [0.3, 0.27, 0.8],
      [w / 2 + 0.55, 0.4, d * 0.25],
      undefined,
      9,
    );
    b.cylinder(
      "#3d3330",
      [0.31, 0.31, 0.06],
      [w / 2 + 0.55, 0.62, d * 0.25],
      undefined,
      9,
    );
    b.box(
      "#9a7650",
      [0.6, 0.55, 0.6],
      [w / 2 + 0.6, 0.27, d * 0.25 - 0.8],
      [0, 0.4, 0],
    );
  } else {
    for (let index = 0; index < 5; index++)
      b.box(
        "#8b6b4c",
        [0.08, 0.75, 0.08],
        [-w / 2 + index * (w / 4), 0.37, d / 2 + 1.5],
      );
    b.box("#8b6b4c", [w, 0.08, 0.06], [0, 0.55, d / 2 + 1.5]);
  }
}

/** Half-timbered cottage; the style turns it into a chalet or a sky house. */
export function cottage(
  parts: HomeParts,
  random: () => number,
  style: CottageStyle,
): HomeAnchors {
  const { high, highGlow, low, lowGlow } = parts;
  const { timber, stone } = style;
  const w = 3.6 + random() * 1.1;
  const d = 3.2 + random() * 0.8;
  const h = 2.5 + random() * 0.7;
  const r = 1.6 + random() * 0.8;
  const plaster = pick(random, style.plasters);
  const roofColor = pick(random, style.roofs);
  const shutter = pick(random, style.shutters);
  const base = 0.5 + h;
  const slope = Math.atan2(r, d / 2);
  const eaveZ = d / 2 + 0.4;
  const eaveY = base - 0.4 * Math.tan(slope);
  const length = Math.hypot(eaveZ, base + r - eaveY) + 0.12;
  const midY = 0.5 + h * 0.52;

  doorPath(parts, style.path, d);
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
    const z = (sz * (d + 0.02)) / 2;
    high.box(timber, [w + 0.04, 0.15, 0.07], [0, base - 0.05, z]);
    high.box(timber, [w + 0.04, 0.12, 0.07], [0, 0.5 + h * 0.18, z]);
  }
  high.prism(plaster, [w, r, d], [0, base, 0]);
  for (const side of [-1, 1]) {
    const y = (base + r + eaveY) / 2 + 0.06;
    high.box(
      roofColor,
      [w + 0.6, 0.16, length],
      [0, y, (side * eaveZ) / 2],
      [side * slope, 0, 0],
    );
    if (style.snow)
      high.box(
        style.snow,
        [w + 0.66, 0.14, length * 0.86],
        [0, y + 0.13, (side * eaveZ) / 2 - side * 0.12],
        [side * slope, 0, 0],
      );
  }
  high.box(
    style.snow ?? "#3a2c28",
    [w + 0.7, 0.2, 0.32],
    [0, base + r + (style.snow ? 0.16 : 0.06), 0],
  );
  const chimney: [number, number, number] = [
    w * 0.28,
    base + r * 0.55,
    -d * 0.2,
  ];
  const stack: [number, number, number] = [
    chimney[0],
    chimney[1] + 0.45,
    chimney[2],
  ];
  high.box(stone, [0.55, 1.7, 0.55], stack);
  high.box(
    style.snow ?? "#5d5650",
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
  highGlow.box(lantern, [0.18, 0.24, 0.18], [0.78, 2.25, d / 2 + 0.2]);
  high.box("#2d2324", [0.26, 0.06, 0.26], [0.78, 2.4, d / 2 + 0.2]);
  high.box("#2d2324", [0.05, 0.05, 0.25], [0.78, 2.45, d / 2 + 0.07]);

  for (const x of [-w * 0.32, w * 0.32])
    windowFront(high, highGlow, random, style, x, midY, d / 2, shutter);
  for (const side of [-1, 1]) {
    high.box(timber, [0.1, 0.85, 0.85], [(side * (w + 0.04)) / 2, midY, 0]);
    highGlow.box(pane, [0.1, 0.62, 0.62], [(side * (w + 0.1)) / 2, midY, 0]);
  }
  highGlow.box(pane, [0.42, 0.42, 0.08], [0, base + r * 0.36, d / 2 + 0.02]);
  high.box(timber, [0.55, 0.55, 0.06], [0, base + r * 0.36, d / 2 + 0.01]);
  sideDressing(high, random, w, d);

  low.box(plaster, [w, h + 0.5, d], [0, (h + 0.5) / 2, 0]);
  low.prism(
    style.snow ?? roofColor,
    [w + 0.5, r + 0.3, d + 0.8],
    [0, base - 0.3, 0],
  );
  low.box(stone, [0.55, 1.7, 0.55], stack);
  low.box(timber, [1.0, 1.7, 0.08], [0, 1.35, d / 2 + 0.02]);
  for (const x of [-w * 0.32, w * 0.32])
    lowGlow.box(pane, [0.72, 0.72, 0.1], [x, midY, d / 2 + 0.04]);
  lowGlow.box(lantern, [0.2, 0.26, 0.2], [0.78, 2.25, d / 2 + 0.2]);

  return {
    chimney: new T.Vector3(chimney[0], chimney[1] + 1.45, chimney[2]),
    lamps: [
      { position: new T.Vector3(0.78, 2.25, d / 2 + 0.25), size: 2.2 },
      { position: new T.Vector3(-w * 0.32, midY, d / 2 + 0.2), size: 2.6 },
      { position: new T.Vector3(w * 0.32, midY, d / 2 + 0.2), size: 2.6 },
    ],
  };
}

export type MushroomStyle = {
  caps: string[];
  stem: string;
  spots: string;
  path: string;
  snow?: string;
};

/** A plump toadstool with a round door, straight out of a fairy tale. */
export function mushroomHouse(
  parts: HomeParts,
  random: () => number,
  style: MushroomStyle,
): HomeAnchors {
  const { high, highGlow, low, lowGlow } = parts;
  const cap = pick(random, style.caps);
  const girth = 1.55 + random() * 0.3;
  const tall = 2.3 + random() * 0.5;
  const reach = girth + 1.5 + random() * 0.4;
  const front = girth * 0.96;

  doorPath(parts, style.path, front * 2);
  high.cylinder(
    style.stem,
    [girth, girth * 1.14, tall],
    [0, tall / 2, 0],
    undefined,
    9,
  );
  high.cylinder(
    "#cfc2a4",
    [reach * 0.72, girth * 0.98, 0.34],
    [0, tall + 0.1, 0],
    undefined,
    9,
  );
  high.cylinder(
    cap,
    [reach * 0.52, reach, 1.25],
    [0, tall + 0.86, 0],
    undefined,
    9,
  );
  high.cylinder(
    cap,
    [0.2, reach * 0.52, 0.72],
    [0, tall + 1.84, 0],
    undefined,
    9,
  );
  if (style.snow)
    high.cylinder(
      style.snow,
      [0.12, reach * 0.4, 0.5],
      [0, tall + 2.02, 0],
      undefined,
      9,
    );
  for (let index = 0; index < 7; index++) {
    const angle = index * 0.9 + random() * 0.4;
    const ring = index % 2 ? 0.78 : 0.45;
    const lift = index % 2 ? 0.92 : 1.82;
    high.ball(
      style.spots,
      [0.3, 0.12, 0.3],
      [
        Math.sin(angle) * reach * ring,
        tall + lift,
        Math.cos(angle) * reach * ring,
      ],
      [Math.cos(angle) * 0.75, 0, -Math.sin(angle) * 0.75],
    );
  }
  high.box("#5a3f2c", [1.0, 1.55, 0.2], [0, 0.78, front]);
  high.cylinder(
    "#5a3f2c",
    [0.5, 0.5, 0.2],
    [0, 1.55, front],
    [Math.PI / 2, 0, 0],
    10,
  );
  high.box("#7a5638", [0.76, 1.42, 0.22], [0, 0.72, front + 0.03]);
  high.ball("#d8b46a", 0.05, [0.24, 0.8, front + 0.16]);
  high.box("#8a8175", [1.2, 0.2, 0.5], [0, 0.1, front + 0.35]);
  for (const side of [-1, 1]) {
    const angle = side * 0.95;
    const x = Math.sin(angle) * girth * 1.02;
    const z = Math.cos(angle) * girth * 1.02;
    high.cylinder(
      "#5a3f2c",
      [0.38, 0.38, 0.12],
      [x, tall * 0.56, z],
      [Math.PI / 2, 0, -angle],
      8,
    );
    highGlow.cylinder(
      pane,
      [0.28, 0.28, 0.14],
      [x, tall * 0.56, z],
      [Math.PI / 2, 0, -angle],
      8,
    );
  }
  highGlow.box(lantern, [0.18, 0.24, 0.18], [0.72, 1.75, front + 0.2]);
  high.box("#2d2324", [0.26, 0.06, 0.26], [0.72, 1.9, front + 0.2]);
  const pipe = new T.Vector3(-reach * 0.34, tall + 2.0, -reach * 0.2);
  high.cylinder(
    "#6f685f",
    [0.17, 0.2, 1.1],
    [pipe.x, pipe.y - 0.5, pipe.z],
    undefined,
    6,
  );

  low.cylinder(
    style.stem,
    [girth, girth * 1.14, tall],
    [0, tall / 2, 0],
    undefined,
    6,
  );
  low.cylinder(
    style.snow ?? cap,
    [0.3, reach, 1.9],
    [0, tall + 1.1, 0],
    undefined,
    7,
  );
  lowGlow.box(pane, [0.5, 0.5, 0.1], [0.9, tall * 0.56, front * 0.86]);
  lowGlow.box(lantern, [0.2, 0.26, 0.2], [0.72, 1.75, front + 0.2]);

  return {
    chimney: pipe,
    lamps: [
      { position: new T.Vector3(0.72, 1.75, front + 0.25), size: 2.2 },
      {
        position: new T.Vector3(
          Math.sin(0.95) * girth,
          tall * 0.56,
          Math.cos(0.95) * girth + 0.2,
        ),
        size: 2.4,
      },
    ],
  };
}

/** A crooked hat for a roof and a sickly green light behind the panes. */
export function witchHouse(
  parts: HomeParts,
  random: () => number,
  path: string,
  snow?: string,
): HomeAnchors {
  const { high, highGlow, low, lowGlow } = parts;
  const felt = pick(random, ["#3b2f4d", "#2f2a3f", "#43314a"]);
  const band = pick(random, ["#7a3f8c", "#8c5a2f", "#3f7a5e"]);
  const wall = "#6b5d57";
  const green = "#b6ff7a";
  const girth = 1.9;
  const tall = 2.7;
  const front = girth * 0.9;
  const lean = random() > 0.5 ? 1 : -1;

  doorPath(parts, path, front * 2);
  high.cylinder(
    "#5d5650",
    [girth + 0.2, girth + 0.3, 0.45],
    [0, 0.22, 0],
    undefined,
    8,
  );
  high.cylinder(
    wall,
    [girth * 0.94, girth, tall],
    [0, 0.45 + tall / 2, 0],
    undefined,
    8,
  );
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    high.box(
      "#3a2c28",
      [0.16, tall, 0.16],
      [
        Math.sin(angle) * girth * 1.0,
        0.45 + tall / 2,
        Math.cos(angle) * girth * 1.0,
      ],
      [0, angle, 0],
    );
  }
  const brim = 0.45 + tall;
  high.cylinder(
    felt,
    [girth + 1.2, girth + 1.45, 0.2],
    [0, brim + 0.1, 0],
    undefined,
    10,
  );
  if (snow)
    high.cylinder(
      snow,
      [girth + 0.5, girth + 1.3, 0.14],
      [0, brim + 0.26, 0],
      undefined,
      10,
    );
  high.cylinder(
    felt,
    [1.35, girth + 0.25, 1.5],
    [0, brim + 0.95, 0],
    undefined,
    8,
  );
  high.cylinder(
    band,
    [girth + 0.12, girth + 0.3, 0.28],
    [0, brim + 0.36, 0],
    undefined,
    8,
  );
  highGlow.box("#ffd76a", [0.42, 0.34, 0.12], [0, brim + 0.38, girth + 0.2]);
  high.cylinder(
    felt,
    [0.8, 1.35, 1.3],
    [lean * 0.22, brim + 2.3, 0],
    [0, 0, -lean * 0.16],
    7,
  );
  high.cylinder(
    felt,
    [0.36, 0.8, 1.2],
    [lean * 0.62, brim + 3.4, 0],
    [0, 0, -lean * 0.42],
    6,
  );
  high.cone(
    felt,
    0.36,
    1.1,
    [lean * 1.28, brim + 4.1, 0],
    [0, 0, -lean * 1.05],
    5,
  );

  high.box("#2d2324", [1.0, 1.7, 0.2], [0, 1.3, front]);
  high.box("#4d3a56", [0.78, 1.52, 0.22], [0, 1.22, front + 0.03]);
  high.ball("#d8b46a", 0.05, [0.25, 1.25, front + 0.16]);
  high.box("#5d5650", [1.3, 0.25, 0.6], [0, 0.12, front + 0.42]);
  for (const side of [-1, 1]) {
    const angle = side * 0.9;
    const x = Math.sin(angle) * girth * 0.97;
    const z = Math.cos(angle) * girth * 0.97;
    high.box("#2d2324", [0.7, 0.9, 0.12], [x, 2.0, z], [0, angle, 0]);
    highGlow.box(green, [0.5, 0.7, 0.14], [x, 2.0, z], [0, angle, 0]);
  }
  high.cylinder(
    "#2a2422",
    [0.5, 0.36, 0.5],
    [-girth - 0.9, 0.42, 0.9],
    undefined,
    8,
  );
  highGlow.cylinder(
    green,
    [0.42, 0.42, 0.06],
    [-girth - 0.9, 0.66, 0.9],
    undefined,
    8,
  );
  for (let leg = 0; leg < 3; leg++)
    high.box(
      "#2a2422",
      [0.07, 0.3, 0.07],
      [
        -girth - 0.9 + Math.sin(leg * 2.1) * 0.3,
        0.12,
        0.9 + Math.cos(leg * 2.1) * 0.3,
      ],
    );

  low.cylinder(
    wall,
    [girth * 0.94, girth, tall + 0.45],
    [0, (tall + 0.45) / 2, 0],
    undefined,
    6,
  );
  low.cylinder(
    snow ?? felt,
    [girth + 1.2, girth + 1.45, 0.24],
    [0, brim + 0.1, 0],
    undefined,
    8,
  );
  low.cylinder(
    felt,
    [0.5, girth + 0.25, 3.4],
    [lean * 0.25, brim + 1.9, 0],
    [0, 0, -lean * 0.14],
    6,
  );
  lowGlow.box(
    green,
    [0.5, 0.7, 0.14],
    [Math.sin(0.9) * girth, 2.0, Math.cos(0.9) * girth],
  );

  return {
    lamps: [
      {
        position: new T.Vector3(
          Math.sin(0.9) * girth,
          2.0,
          Math.cos(0.9) * girth + 0.2,
        ),
        size: 2.4,
      },
      {
        position: new T.Vector3(
          -Math.sin(0.9) * girth,
          2.0,
          Math.cos(0.9) * girth + 0.2,
        ),
        size: 2.4,
      },
      { position: new T.Vector3(-girth - 0.9, 0.8, 0.9), size: 2.0 },
    ],
  };
}

export type HutStyle = { walls: string[]; thatch: string[]; path: string };

/** A round wattle hut under a deep thatched cone. */
export function roundHut(
  parts: HomeParts,
  random: () => number,
  style: HutStyle,
): HomeAnchors {
  const { high, highGlow, low, lowGlow } = parts;
  const wall = pick(random, style.walls);
  const thatch = pick(random, style.thatch);
  const girth = 1.75 + random() * 0.35;
  const tall = 1.9 + random() * 0.3;
  const roof = 2.5 + random() * 0.7;
  const front = girth * 0.93;

  doorPath(parts, style.path, front * 2);
  high.cylinder(
    "#6f685f",
    [girth + 0.15, girth + 0.25, 0.3],
    [0, 0.15, 0],
    undefined,
    9,
  );
  high.cylinder(
    wall,
    [girth, girth, tall],
    [0, 0.3 + tall / 2, 0],
    undefined,
    9,
  );
  for (let index = 0; index < 9; index++) {
    const angle = (index / 9) * Math.PI * 2;
    high.box(
      "#4b3428",
      [0.14, tall, 0.14],
      [Math.sin(angle) * girth, 0.3 + tall / 2, Math.cos(angle) * girth],
      [0, angle, 0],
    );
  }
  const eave = 0.3 + tall;
  high.cone(
    thatch,
    girth + 0.95,
    roof,
    [0, eave + roof / 2 - 0.25, 0],
    undefined,
    9,
  );
  high.cone(
    "#8a7140",
    girth + 0.5,
    roof * 0.7,
    [0, eave + roof * 0.75, 0],
    [0, 0.35, 0],
    9,
  );
  high.cylinder(
    "#5a4636",
    [0.16, 0.2, 0.5],
    [0, eave + roof - 0.1, 0],
    undefined,
    5,
  );
  high.box("#4b3428", [1.0, 1.6, 0.2], [0, 1.05, front]);
  high.box("#7a5638", [0.76, 1.42, 0.22], [0, 0.98, front + 0.03]);
  high.box("#6f685f", [1.2, 0.2, 0.5], [0, 0.1, front + 0.35]);
  const angle = 0.95;
  const x = Math.sin(angle) * girth * 0.98;
  const z = Math.cos(angle) * girth * 0.98;
  high.box("#4b3428", [0.7, 0.7, 0.12], [x, 1.35, z], [0, angle, 0]);
  highGlow.box(pane, [0.5, 0.5, 0.14], [x, 1.35, z], [0, angle, 0]);
  highGlow.box(lantern, [0.18, 0.24, 0.18], [-0.75, 1.75, front + 0.2]);
  high.box("#2d2324", [0.26, 0.06, 0.26], [-0.75, 1.9, front + 0.2]);
  for (let index = 0; index < 3; index++)
    high.cylinder(
      "#8a6a4a",
      [0.13, 0.13, 0.9],
      [-girth - 0.5, 0.14 + index * 0.24, -0.3 + index * 0.12],
      [Math.PI / 2, 0, 0],
      6,
    );

  low.cylinder(
    wall,
    [girth, girth, tall + 0.3],
    [0, (tall + 0.3) / 2, 0],
    undefined,
    6,
  );
  low.cone(
    thatch,
    girth + 0.95,
    roof,
    [0, eave + roof / 2 - 0.25, 0],
    undefined,
    7,
  );
  lowGlow.box(pane, [0.5, 0.5, 0.14], [x, 1.35, z], [0, angle, 0]);
  lowGlow.box(lantern, [0.2, 0.26, 0.2], [-0.75, 1.75, front + 0.2]);

  return {
    chimney: new T.Vector3(0, eave + roof + 0.2, 0),
    lamps: [
      { position: new T.Vector3(-0.75, 1.75, front + 0.25), size: 2.2 },
      { position: new T.Vector3(x, 1.35, z + 0.2), size: 2.4 },
    ],
  };
}
