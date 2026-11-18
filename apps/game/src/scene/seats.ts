import * as T from "three";
import { Builder, type Materials, rng } from "./kit";
import { seat } from "./layout";

const maxSeats = 15;
const lit = new T.Color("#ffb45e").multiplyScalar(2.2);
const dark = new T.Color("#1c1714");
const hidden = new T.Matrix4().makeScale(0, 0, 0);

/** Seat lanterns, stone markers, tombstones and target rings around the well. */
export class Seats {
  readonly group = new T.Group();
  private posts: T.InstancedMesh;
  private heads: T.InstancedMesh;
  private tombs: T.InstancedMesh;
  private plates: T.InstancedMesh;
  private headMaterial = new T.MeshBasicMaterial({ color: "#ffffff" });
  private halos: T.Points<T.BufferGeometry, T.ShaderMaterial>;
  private rise = new Float32Array(maxSeats);
  private riseTarget = new Float32Array(maxSeats);
  private riseDelay = new Float32Array(maxSeats);
  private flame = new Float32Array(maxSeats);
  readonly aim: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  readonly hover: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  private matrix = new T.Matrix4();
  private color = new T.Color();
  count = 0;

  constructor(materials: Materials, haloMaterial: T.ShaderMaterial) {
    const random = rng(23);
    const post = new Builder(random, 0.03)
      .box("#3d302b", [0.14, 1.5, 0.14], [0, 0.75, 0])
      .box("#2b2224", [0.4, 0.07, 0.4], [0, 1.85, 0])
      .box("#3d302b", [0.34, 0.06, 0.34], [0, 1.5, 0])
      .cone("#2b2224", 0.3, 0.22, [0, 1.98, 0], [0, Math.PI / 4, 0], 4)
      .build();
    const head = new T.BoxGeometry(0.24, 0.3, 0.24);
    head.translate(0, 1.68, 0);
    const tomb = new Builder(random, 0.04)
      .box("#8e8a85", [0.62, 0.75, 0.2], [0, 0.37, 0])
      .cylinder(
        "#8e8a85",
        [0.31, 0.31, 0.2],
        [0, 0.75, 0],
        [Math.PI / 2, 0, 0],
        10,
      )
      .box("#5b5752", [0.07, 0.36, 0.05], [0, 0.62, -0.11])
      .box("#5b5752", [0.24, 0.07, 0.05], [0, 0.68, -0.11])
      .box("#6d7a4a", [0.9, 0.08, 0.5], [0, 0.04, 0.05])
      .build();
    const plate = new Builder(random, 0.04)
      .cylinder("#a29a8c", [0.62, 0.66, 0.08], [0, 0.11, 0], undefined, 10)
      .build();
    this.posts = new T.InstancedMesh(post, materials.solid, maxSeats);
    this.heads = new T.InstancedMesh(head, this.headMaterial, maxSeats);
    this.tombs = new T.InstancedMesh(tomb, materials.solid, maxSeats);
    this.plates = new T.InstancedMesh(plate, materials.solid, maxSeats);
    for (const mesh of [this.posts, this.heads, this.tombs, this.plates]) {
      mesh.frustumCulled = false;
      for (let index = 0; index < maxSeats; index++)
        mesh.setMatrixAt(index, hidden);
      this.group.add(mesh);
    }
    for (let index = 0; index < maxSeats; index++)
      this.heads.setColorAt(index, dark);
    const haloGeometry = new T.BufferGeometry();
    haloGeometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(maxSeats * 3), 3),
    );
    haloGeometry.setAttribute(
      "tint",
      new T.BufferAttribute(new Float32Array(maxSeats * 3), 3),
    );
    haloGeometry.setAttribute(
      "size",
      new T.BufferAttribute(new Float32Array(maxSeats).fill(1.1), 1),
    );
    this.halos = new T.Points(haloGeometry, haloMaterial);
    this.halos.frustumCulled = false;
    this.group.add(this.halos);

    const ring = (color: string, opacity: number) => {
      const mesh = new T.Mesh(
        new T.RingGeometry(0.62, 0.8, 40),
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: T.AdditiveBlending,
          side: T.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      return mesh;
    };
    this.aim = ring("#ffc565", 0.95);
    this.hover = ring("#fff1d6", 0.45);
  }

  /** Raises a tombstone after `delay` seconds; instant when delay < 0. */
  bury(index: number, delay: number) {
    this.riseTarget[index] = 1;
    if (delay < 0) {
      this.rise[index] = 1;
      this.flame[index] = 0;
    }
    this.riseDelay[index] = Math.max(delay, 0);
  }

  revive(index: number) {
    this.riseTarget[index] = 0;
    this.rise[index] = 0;
  }

  tombTop(index: number) {
    const pose = seat(index, this.count);
    return new T.Vector3(pose.x * 1.08, 0.3, pose.z * 1.08);
  }

  update(
    delta: number,
    time: number,
    count: number,
    alive: boolean[],
    night: number,
    show: boolean,
  ) {
    this.count = count;
    this.group.visible = show;
    const positions = this.halos.geometry.attributes
      .position as T.BufferAttribute;
    const colors = this.halos.geometry.attributes.tint as T.BufferAttribute;
    const quaternion = new T.Quaternion();
    const scale = new T.Vector3();
    const where = new T.Vector3();
    const up = new T.Vector3(0, 1, 0);
    for (let index = 0; index < maxSeats; index++) {
      if (index >= count) {
        for (const mesh of [this.posts, this.heads, this.tombs, this.plates])
          mesh.setMatrixAt(index, hidden);
        colors.setXYZ(index, 0, 0, 0);
        continue;
      }
      const pose = seat(index, count);
      const between = pose.yaw + Math.PI / Math.max(count, 8);
      const out = { x: Math.sin(between), z: Math.cos(between) };
      quaternion.setFromAxisAngle(up, pose.yaw);
      where.set(out.x * 7.35, 0, out.z * 7.35);
      this.posts.setMatrixAt(
        index,
        this.matrix.compose(where, quaternion, scale.set(1, 0.62, 1)),
      );
      this.heads.setMatrixAt(index, this.matrix);
      where.set(pose.x, 0, pose.z);
      this.plates.setMatrixAt(
        index,
        this.matrix.compose(where, quaternion, scale.set(1, 1, 1)),
      );

      const flameTarget = alive[index] ? 1 : 0;
      this.flame[index] +=
        (flameTarget - this.flame[index]) * (1 - Math.exp(-delta * 3));
      const flicker =
        0.92 +
        Math.sin(time * 9 + index * 3.1) * 0.05 +
        Math.sin(time * 23 + index) * 0.03;
      this.color.copy(dark).lerp(lit, this.flame[index] * flicker);
      this.heads.setColorAt(index, this.color);
      const glow = this.flame[index] * (0.25 + night * 0.9) * flicker;
      colors.setXYZ(index, 1 * glow, 0.62 * glow, 0.28 * glow);
      positions.setXYZ(index, out.x * 7.35, 1.06, out.z * 7.35);

      if (this.riseDelay[index] > 0) this.riseDelay[index] -= delta;
      else
        this.rise[index] +=
          (this.riseTarget[index] - this.rise[index]) *
          (1 - Math.exp(-delta * 4));
      const height = this.rise[index];
      if (height < 0.01) this.tombs.setMatrixAt(index, hidden);
      else {
        where.set(pose.x * 1.08, (height - 1) * 0.9, pose.z * 1.08);
        const wobble = (1 - height) * Math.sin(time * 30) * 0.08;
        quaternion.setFromEuler(new T.Euler(wobble, pose.yaw, 0));
        this.tombs.setMatrixAt(
          index,
          this.matrix.compose(where, quaternion, scale.set(1, 1, 1)),
        );
      }
    }
    for (const mesh of [this.posts, this.heads, this.tombs, this.plates])
      mesh.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    const pulse = 1 + Math.sin(time * 5) * 0.06;
    this.aim.scale.setScalar(pulse);
    this.aim.rotation.z = time * 0.6;
    this.hover.scale.setScalar(1.05);
  }

  rising(index: number) {
    return (
      this.riseDelay[index] <= 0 &&
      this.riseTarget[index] === 1 &&
      this.rise[index] < 0.08
    );
  }

  dispose() {
    for (const mesh of [this.posts, this.heads, this.tombs, this.plates]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.headMaterial.dispose();
    this.halos.geometry.dispose();
    this.aim.geometry.dispose();
    this.aim.material.dispose();
    this.hover.geometry.dispose();
    this.hover.material.dispose();
  }
}
