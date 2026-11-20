import type { Profession } from "../../shared/rules";
import { type Builder, pole } from "./kit";

/**
 * Hats, clothes and hand items for the professions added after the first
 * eight looks. Coordinates follow the puppet parts: the face looks toward -Z,
 * the head sits on the neck, and an arm hangs from its shoulder with the hand
 * at y = -0.5. Hand items stay below the shoulder or lean away from the body.
 */
type Colors = { outfit: string; trim: string; hair: string };
type Outfit = {
  head(b: Builder, colors: Colors): void;
  torso?(b: Builder, colors: Colors): void;
  /** `side` is -1 for the left arm and 1 for the right arm. */
  hand?(b: Builder, side: number): void;
};

const white = "#f3eee2";
const wood = "#6b4c34";

/** The long skirt or robe some looks wear over the legs. */
function skirt(b: Builder, color: string) {
  b.cylinder(color, [0.25, 0.42, 0.52], [0, -0.1, 0], undefined, 10);
}

/** A bib apron on the front of the torso. */
function apron(b: Builder, color: string) {
  b.box(color, [0.4, 0.56, 0.03], [0, 0.22, -0.27]);
  b.box(color, [0.03, 0.2, 0.02], [-0.12, 0.55, -0.2], [0.5, 0, 0]);
  b.box(color, [0.03, 0.2, 0.02], [0.12, 0.55, -0.2], [0.5, 0, 0]);
}

