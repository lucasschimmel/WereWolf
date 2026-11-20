import * as T from "three";
import type { FillerRecipe } from "./common";

const wood = "#7a5a3e";
const dark = "#5d4534";
const iron = "#2d2324";
const lantern = "#ffcf7a";

/** Props face +Z, toward the square, and stand between two homes. */
export const stall = (cloth: [string, string]): FillerRecipe => ({
  width: 3.4,
  build: (b) => {
    for (const x of [-1.2, 1.2])
      for (const z of [-0.6, 0.6]) b.box(dark, [0.12, 2.3, 0.12], [x, 1.15, z]);
    b.box(wood, [2.6, 0.12, 1.3], [0, 0.95, 0]);
    b.box("#6b4c34", [2.5, 0.85, 0.08], [0, 0.5, 0.62]);
    for (let index = 0; index < 6; index++)
      b.box(
        cloth[index % 2],
        [0.45, 0.06, 1.7],
        [-1.13 + index * 0.45, 2.3, 0],
        [0.25, 0, 0],
      );
    for (let index = 0; index < 9; index++)
      b.ball(["#e2873a", "#a9c24f", "#d9493f"][index % 3], 0.13, [
        -0.9 + (index % 5) * 0.42,
        1.12,
        -0.25 + Math.floor(index / 5) * 0.35,
      ]);
    return undefined;
  },
});

export const cart = (load: string): FillerRecipe => ({
  width: 3.2,
  build: (b) => {
    b.box(wood, [2.4, 0.14, 1.3], [0, 0.72, 0]);
    for (const z of [-0.65, 0.65]) b.box(dark, [2.4, 0.5, 0.08], [0, 1.0, z]);
    b.box(dark, [0.08, 0.5, 1.3], [-1.2, 1.0, 0]);
    for (const z of [-0.78, 0.78])
      b.cylinder(
        dark,
        [0.55, 0.55, 0.12],
        [-0.3, 0.55, z],
        [Math.PI / 2, 0, 0],
        9,
      );
    for (const z of [-0.4, 0.4])
      b.box(dark, [1.7, 0.08, 0.08], [1.9, 0.5, z], [0, 0, -0.22]);
    b.ball(load, [1.15, 0.6, 0.62], [-0.05, 1.25, 0]);
    b.ball(load, [0.6, 0.4, 0.5], [0.55, 1.35, 0.1]);
    return undefined;
  },
});

export const haystacks = (straw: [string, string]): FillerRecipe => ({
  width: 2.6,
  build: (b) => {
    b.cylinder(
      straw[0],
      [0.55, 0.55, 1.1],
      [-0.55, 0.55, 0],
      [0, 0.3, Math.PI / 2],
      9,
    );
    b.cylinder(
      straw[1],
      [0.55, 0.55, 1.1],
      [0.62, 0.55, 0.15],
      [0, -0.4, Math.PI / 2],
      9,
    );
    b.cylinder(
      straw[0],
      [0.5, 0.5, 1.0],
      [0.05, 1.42, 0.05],
      [0, 1.2, Math.PI / 2],
      9,
    );
    b.box(dark, [0.07, 1.5, 0.07], [1.25, 0.75, -0.3], [0, 0, -0.25]);
    return undefined;
  },
});

export const bench = (snow?: string): FillerRecipe => ({
  width: 2.2,
  build: (b, glow) => {
    b.box(wood, [1.9, 0.1, 0.5], [0, 0.5, 0]);
    b.box(wood, [1.9, 0.45, 0.08], [0, 0.85, -0.24], [0.15, 0, 0]);
    for (const x of [-0.75, 0.75]) b.box(dark, [0.1, 0.5, 0.42], [x, 0.25, 0]);
    if (snow) b.box(snow, [1.8, 0.07, 0.44], [0, 0.58, 0]);
    b.box(iron, [0.12, 2.3, 0.12], [1.25, 1.15, -0.1]);
    b.box(iron, [0.32, 0.06, 0.32], [1.25, 2.52, -0.1]);
    glow.box(lantern, [0.24, 0.3, 0.24], [1.25, 2.33, -0.1]);
    return [{ position: new T.Vector3(1.25, 2.33, -0.1), size: 3 }];
  },
});

