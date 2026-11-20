import {
  type MapChoice,
  type MapDefinition,
  type MapId,
  mapIds,
} from "./types";

export type { MapChoice, MapId };
export { mapIds };

/** Each map is its own chunk, fetched only when a room actually plays on it. */
const loaders: Record<MapId, () => Promise<{ definition: MapDefinition }>> = {
  hamlet: () => import("./hamlet"),
  island: () => import("./island"),
  glade: () => import("./glade"),
  pass: () => import("./pass"),
};

export const loadMap = async (id: MapId) => (await loaders[id]()).definition;

const isMapId = (value: string | null): value is MapId =>
  mapIds.includes(value as MapId);

/**
 * Draws a map and a seed from a room code. Every player of a room derives the
 * same choice without the server having to store it.
 */
export function mapFor(key: string): MapChoice {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++)
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  hash >>>= 0;
  return { id: mapIds[hash % mapIds.length], seed: (hash >>> 3) % 100_000 };
}

/**
 * The map of a room. `?map=glade` forces a map and `?seats=12` previews the
 * layout for a head count, which is how the maps are reviewed from the hub.
 */
export function roomMap(key: string): MapChoice & { seats?: number } {
  const choice = mapFor(key);
  if (typeof window === "undefined") return choice;
  const search = new URLSearchParams(window.location.search);
  const forced = search.get("map");
  const seats = Number(search.get("seats"));
  return {
    id: isMapId(forced) ? forced : choice.id,
    seed: choice.seed,
    seats: Number.isInteger(seats) && seats > 0 ? seats : undefined,
  };
}