export const outfits: Partial<Record<Profession, Outfit>> = {
  baker: {
    head(b, { trim }) {
      b.cylinder(trim, [0.25, 0.25, 0.06], [0, 0.46, 0], undefined, 10);
      b.cylinder(white, [0.24, 0.22, 0.26], [0, 0.6, 0], undefined, 10);
      b.ball(white, [0.31, 0.15, 0.31], [0, 0.76, 0], undefined, 1);
    },
    torso(b) {
      apron(b, white);
    },
    hand(b, side) {
      if (side < 0) return;
      // A golden loaf carried under the hand.
      b.ball("#c98a45", [0.09, 0.08, 0.17], [0, -0.6, -0.06], undefined, 1);
    },
  },
  carpenter: {
    head(b, { trim }) {
      b.cylinder("#4a3a2e", [0.27, 0.28, 0.1], [0, 0.47, 0.01], undefined, 10);
      b.box("#4a3a2e", [0.3, 0.03, 0.18], [0, 0.44, -0.24]);
      b.box(trim, [0.02, 0.02, 0.16], [0.27, 0.32, 0.02], [0.3, 0, 0]);
    },
    torso(b) {
      // Pale leather, so the apron reads against the oak-brown coat.
      apron(b, "#c8a274");
      b.box("#4a3324", [0.42, 0.08, 0.06], [0, 0.07, -0.28]);
      b.box("#c9a24a", [0.03, 0.12, 0.03], [0.14, 0.14, -0.31]);
    },
    hand(b, side) {
      if (side < 0) return;
      // A hand saw hanging blade down, outside the leg.
      b.box(wood, [0.05, 0.12, 0.08], [side * 0.03, -0.55, -0.02]);
      b.box("#b8bcc4", [0.015, 0.36, 0.13], [side * 0.03, -0.79, 0.01]);
    },
  },
  seamstress: {
    head(b, { hair, trim }) {
      b.ball(hair, 0.13, [0, 0.43, 0.22]);
      b.cylinder(trim, [0.27, 0.27, 0.05], [0, 0.4, 0.02], undefined, 10);
      for (const x of [-0.04, 0.05])
        b.box("#d9d4cc", [0.012, 0.012, 0.16], [x, 0.48, 0.26], [0.6, 0, 0]);
    },
    torso(b, { outfit }) {
      skirt(b, outfit);
      // A tape measure hanging around the neck.
      for (const x of [-0.09, 0.09])
        b.box("#e8c96a", [0.035, 0.36, 0.01], [x, 0.43, -0.24]);
    },
    hand(b, side) {
      if (side < 0) return;
      // A spool of thread held in the fist.
      b.cylinder("#c9a77a", [0.05, 0.05, 0.03], [0, -0.5, -0.1], undefined, 8);
      b.cylinder(
        "#c45a5a",
        [0.042, 0.042, 0.1],
        [0, -0.57, -0.1],
        undefined,
        8,
      );
      b.cylinder("#c9a77a", [0.05, 0.05, 0.03], [0, -0.64, -0.1], undefined, 8);
    },
  },
  potter: {
    head(b, { trim }) {
      b.ball(trim, [0.29, 0.17, 0.29], [0, 0.42, 0.02], undefined, 1);
      b.ball(trim, 0.06, [0, 0.36, 0.29]);
      b.box(trim, [0.04, 0.12, 0.02], [0.04, 0.27, 0.3], [0, 0, 0.3]);
    },
    torso(b) {
      apron(b, "#a0705a");
      for (const [x, y] of [
        [-0.08, 0.1],
        [0.1, 0.3],
        [0.02, 0.4],
      ])
        b.ball("#8a5a44", [0.05, 0.03, 0.01], [x, y, -0.29]);
    },
    hand(b, side) {
      if (side < 0) return;
      // A small jug held by its neck.
      b.cylinder(
        "#b8705a",
        [0.04, 0.05, 0.08],
        [0, -0.58, -0.02],
        undefined,
        8,
      );
      b.ball("#b8705a", [0.1, 0.11, 0.1], [0, -0.7, -0.02], undefined, 1);
    },
  },
  beekeeper: {
    head(b) {
      b.cylinder("#e8dcb0", [0.42, 0.42, 0.03], [0, 0.47, 0], undefined, 14);
      b.cylinder("#e0d29e", [0.2, 0.23, 0.17], [0, 0.56, 0], undefined, 10);
      b.cylinder("#cfd2c8", [0.235, 0.235, 0.05], [0, 0.5, 0], undefined, 10);
    },
    hand(b, side) {
      if (side < 0) return;
      // A bee smoker: a tin can below the fist, its nozzle forward.
      b.cylinder(
        "#9aa0a6",
        [0.07, 0.07, 0.18],
        [0, -0.68, -0.02],
        undefined,
        8,
      );
      b.cone("#7d828c", 0.05, 0.1, [0, -0.55, -0.1], [-0.9, 0, 0], 6);
      b.ball("#d8d4cc", 0.04, [0, -0.5, -0.17]);
    },
  },
  scribe: {
    head(b, { trim }) {
      b.cylinder("#2a2840", [0.3, 0.27, 0.07], [0, 0.47, 0.03], undefined, 12);
      b.ball(trim, 0.04, [0, 0.52, 0.03]);
    },
    torso(b, { outfit }) {
      skirt(b, outfit);
    },
    hand(b, side) {
      if (side > 0) {
        // A quill held point down, its feather below the shoulder.
        pole(
          b,
          "#f2f0ea",
          0.012,
          [0, -0.66, -0.03],
          [side * 0.04, -0.36, -0.15],
        );
        b.cone(
          "#f2f0ea",
          0.035,
          0.14,
          [side * 0.04, -0.42, -0.15],
          undefined,
          4,
        );
      }
      // A book carried against the outer side of the hand.
      else b.box("#6b2f2f", [0.06, 0.26, 0.2], [side * 0.08, -0.56, -0.02]);
    },
  },
  cheesemaker: {
    head(b, { hair }) {
      b.cylinder(white, [0.26, 0.27, 0.12], [0, 0.47, 0.01], undefined, 10);
      for (const side of [-1, 1])
        b.ball(
          hair,
          [0.07, 0.03, 0.03],
          [side * 0.06, 0.17, -0.265],
          [0, 0, side * 0.3],
        );
    },
    torso(b) {
      apron(b, "#dfe6ea");
    },
    hand(b, side) {
      if (side < 0) return;
      // A wedge of cheese held flat under the hand.
      b.cone("#f0c95a", 0.12, 0.08, [0, -0.6, -0.06], [0, 0.4, 0], 3);
    },
  },
};