export const barrels = (snow?: string): FillerRecipe => ({
  width: 1.5,
  build: (b) => {
    b.cylinder("#7a5638", [0.32, 0.29, 0.85], [-0.3, 0.42, 0], undefined, 9);
    b.cylinder(
      snow ?? "#3d3330",
      [0.33, 0.33, 0.06],
      [-0.3, 0.86, 0],
      undefined,
      9,
    );
    b.cylinder("#6b4a32", [0.3, 0.27, 0.8], [0.4, 0.4, 0.25], undefined, 9);
    b.box("#9a7650", [0.6, 0.55, 0.6], [0.3, 0.27, -0.5], [0, 0.4, 0]);
    if (snow) b.box(snow, [0.62, 0.07, 0.62], [0.3, 0.58, -0.5], [0, 0.4, 0]);
    return undefined;
  },
});

export const signpost = (snow?: string): FillerRecipe => ({
  width: 1.1,
  build: (b, glow) => {
    b.box(dark, [0.14, 2.6, 0.14], [0, 1.3, 0]);
    b.box(wood, [1.0, 0.26, 0.06], [0.3, 2.0, 0.08], [0, 0.2, 0.06]);
    b.box(wood, [0.9, 0.24, 0.06], [-0.28, 1.62, 0.08], [0, -0.25, -0.05]);
    b.box(iron, [0.3, 0.06, 0.3], [0, 2.72, 0]);
    if (snow) b.box(snow, [0.34, 0.08, 0.34], [0, 2.79, 0]);
    glow.box(lantern, [0.22, 0.28, 0.22], [0, 2.52, 0]);
    return [{ position: new T.Vector3(0, 2.52, 0), size: 2.8 }];
  },
});

export const woodpile = (roof: string): FillerRecipe => ({
  width: 2.8,
  build: (b) => {
    for (const x of [-1.1, 1.1])
      b.box(dark, [0.14, 1.7, 0.14], [x, 0.85, -0.3]);
    for (const x of [-1.1, 1.1]) b.box(dark, [0.14, 1.3, 0.14], [x, 0.65, 0.5]);
    b.box(roof, [2.7, 0.12, 1.5], [0, 1.6, 0.1], [0.42, 0, 0]);
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 7; column++)
        b.cylinder(
          (row + column) % 2 ? "#8a6a4a" : "#a07c55",
          [0.13, 0.13, 0.9],
          [-0.82 + column * 0.27, 0.14 + row * 0.25, 0.05],
          [Math.PI / 2, 0, 0],
          6,
        );
    return undefined;
  },
});

export const planter = (petals: string[]): FillerRecipe => ({
  width: 2.2,
  build: (b) => {
    b.box("#8a8175", [1.9, 0.5, 0.8], [0, 0.25, 0]);
    b.box("#5a4a36", [1.7, 0.1, 0.6], [0, 0.5, 0]);
    for (let index = 0; index < 8; index++) {
      const x = -0.75 + (index % 4) * 0.5;
      const z = index < 4 ? -0.14 : 0.14;
      b.cone("#5e8a42", 0.12, 0.4, [x, 0.72, z], undefined, 4);
      b.ball(petals[index % petals.length], 0.12, [x, 0.95, z]);
    }
    return undefined;
  },
});

export const snowman: FillerRecipe = {
  width: 1.3,
  build: (b) => {
    b.ball("#f4f6fb", 0.6, [0, 0.5, 0], undefined, 1);
    b.ball("#eef1f8", 0.42, [0, 1.3, 0], undefined, 1);
    b.ball("#f4f6fb", 0.3, [0, 1.9, 0], undefined, 1);
    b.cone("#ef8d3c", 0.06, 0.3, [0, 1.9, 0.38], [Math.PI / 2, 0, 0], 4);
    b.cylinder(iron, [0.2, 0.2, 0.26], [0, 2.26, 0], undefined, 7);
    b.cylinder(iron, [0.3, 0.3, 0.04], [0, 2.14, 0], undefined, 7);
    for (const side of [-1, 1])
      b.box(dark, [0.7, 0.05, 0.05], [side * 0.7, 1.4, 0], [0, 0, side * 0.5]);
    b.box("#b8423a", [0.5, 0.12, 0.5], [0, 1.66, 0], [0, 0.4, 0]);
    return undefined;
  },
};

