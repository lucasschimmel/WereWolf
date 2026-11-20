import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Tier } from "./quality";

export type Vec3 = [number, number, number];

export function rng(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const matrix = new T.Matrix4();
const quaternion = new T.Quaternion();
const euler = new T.Euler();
const scaleVector = new T.Vector3();
const positionVector = new T.Vector3();
const tint = new T.Color();

function flatten(geometry: T.BufferGeometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  for (const name of Object.keys(flat.attributes))
    if (name !== "position" && name !== "normal") flat.deleteAttribute(name);
  return flat;
}

function prismGeometry() {
  const a = [-0.5, 0, -0.5];
  const b = [-0.5, 0, 0.5];
  const c = [-0.5, 1, 0];
  const A = [0.5, 0, -0.5];
  const B = [0.5, 0, 0.5];
  const C = [0.5, 1, 0];
  const faces = [a, b, c, A, C, B, b, B, C, b, C, c, a, C, A, a, c, C];
  faces.push(a, A, B, a, B, b);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(faces.flat(), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

// The source meshes are never uploaded or transformed. Each builder owns its copy.
let unitBox: T.BufferGeometry | undefined;
let unitPrism: T.BufferGeometry | undefined;
const unitBalls = new Map<number, T.BufferGeometry>();
const unitCones = new Map<number, T.BufferGeometry>();

function primitive(
  cache: Map<number, T.BufferGeometry>,
  key: number,
  create: (key: number) => T.BufferGeometry,
) {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = flatten(create(key));
    cache.set(key, geometry);
  }
  return geometry.clone();
}

/** Collects vertex-coloured primitives and merges them into one draw call. */
export class Builder {
  private parts: T.BufferGeometry[] = [];
  constructor(
    private random: () => number = Math.random,
    private variance = 0.06,
    private enabled = true,
  ) {}
  get size() {
    return this.parts.length;
  }
  add(
    geometry: T.BufferGeometry,
    color: T.ColorRepresentation,
    position: Vec3 = [0, 0, 0],
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
  ) {
    const shade = 1 + (this.random() - 0.5) * this.variance * 2;
    const part = flatten(geometry);
    matrix.compose(
      positionVector.set(...position),
      quaternion.setFromEuler(euler.set(...rotation)),
      scaleVector.set(...scale),
    );
    part.applyMatrix4(matrix);
    tint.set(color);
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      colors[index * 3] = tint.r * shade;
      colors[index * 3 + 1] = tint.g * shade;
      colors[index * 3 + 2] = tint.b * shade;
    }
    part.setAttribute("color", new T.BufferAttribute(colors, 3));
    this.parts.push(part);
    return this;
  }
  /** Adds an already coloured, non-indexed geometry. */
  absorb(geometry: T.BufferGeometry, transform?: T.Matrix4) {
    if (transform) geometry.applyMatrix4(transform);
    this.parts.push(geometry);
    return this;
  }
  box(
    color: T.ColorRepresentation,
    size: Vec3,
    position: Vec3,
    rotation?: Vec3,
  ) {
    if (!this.enabled) return this.skip();
    unitBox ??= flatten(new T.BoxGeometry());
    return this.add(unitBox.clone(), color, position, rotation, size);
  }
  cylinder(
    color: T.ColorRepresentation,
    [top, bottom, height]: Vec3,
    position: Vec3,
    rotation?: Vec3,
    segments = 8,
  ) {
    if (!this.enabled) return this.skip();
    return this.add(
      new T.CylinderGeometry(top, bottom, height, segments),
      color,
      position,
      rotation,
    );
  }
  cone(
    color: T.ColorRepresentation,
    radius: number,
    height: number,
    position: Vec3,
    rotation?: Vec3,
    segments = 6,
  ) {
    if (!this.enabled) return this.skip();
    return this.add(
      primitive(
        unitCones,
        segments,
        (sides) => new T.ConeGeometry(1, 1, sides),
      ),
      color,
      position,
      rotation,
      [radius, height, radius],
    );
  }
  ball(
    color: T.ColorRepresentation,
    radius: number | Vec3,
    position: Vec3,
    rotation?: Vec3,
    detail = 0,
  ) {
    if (!this.enabled) return this.skip();
    const scale: Vec3 =
      typeof radius === "number" ? [radius, radius, radius] : radius;
    return this.add(
      primitive(
        unitBalls,
        detail,
        (level) => new T.IcosahedronGeometry(1, level),
      ),
      color,
      position,
      rotation,
      scale,
    );
  }
  /** Gable prism: ridge along X, base on Y=0. */
  prism(
    color: T.ColorRepresentation,
    size: Vec3,
    position: Vec3,
    rotation?: Vec3,
  ) {
    if (!this.enabled) return this.skip();
    unitPrism ??= prismGeometry();
    return this.add(unitPrism.clone(), color, position, rotation, size);
  }
  private skip() {
    // Preserve the seeded layout when a profile omits these primitives.
    this.random();
    return this;
  }
  build() {
    if (!this.parts.length) return new T.BufferGeometry();
    const merged = mergeGeometries(this.parts) ?? new T.BufferGeometry();
    for (const part of this.parts) part.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Distance-based detail with hysteresis, independently of the viewport size. */
export class SceneryLod extends T.LOD {
  constructor(
    near: T.Object3D,
    far: T.Object3D,
    private readonly distance: number,
  ) {
    super();
    this.addLevel(near, 0);
    this.addLevel(far, distance, 0.12);
    far.visible = false;
  }

  setDetail(reduction: number) {
    this.levels[1].distance = this.distance * (1 - reduction * 0.25);
  }
}

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials(tier: Tier) {
  const time = { value: 0 };
  const solid =
    tier === "low"
      ? new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })
      : new T.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          roughness: 0.86,
          metalness: 0.02,
        });
  const wind = solid.clone();
  wind.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "uniform float uTime;\n#include <common>")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 anchor = instanceMatrix[3].xyz;
        #else
          vec3 anchor = vec3(0.0);
        #endif
        float bend = max(position.y - 0.6, 0.0);
        transformed.x += sin(uTime * 1.3 + anchor.x * 0.31 + anchor.z * 0.17) * 0.045 * bend;
        transformed.z += cos(uTime * 1.05 + anchor.z * 0.27) * 0.035 * bend;`,
      );
  };
  wind.customProgramCacheKey = () => "werewolf-wind";
  const glow = new T.MeshBasicMaterial({ vertexColors: true });
  return { time, solid, wind, glow };
}

export function disposeMaterials(materials: Materials) {
  materials.solid.dispose();
  materials.wind.dispose();
  materials.glow.dispose();
}

let glowTexture: T.CanvasTexture | undefined;
export function softDot() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  glowTexture = new T.CanvasTexture(canvas);
  glowTexture.colorSpace = T.SRGBColorSpace;
  return glowTexture;
}

/** Disposes geometries and per-object materials under a root. */
export function disposeTree(root: T.Object3D, shared: Set<T.Material>) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set(shared);
  root.traverse((node) => {
    if (
      node instanceof T.Mesh ||
      node instanceof T.Points ||
      node instanceof T.Sprite ||
      node instanceof T.LineSegments
    ) {
      if (!(node instanceof T.Sprite) && !geometries.has(node.geometry)) {
        geometries.add(node.geometry);
        node.geometry.dispose();
      }
      const list = Array.isArray(node.material)
        ? node.material
        : [node.material];
      for (const material of list) {
        if (materials.has(material)) continue;
        materials.add(material);
        if ("map" in material && material.map instanceof T.Texture)
          material.map.dispose();
        material.dispose();
      }
    }
    if (node instanceof T.InstancedMesh) node.dispose();
  });
}
