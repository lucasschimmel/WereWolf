import type { Profession } from "../../shared/rules";
import type { Builder } from "./kit";

/**
 * One small prop per profession, modelled at the origin on the ground, about
 * a metre wide. `b` takes lit parts, `g` takes parts that glow at night.
 */
type Trade = (b: Builder, g: Builder) => void;

const wood = "#6b4a2f";
const darkWood = "#4a3324";
const iron = "#3d3a3a";
const straw = "#d9b45a";
const quarter = Math.PI / 2;

function posts(b: Builder, height: number, span: number, color = darkWood) {
  for (const x of [-span / 2, span / 2])
    b.box(color, [0.1, height, 0.1], [x, height / 2, 0]);
  b.box(color, [span + 0.12, 0.08, 0.08], [0, height, 0]);
}

export const trades: Record<Profession, Trade> = {
  forester(b) {
    for (const [x, y] of [
      [-0.2, 0.13],
      [0.08, 0.13],
      [-0.06, 0.36],
    ])
      b.cylinder("#7a5636", [0.13, 0.13, 0.9], [x, y, 0], [quarter, 0, 0], 7);
    b.cylinder("#8a6a48", [0.2, 0.22, 0.4], [0.6, 0.2, 0.1], undefined, 8);
    b.box(darkWood, [0.05, 0.5, 0.05], [0.6, 0.6, 0.1], [0, 0, 0.35]);
    b.box("#9aa0a6", [0.2, 0.1, 0.03], [0.68, 0.82, 0.1], [0, 0, 0.35]);
  },
  lanterner(b, g) {
    posts(b, 1.5, 1.1);
    for (const [x, color] of [
      [-0.35, "#ffb347"],
      [0, "#ff7a6b"],
      [0.35, "#8fd0ff"],
    ] as const) {
      b.box(iron, [0.02, 0.18, 0.02], [x, 1.4, 0]);
      b.box(iron, [0.2, 0.04, 0.2], [x, 1.3, 0]);
      g.box(color, [0.15, 0.2, 0.15], [x, 1.18, 0]);
      b.box(iron, [0.2, 0.03, 0.2], [x, 1.07, 0]);
    }
  },
  herbalist(b) {
    posts(b, 1.4, 1.1);
    for (const [index, color] of [
      "#6f9a4a",
      "#9a7ab8",
      "#a7b55a",
      "#5f8a5a",
    ].entries())
      b.cone(color, 0.08, 0.3, [-0.4 + index * 0.27, 1.22, 0], [Math.PI, 0, 0]);
    b.box("#5a4030", [1, 0.16, 0.5], [0, 0.08, 0.55]);
    for (let index = 0; index < 4; index++)
      b.ball("#6aa055", 0.1, [-0.36 + index * 0.24, 0.22, 0.55]);
  },
  fisher(b) {
    b.ball("#5d4230", [0.42, 0.22, 1.05], [0, 0.16, 0], undefined, 1);
    b.box("#3f2e22", [0.08, 0.04, 2], [0, 0.38, 0]);
    b.box("#8a8f7a", [0.6, 0.5, 0.04], [0.75, 0.25, -0.2], [0, 0.4, 0.1]);
    b.cylinder("#9b7c4f", [0.16, 0.2, 0.36], [0.8, 0.18, 0.45], undefined, 8);
  },
  shepherd(b) {
    for (const x of [-0.6, 0, 0.6])
      b.box(wood, [0.08, 0.6, 0.08], [x, 0.3, -0.35]);
    for (const y of [0.25, 0.48]) b.box(wood, [1.3, 0.05, 0.04], [0, y, -0.35]);
    b.ball("#efe9dc", [0.32, 0.24, 0.22], [0, 0.4, 0.15], undefined, 1);
    b.ball("#2f2a28", 0.11, [0.32, 0.48, 0.15]);
    for (const x of [-0.16, 0.16])
      for (const z of [0.05, 0.25])
        b.box("#2f2a28", [0.05, 0.22, 0.05], [x, 0.11, z]);
  },
  ringer(b) {
    posts(b, 1.5, 0.9, wood);
    b.box(wood, [1.1, 0.06, 0.4], [0, 1.58, 0], [0, 0, 0]);
    b.cylinder("#b8863b", [0.1, 0.26, 0.4], [0, 1.18, 0], undefined, 10);
    b.ball("#8a6428", 0.05, [0, 0.95, 0]);
  },
  smith(b, g) {
    b.cylinder("#6b4a34", [0.22, 0.25, 0.45], [0, 0.22, 0], undefined, 8);
    b.box(iron, [0.22, 0.1, 0.16], [0, 0.5, 0]);
    b.box(iron, [0.5, 0.12, 0.22], [0, 0.61, 0]);
    b.cone(iron, 0.1, 0.24, [0.34, 0.62, 0], [0, 0, -quarter], 6);
    b.cylinder("#4a4542", [0.3, 0.22, 0.4], [0.75, 0.2, 0.2], undefined, 8);
    g.ball("#ff7a2e", [0.24, 0.06, 0.24], [0.75, 0.41, 0.2]);
  },
  miller(b) {
    b.cylinder("#9a948a", [0.42, 0.42, 0.16], [-0.3, 0.42, 0], [quarter, 0, 0]);
    b.cylinder("#5f5a54", [0.08, 0.08, 0.18], [-0.3, 0.42, 0], [quarter, 0, 0]);
    for (const [x, z] of [
      [0.35, 0.1],
      [0.62, -0.05],
      [0.48, 0.32],
    ])
      b.ball("#d8c9a2", [0.18, 0.24, 0.16], [x, 0.22, z], undefined, 1);
  },
  baker(b, g) {
    b.ball("#a89a88", [0.6, 0.55, 0.6], [0, 0, 0], undefined, 1);
    b.box("#8d8070", [0.36, 0.3, 0.1], [0, 0.17, 0.55]);
    g.box("#ff9a45", [0.26, 0.2, 0.04], [0, 0.15, 0.6]);
    b.cylinder("#7d7064", [0.08, 0.1, 0.4], [0.25, 0.6, -0.2], undefined, 6);
    b.ball("#c98a45", [0.16, 0.08, 0.1], [0.5, 0.06, 0.55]);
  },
  carpenter(b) {
    b.box("#9a7048", [1.1, 0.08, 0.45], [0, 0.7, 0]);
    for (const x of [-0.45, 0.45])
      for (const z of [-0.16, 0.16])
        b.box(darkWood, [0.07, 0.66, 0.07], [x, 0.33, z]);
    b.box("#c79a62", [0.4, 0.06, 0.12], [0.1, 0.77, 0.05]);
    for (let index = 0; index < 4; index++)
      b.box(
        index % 2 ? "#b58a5a" : "#a37a4c",
        [0.16, 0.05, 1.1],
        [0.85, 0.03 + index * 0.055, 0],
      );
  },
  seamstress(b) {
    posts(b, 1.5, 1.4);
    for (const [index, color] of [
      "#c45a5a",
      "#e8d9b8",
      "#5a7ac4",
      "#7fae6a",
    ].entries())
      b.box(color, [0.26, 0.4, 0.02], [-0.48 + index * 0.32, 1.28, 0]);
  },
  potter(b) {
    for (const [x, z, scale, color] of [
      [-0.3, 0, 1, "#b8705a"],
      [0.12, 0.15, 0.75, "#a65f48"],
      [0.42, -0.1, 0.9, "#c88a6a"],
      [-0.05, -0.3, 0.6, "#9c8a78"],
    ] as const) {
      b.ball(
        color,
        [0.2 * scale, 0.26 * scale, 0.2 * scale],
        [x, 0.26 * scale, z],
        undefined,
        1,
      );
      b.cylinder(
        color,
        [0.1 * scale, 0.12 * scale, 0.1 * scale],
        [x, 0.52 * scale, z],
        undefined,
        8,
      );
    }
  },
  beekeeper(b) {
    b.box(darkWood, [1.2, 0.08, 0.45], [0, 0.4, 0]);
    for (const x of [-0.5, 0.5]) b.box(darkWood, [0.08, 0.4, 0.4], [x, 0.2, 0]);
    for (const x of [-0.3, 0.3]) {
      b.cylinder(straw, [0.2, 0.26, 0.24], [x, 0.56, 0], undefined, 9);
      b.cylinder(straw, [0.08, 0.2, 0.18], [x, 0.77, 0], undefined, 9);
      b.box("#3a2a1c", [0.08, 0.06, 0.02], [x, 0.5, 0.25]);
    }
  },
  scribe(b) {
    b.box(darkWood, [0.12, 1, 0.12], [0, 0.5, 0]);
    b.box(darkWood, [0.4, 0.06, 0.3], [0, 0.03, 0]);
    b.box("#7a5232", [0.6, 0.05, 0.42], [0, 1.05, 0], [-0.35, 0, 0]);
    b.box("#efe6d2", [0.5, 0.04, 0.34], [0, 1.09, 0.01], [-0.35, 0, 0]);
    b.cylinder(
      "#2a2a40",
      [0.04, 0.05, 0.08],
      [0.24, 1.16, -0.12],
      undefined,
      6,
    );
    b.box("#f2f0ea", [0.02, 0.2, 0.02], [0.24, 1.28, -0.12], [0, 0, 0.3]);
  },
  cheesemaker(b) {
    b.box(wood, [1, 0.06, 0.45], [0, 0.55, 0]);
    b.box(wood, [1, 0.06, 0.45], [0, 0.05, 0]);
    for (const x of [-0.46, 0.46])
      b.box(darkWood, [0.06, 0.6, 0.4], [x, 0.3, 0]);
    for (const [x, y, color] of [
      [-0.2, 0.2, "#f0c95a"],
      [0.2, 0.2, "#e8b440"],
      [0, 0.68, "#f3d575"],
    ] as const)
      b.cylinder(color, [0.2, 0.2, 0.18], [x, y, 0], undefined, 12);
  },
};