export const sled: FillerRecipe = {
  width: 2.4,
  build: (b) => {
    for (const z of [-0.4, 0.4]) {
      b.box(dark, [2.1, 0.08, 0.1], [0, 0.08, z]);
      b.box(dark, [0.4, 0.08, 0.1], [1.15, 0.2, z], [0, 0, 0.7]);
    }
    b.box(wood, [1.7, 0.08, 0.95], [-0.1, 0.4, 0]);
    for (const x of [-0.7, 0.5]) b.box(dark, [0.08, 0.3, 0.9], [x, 0.24, 0]);
    for (let index = 0; index < 5; index++)
      b.cylinder(
        index % 2 ? "#8a6a4a" : "#a07c55",
        [0.14, 0.14, 1.4],
        [-0.1, 0.58 + Math.floor(index / 3) * 0.26, -0.28 + (index % 3) * 0.28],
        [0, 0, Math.PI / 2],
        6,
      );
    b.box("#f4f6fb", [1.3, 0.08, 0.6], [-0.1, 1.0, 0]);
    return undefined;
  },
};

/** A clump of toadstools whose caps glow in the given colour. */
export const glowShrooms = (color: string): FillerRecipe => ({
  width: 1.7,
  build: (b, glow) => {
    const caps: [number, number, number, number][] = [
      [-0.4, 0.9, 0.1, 0.42],
      [0.3, 0.6, 0.3, 0.3],
      [0.1, 1.25, -0.3, 0.5],
      [-0.2, 0.4, 0.5, 0.22],
    ];
    for (const [x, y, z, size] of caps) {
      b.cylinder(
        "#d8cfb8",
        [size * 0.2, size * 0.28, y],
        [x, y / 2, z],
        undefined,
        5,
      );
      glow.cylinder(
        color,
        [size * 0.25, size, size * 0.55],
        [x, y + size * 0.2, z],
        undefined,
        7,
      );
    }
    b.ball("#5a5650", [0.5, 0.3, 0.4], [0.5, 0.15, -0.2]);
    return [{ position: new T.Vector3(0, 1.3, 0), size: 3.2, color }];
  },
});

export const cauldron = (brew: string): FillerRecipe => ({
  width: 1.6,
  build: (b, glow) => {
    for (let leg = 0; leg < 3; leg++) {
      const angle = leg * 2.094;
      b.box(
        dark,
        [0.09, 2.3, 0.09],
        [Math.sin(angle) * 0.55, 1.05, Math.cos(angle) * 0.55],
        [Math.cos(angle) * 0.42, 0, -Math.sin(angle) * 0.42],
      );
    }
    b.cylinder(iron, [0.48, 0.34, 0.55], [0, 0.72, 0], undefined, 8);
    glow.cylinder(brew, [0.42, 0.42, 0.05], [0, 0.99, 0], undefined, 8);
    glow.cone("#ff8a2e", 0.24, 0.36, [0, 0.24, 0], undefined, 5);
    b.cylinder(
      "#4a3426",
      [0.08, 0.08, 0.9],
      [0, 0.08, 0],
      [0, 0.6, Math.PI / 2],
      5,
    );
    return [{ position: new T.Vector3(0, 1.05, 0), size: 2.8, color: brew }];
  },
});

export const tent = (canvas: [string, string]): FillerRecipe => ({
  width: 3.2,
  build: (b, glow) => {
    b.prism(canvas[0], [2.6, 2.0, 2.8], [0, 0, 0], [0, Math.PI / 2, 0]);
    b.prism(canvas[1], [0.5, 1.5, 1.0], [0, 0, 1.2], [0, Math.PI / 2, 0]);
    for (const z of [-1.45, 1.45]) b.box(dark, [0.1, 2.3, 0.1], [0, 1.15, z]);
    glow.box(lantern, [0.2, 0.26, 0.2], [0.55, 1.5, 1.45]);
    b.box(iron, [0.26, 0.05, 0.26], [0.55, 1.66, 1.45]);
    return [{ position: new T.Vector3(0.55, 1.5, 1.5), size: 2.6 }];
  },
});
