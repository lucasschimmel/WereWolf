import { describe, expect, it } from "bun:test";
import * as T from "three";
import { mapFor } from "./index";
import { arrange, maxSeats, minSeats, ringRadius } from "./ring";
import { mapIds, type World } from "./types";

function world(fillerWidth = 2): World {
  const group = new T.Group();
  return {
    group,
    homes: Array.from({ length: maxSeats }, () => ({
      object: new T.Group(),
      chimney: new T.Vector3(0, 5, 0),
      lamps: [{ position: new T.Vector3(0, 2, 2), size: 2, color: "#fff" }],
    })),
    fillers: Array.from({ length: maxSeats }, () => ({
      object: new T.Group(),
      width: fillerWidth,
    })),
    glowSpots: [{ position: new T.Vector3(), size: 1, color: "#fff" }],
    bell: new T.Group(),
    detail: new T.Group(),
    nature: (function* () {})(),
  };
}

const shown = (objects: { object: T.Object3D }[]) =>
  objects.filter(({ object }) => object.visible);

describe("arrange", () => {
  it("shows exactly one home per player from 8 to 15 seats", () => {
    for (let players = minSeats; players <= maxSeats; players++) {
      const scene = world();

      const { chimneys } = arrange(scene, players);

      expect(shown(scene.homes)).toHaveLength(players);
      expect(chimneys).toHaveLength(players);
    }
  });

  it("pads small tables and caps large ones to the supported range", () => {
    const small = world();
    const large = world();

    arrange(small, 1);
    arrange(large, 40);

    expect(shown(small.homes)).toHaveLength(minSeats);
    expect(shown(large.homes)).toHaveLength(maxSeats);
  });

  it("keeps neighbouring homes at least a house width apart", () => {
    for (let players = minSeats; players <= maxSeats; players++) {
      const scene = world();

      arrange(scene, players);

      const homes = shown(scene.homes);
      for (const [index, { object }] of homes.entries()) {
        const next = homes[(index + 1) % homes.length].object;
        expect(object.position.distanceTo(next.position)).toBeGreaterThan(6);
      }
    }
  });

  it("keeps every home outside the walkable square", () => {
    const scene = world();

    arrange(scene, maxSeats);

    for (const { object } of shown(scene.homes))
      expect(object.position.length()).toBeGreaterThanOrEqual(ringRadius(15));
  });

  it("leaves the southern lane free of props", () => {
    const scene = world();

    arrange(scene, minSeats);

    expect(scene.fillers[0].object.visible).toBe(false);
    expect(shown(scene.fillers).length).toBeGreaterThan(0);
  });

  it("drops props once the homes fill the ring", () => {
    const scene = world();

    arrange(scene, maxSeats);

    expect(shown(scene.fillers)).toHaveLength(0);
  });

  it("resolves home lights into world space alongside the fixed ones", () => {
    const scene = world();

    const { glowSpots } = arrange(scene, 10);

    expect(glowSpots).toHaveLength(1 + 10);
    expect(glowSpots[1].position.length()).toBeGreaterThan(10);
  });
});

describe("mapFor", () => {
  it("gives every player of a room the same map and seed", () => {
    expect(mapFor("ABC234")).toEqual(mapFor("ABC234"));
  });

  it("spreads rooms across every map", () => {
    const drawn = new Set<string>();

    for (let room = 0; room < 200; room++) drawn.add(mapFor(`ROOM${room}`).id);

    expect([...drawn].sort()).toEqual([...mapIds].sort());
  });
});
