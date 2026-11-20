import * as T from "three";
import { rng, softDot } from "./kit";
import type { GlowSpot } from "./maps/types";

const haloVertex = `
attribute float size;
attribute vec3 tint;
uniform float uScale;
uniform float uIntensity;
varying vec3 vTint;
void main() {
  vTint = tint * uIntensity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(-mv.z, 0.1);
}`;
const haloFragment = `
uniform sampler2D uMap;
varying vec3 vTint;
void main() {
  float a = texture2D(uMap, gl_PointCoord).r;
  gl_FragColor = vec4(vTint * a, 1.0);
  #include <colorspace_fragment>
}`;

export function haloMaterial(intensity = 1) {
  return new T.ShaderMaterial({
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    uniforms: {
      uScale: { value: 400 },
      uIntensity: { value: intensity },
      uMap: { value: softDot() },
    },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
}

function haloGeometry(spots: GlowSpot[]) {
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array(spots.length * 3);
  const tints = new Float32Array(spots.length * 3);
  const sizes = new Float32Array(spots.length);
  const color = new T.Color();
  for (const [index, spot] of spots.entries()) {
    spot.position.toArray(positions, index * 3);
    color.set(spot.color).toArray(tints, index * 3);
    sizes[index] = spot.size * 0.42;
  }
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("tint", new T.BufferAttribute(tints, 3));
  geometry.setAttribute("size", new T.BufferAttribute(sizes, 1));
  return geometry;
}

export function haloField(spots: GlowSpot[], material: T.ShaderMaterial) {
  const points = new T.Points(haloGeometry(spots), material);
  points.frustumCulled = false;
  return points;
}

/** Replaces the lights once the homes are laid out for another head count. */
export function setHalos(points: T.Points, spots: GlowSpot[]) {
  points.geometry.dispose();
  points.geometry = haloGeometry(spots);
}

const moteVertex = `
attribute vec3 seed;
uniform float uTime;
uniform float uScale;
uniform float uSize;
varying float vPulse;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.35 + seed.x * 6.28) * 1.4;
  p.y += sin(uTime * 0.6 + seed.y * 6.28) * 0.7;
  p.z += cos(uTime * 0.3 + seed.z * 6.28) * 1.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vPulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.6 + seed.x * 40.0), 2.0);
  gl_PointSize = uSize * uScale / max(-mv.z, 0.1);
}`;
const moteFragment = `
uniform vec3 uColor;
uniform float uOpacity;
uniform sampler2D uMap;
varying float vPulse;
void main() {
  float a = texture2D(uMap, gl_PointCoord).r * vPulse * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;

/** Drifting fireflies at night, pollen by day. */
export class Motes {
  readonly points: T.Points<T.BufferGeometry, T.ShaderMaterial>;
  private night: T.Color;
  private day: T.Color;
  constructor(count: number, colors: { day: string; night: string }) {
    this.night = new T.Color(colors.night);
    this.day = new T.Color(colors.day);
    const random = rng(91);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const radius = 4 + random() * 24;
      const angle = random() * Math.PI * 2;
      positions.set(
        [
          Math.cos(angle) * radius,
          0.4 + random() * 3.2,
          Math.sin(angle) * radius,
        ],
        index * 3,
      );
      seeds.set([random(), random(), random()], index * 3);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("seed", new T.BufferAttribute(seeds, 3));
    this.points = new T.Points(
      geometry,
      new T.ShaderMaterial({
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 400 },
          uSize: { value: 0.2 },
          uColor: { value: new T.Color() },
          uOpacity: { value: 1 },
          uMap: { value: softDot() },
        },
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
  }
  update(time: number, night: number) {
    const uniforms = this.points.material.uniforms;
    uniforms.uTime.value = time;
    (uniforms.uColor.value as T.Color).copy(this.day).lerp(this.night, night);
    uniforms.uOpacity.value = 0.35 + night * 0.9;
    uniforms.uSize.value = 0.06 + night * 0.08;
  }
}

const particleVertex = `
attribute float alpha;
attribute float size;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(-mv.z, 0.1);
}`;
const particleFragment = `
uniform vec3 uColor;
uniform sampler2D uMap;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).r * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

