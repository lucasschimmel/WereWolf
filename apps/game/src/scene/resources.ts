import * as T from "three";
import {
  createMaterials,
  disposeMaterials,
  disposeTree,
  type Materials,
  SceneryLod,
  softDot,
} from "./kit";
import { arrange } from "./maps/ring";
import type { GlowSpot, MapDefinition, World } from "./maps/types";
import { PuppetFactory } from "./puppets";
import { budgets, type Tier } from "./quality";

const retentionMs = 45_000;

/** The static world can outlive a stage while the player changes screens. */
class Scenery {
  readonly group = new T.Group();
  readonly world: World;
  glowSpots: GlowSpot[] = [];
  chimneys: T.Vector3[] = [];
  private nature?: World["nature"];
  private seats = -1;

  constructor(
    readonly key: string,
    tier: Tier,
    materials: Materials,
    map: MapDefinition,
    seed: number,
  ) {
    this.world = map.build({ budget: budgets[tier], materials, seed });
    this.nature = this.world.nature;
    this.group.add(this.world.group);
    for (const group of [this.group, this.world.group, this.world.detail])
      group.matrixAutoUpdate = false;
  }

  /** Lays the homes out for a head count; true when the layout changed. */
  arrange(players: number) {
    if (players === this.seats) return false;
    this.seats = players;
    const { glowSpots, chimneys } = arrange(this.world, players);
    this.glowSpots = glowSpots;
    this.chimneys = chimneys;
    return true;
  }

  get loaded() {
    return this.nature === undefined;
  }

  loadBatch(reduction: number) {
    if (this.nature?.next().done) this.nature = undefined;
    this.setDetail(reduction);
  }

  setDetail(reduction: number) {
    this.group.traverse((object) => {
      if (object instanceof SceneryLod) object.setDetail(reduction);
    });
    this.world.detail.visible = reduction === 0;
  }

  dispose(sharedMaterials: Set<T.Material>) {
    this.nature?.return();
    disposeTree(this.group, sharedMaterials);
  }
}

function createResources(tier: Tier, map: MapDefinition, seed: number) {
  const renderer = new T.WebGLRenderer({
    antialias: budgets[tier].antialias,
    powerPreference: tier === "high" ? "high-performance" : "default",
  });
  const materials = createMaterials(tier);
  try {
    return {
      tier,
      renderer,
      materials,
      sharedMaterials: new Set<T.Material>([
        materials.solid,
        materials.wind,
        materials.glow,
      ]),
      scenery: new Scenery(sceneryKey(map, seed), tier, materials, map, seed),
      factory: new PuppetFactory(materials, softDot()),
    };
  } catch (cause) {
    disposeMaterials(materials);
    renderer.dispose();
    renderer.forceContextLoss();
    throw cause;
  }
}

export type SceneResources = ReturnType<typeof createResources>;

const sceneryKey = (map: MapDefinition, seed: number) => `${map.id}:${seed}`;

let parked: SceneResources | undefined;
let expiration: number | undefined;

function takeParked() {
  if (expiration !== undefined) window.clearTimeout(expiration);
  expiration = undefined;
  const resources = parked;
  parked = undefined;
  return resources;
}

function destroy(resources: SceneResources) {
  const { renderer, scenery, factory, sharedMaterials, materials } = resources;
  scenery.dispose(sharedMaterials);
  factory.dispose();
  disposeMaterials(materials);
  renderer.dispose();
  if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
}

function evict() {
  const resources = takeParked();
  if (resources) destroy(resources);
}

/**
 * Leases a single idle renderer and its assets to a matching quality tier.
 * Another map keeps the renderer, the materials and the puppets, and only
 * rebuilds the scenery.
 */
export function acquireSceneResources(
  tier: Tier,
  map: MapDefinition,
  seed: number,
) {
  const resources = takeParked();
  if (!resources) return createResources(tier, map, seed);
  if (
    resources.tier !== tier ||
    resources.renderer.getContext().isContextLost()
  ) {
    destroy(resources);
    return createResources(tier, map, seed);
  }
  const key = sceneryKey(map, seed);
  if (resources.scenery.key === key) return resources;
  resources.scenery.dispose(resources.sharedMaterials);
  try {
    resources.scenery = new Scenery(key, tier, resources.materials, map, seed);
  } catch (cause) {
    // The old scenery is gone, so nothing here can be parked again.
    resources.factory.dispose();
    disposeMaterials(resources.materials);
    resources.renderer.dispose();
    resources.renderer.forceContextLoss();
    throw cause;
  }
  return resources;
}

export function releaseSceneResources(resources: SceneResources) {
  const { renderer } = resources;
  if (renderer.getContext().isContextLost()) {
    destroy(resources);
    return;
  }
  evict();
  renderer.renderLists.dispose();
  renderer.setDrawingBufferSize(1, 1, 1);
  renderer.domElement.style.cursor = "";
  parked = resources;
  expiration = window.setTimeout(evict, retentionMs);
}

import.meta.hot?.dispose(evict);
