import type * as T from "three";
import type { Materials } from "../kit";
import type { Budget } from "../quality";
import type { Mood } from "../sky";

export const mapIds = ["hamlet", "island", "glade", "pass"] as const;
export type MapId = (typeof mapIds)[number];
export type MapChoice = { id: MapId; seed: number };

export type GlowSpot = { position: T.Vector3; size: number; color: string };
export type Circle = { x: number; z: number; r: number };

/** A dwelling modelled at the origin with its door on +Z. */
export type Home = {
  object: T.Object3D;
  /** Local positions, resolved to the world when the ring is arranged. */
  chimney?: T.Vector3;
  lamps: GlowSpot[];
};

/** A prop dropped into the gap between two homes when it is wide enough. */
export type Filler = { object: T.Object3D; width: number; lamps?: GlowSpot[] };

export type MapContext = { budget: Budget; materials: Materials; seed: number };

export type World = {
  group: T.Group;
  /** One per possible seat; only the first `count` are shown. */
  homes: Home[];
  fillers: Filler[];
  /** Lights that do not depend on the number of players. */
  glowSpots: GlowSpot[];
  bell: T.Object3D;
  /** Small dressing hidden as soon as the frame governor reduces detail. */
  detail: T.Group;
  /** Deferred batches, run one per frame once the square is on screen. */
  nature: Generator<void, void, void>;
  animate?: (time: number, night: number) => void;
};

export type MapDefinition = {
  id: MapId;
  name: string;
  mood: Mood;
  motes: { day: string; night: string };
  build(context: MapContext): World;
};