/** CPU-driven soft particles for smoke and dust. */
export class Particles {
  readonly points: T.Points<T.BufferGeometry, T.ShaderMaterial>;
  private velocity: Float32Array;
  private life: Float32Array;
  private span: Float32Array;
  private base: Float32Array;
  private cursor = 0;
  private active = 0;
  private occupied = 0;
  constructor(
    private capacity: number,
    color: string,
    private gravity: number,
    private growth: number,
    private fade: number,
  ) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "alpha",
      new T.BufferAttribute(new Float32Array(capacity), 1).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "size",
      new T.BufferAttribute(new Float32Array(capacity), 1).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.span = new Float32Array(capacity).fill(1);
    this.base = new Float32Array(capacity);
    this.points = new T.Points(
      geometry,
      new T.ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        uniforms: {
          uScale: { value: 400 },
          uColor: { value: new T.Color(color) },
          uMap: { value: softDot() },
        },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    geometry.setDrawRange(0, 0);
  }
  get color() {
    return this.points.material.uniforms.uColor.value as T.Color;
  }
  emit(position: T.Vector3, velocity: T.Vector3, life: number, size: number) {
    const index = this.cursor;
    if (this.life[index] <= 0) this.active++;
    this.occupied = Math.max(this.occupied, index + 1);
    this.cursor = (this.cursor + 1) % this.capacity;
    const positions = this.points.geometry.attributes
      .position as T.BufferAttribute;
    positions.setXYZ(index, position.x, position.y, position.z);
    this.velocity[index * 3] = velocity.x;
    this.velocity[index * 3 + 1] = velocity.y;
    this.velocity[index * 3 + 2] = velocity.z;
    this.life[index] = life;
    this.span[index] = life;
    this.base[index] = size;
  }
  update(delta: number) {
    if (!this.active) return;
    const positions = this.points.geometry.attributes
      .position as T.BufferAttribute;
    const alpha = this.points.geometry.attributes.alpha as T.BufferAttribute;
    const size = this.points.geometry.attributes.size as T.BufferAttribute;
    for (let index = 0; index < this.occupied; index++) {
      if (this.life[index] <= 0) {
        alpha.setX(index, 0);
        continue;
      }
      this.life[index] -= delta;
      if (this.life[index] <= 0) this.active--;
      const age = 1 - Math.max(this.life[index], 0) / this.span[index];
      this.velocity[index * 3 + 1] += this.gravity * delta;
      positions.setXYZ(
        index,
        positions.getX(index) + this.velocity[index * 3] * delta,
        positions.getY(index) + this.velocity[index * 3 + 1] * delta,
        positions.getZ(index) + this.velocity[index * 3 + 2] * delta,
      );
      alpha.setX(
        index,
        Math.sin(Math.min(age * 4, 1) * Math.PI * 0.5) * (1 - age) ** this.fade,
      );
      size.setX(index, this.base[index] * (1 + age * this.growth));
    }
    positions.needsUpdate = true;
    alpha.needsUpdate = true;
    size.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.active ? this.occupied : 0);
    if (!this.active) this.cursor = this.occupied = 0;
  }
}

type Arc = {
  mesh: T.Mesh<T.TubeGeometry, T.MeshBasicMaterial>;
  born: number;
  total: number;
};

/** Glowing ribbons from voters to their target when a ballot is revealed. */
export class VoteArcs {
  readonly group = new T.Group();
  private arcs: Arc[] = [];
  show(pairs: [T.Vector3, T.Vector3][], time: number, color = "#ffb35c") {
    for (const [index, [from, to]] of pairs.entries()) {
      const middle = from.clone().lerp(to, 0.5);
      middle.y += 1.6 + from.distanceTo(to) * 0.18;
      const curve = new T.QuadraticBezierCurve3(from, middle, to);
      const geometry = new T.TubeGeometry(curve, 28, 0.035, 5, false);
      const mesh = new T.Mesh(
        geometry,
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          blending: T.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      mesh.material.color.multiplyScalar(2);
      geometry.setDrawRange(0, 0);
      this.group.add(mesh);
      this.arcs.push({
        mesh,
        born: time + index * 0.12,
        total: geometry.index?.count ?? 0,
      });
    }
  }
  update(time: number) {
    this.arcs = this.arcs.filter((arc) => {
      const age = time - arc.born;
      if (age > 6.5) {
        this.group.remove(arc.mesh);
        arc.mesh.geometry.dispose();
        arc.mesh.material.dispose();
        return false;
      }
      const grow = T.MathUtils.clamp(age / 0.9, 0, 1);
      const segments = Math.floor(grow * 28);
      arc.mesh.geometry.setDrawRange(0, Math.min(arc.total, segments * 5 * 6));
      arc.mesh.material.opacity = age < 5 ? 1 : 1 - (age - 5) / 1.5;
      return true;
    });
  }
  clear() {
    for (const arc of this.arcs) {
      this.group.remove(arc.mesh);
      arc.mesh.geometry.dispose();
      arc.mesh.material.dispose();
    }
    this.arcs = [];
  }
}
