import * as T from "three";
import type { GlowSpot, World } from "./types";

export const minSeats = 8;
export const maxSeats = 15;
/** Arc a home needs along the ring before a prop fits beside it. */
const homeChord = 6.3;

const clampSeats = (players: number) =>
  T.MathUtils.clamp(players, minSeats, maxSeats);

/** The ring widens a little with every extra seat so homes never collide. */
export const ringRadius = (players: number) =>
  15 + (clampSeats(players) - minSeats) * 0.25;

export type Arrangement = { glowSpots: GlowSpot[]; chimneys: T.Vector3[] };

function settle(object: T.Object3D, angle: number, radius: number, scale = 1) {
  object.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  object.rotation.y = angle + Math.PI;
  object.scale.setScalar(scale);
  object.updateMatrix();
  object.matrixWorldNeedsUpdate = true;
}

/**
 * Lays one home per player around the square. Homes sit between two seats so
 * the southern lane stays open, and props fill whatever room is left.
 */
export function arrange(world: World, players: number): Arrangement {
  const count = clampSeats(players);
  const radius = ringRadius(count);
  const step = (Math.PI * 2) / count;
  const glowSpots = [...world.glowSpots];
  const chimneys: T.Vector3[] = [];
  const resolve = (lamps: GlowSpot[] | undefined, object: T.Object3D) => {
    for (const lamp of lamps ?? [])
      glowSpots.push({
        ...lamp,
        position: lamp.position.clone().applyMatrix4(object.matrix),
      });
  };
  for (const [index, home] of world.homes.entries()) {
    const { object } = home;
    object.visible = index < count;
    if (!object.visible) continue;
    const stagger = count <= 12 && index % 2 ? 0.8 : 0;
    settle(object, (index + 0.5) * step, radius + stagger);
    resolve(home.lamps, object);
    if (home.chimney)
      chimneys.push(home.chimney.clone().applyMatrix4(object.matrix));
  }
  const gap = step * radius - homeChord;
  for (const [index, filler] of world.fillers.entries()) {
    const { object, width } = filler;
    // Gap 0 faces south and is kept clear for the lane into the square.
    object.visible = index > 0 && index < count && width * 0.72 <= gap;
    if (!object.visible) continue;
    settle(object, index * step, radius + 0.4, Math.min(1, gap / width));
    resolve(filler.lamps, object);
  }
  return { glowSpots, chimneys };
}
