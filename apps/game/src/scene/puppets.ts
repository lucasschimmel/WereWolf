import * as T from "three";
import { characters } from "../../shared/rules";
import { Builder, type Materials, pole, rng, type Vec3 } from "./kit";
import { dampAngle, type Pose, wrap } from "./layout";
import { outfits } from "./outfits";

const skins = [
  "#e9b590",
  "#c98e6b",
  "#f1caa6",
  "#a8714f",
  "#ddA27e",
  "#8d5a3b",
  "#efc19b",
  "#b97f5a",
];
const hairs = [
  "#3b2a20",
  "#7a4b2a",
  "#c9a066",
  "#1f1a1a",
  "#a0522d",
  "#5b4636",
  "#d8c7a0",
  "#2d2420",
];
const pants = "#3d3438";
const boots = "#2a2225";

type Parts = {
  torso: T.BufferGeometry;
  head: T.BufferGeometry;
  armLeft: T.BufferGeometry;
  armRight: T.BufferGeometry;
  leg: T.BufferGeometry;
};

function head(
  b: Builder,
  index: number,
  skin: string,
  hair: string,
  outfit: string,
  trim: string,
) {
  b.cylinder(skin, [0.08, 0.09, 0.12], [0, 0.04, 0], undefined, 6);
  b.ball(skin, [0.27, 0.285, 0.265], [0, 0.25, 0], undefined, 1);
  for (const side of [-1, 1]) {
    b.ball("#1e1a1c", 0.036, [side * 0.095, 0.28, -0.235]);
    b.ball("#ffffff", 0.012, [side * 0.095 + 0.012, 0.295, -0.262]);
    b.ball("#e9978a", [0.055, 0.032, 0.02], [side * 0.15, 0.19, -0.215]);
    b.box(
      hair,
      [0.09, 0.022, 0.02],
      [side * 0.095, 0.345, -0.235],
      [0, 0, side * -0.15],
    );
  }
  b.ball(skin, 0.05, [0, 0.22, -0.27]);
  b.box("#7a3d38", [0.08, 0.018, 0.012], [0, 0.135, -0.25]);
  if (index !== 0 && index !== 2)
    b.ball(hair, [0.275, 0.25, 0.275], [0, 0.33, 0.05], undefined, 1);
  const custom = outfits[characters[index].id];
  if (custom) return custom.head(b, { outfit, trim, hair });
  switch (index) {
    case 0:
      b.ball(outfit, [0.31, 0.31, 0.3], [0, 0.29, 0.06], undefined, 1);
      b.cone(outfit, 0.11, 0.3, [0, 0.47, 0.27], [1.1, 0, 0], 6);
      b.ball(hair, [0.2, 0.08, 0.05], [0, 0.42, -0.2]);
      break;
    case 1:
      b.cylinder("#2b2328", [0.34, 0.34, 0.04], [0, 0.48, 0], undefined, 12);
      b.cylinder("#2b2328", [0.2, 0.21, 0.38], [0, 0.68, 0], undefined, 10);
      b.cylinder(trim, [0.212, 0.212, 0.07], [0, 0.53, 0], undefined, 10);
      break;
    case 2:
      b.ball(trim, [0.3, 0.25, 0.3], [0, 0.33, 0.03], undefined, 1);
      b.ball(trim, 0.08, [0, 0.22, 0.29]);
      b.ball(hair, [0.12, 0.2, 0.08], [0.15, 0.12, 0.2]);
      break;
    case 3:
      b.cylinder(trim, [0.25, 0.36, 0.08], [0, 0.46, 0], undefined, 10);
      b.ball(trim, [0.25, 0.17, 0.25], [0, 0.51, 0]);
      b.ball(hair, [0.2, 0.15, 0.13], [0, 0.07, -0.17]);
      break;
    case 4:
      b.cylinder("#dcc479", [0.47, 0.47, 0.03], [0, 0.47, 0], undefined, 14);
      b.cylinder("#d4b96b", [0.2, 0.23, 0.17], [0, 0.56, 0], undefined, 10);
      b.cylinder(trim, [0.235, 0.235, 0.05], [0, 0.5, 0], undefined, 10);
      b.ball(hair, [0.1, 0.22, 0.09], [-0.2, 0.15, 0.12]);
      b.ball(hair, [0.1, 0.22, 0.09], [0.2, 0.15, 0.12]);
      break;
    case 5:
      b.ball("#8c919b", [0.3, 0.22, 0.3], [0, 0.38, 0], undefined, 1);
      b.cylinder("#7d828c", [0.36, 0.36, 0.03], [0, 0.37, 0], undefined, 12);
      b.ball(trim, [0.06, 0.16, 0.12], [0, 0.62, 0.05]);
      break;
    case 6:
      b.cylinder(trim, [0.275, 0.275, 0.07], [0, 0.38, 0], undefined, 10);
      b.ball(hair, 0.11, [0, 0.52, 0.16]);
      break;
    default:
      b.ball("#efe9dc", [0.31, 0.2, 0.31], [0, 0.43, 0.03], undefined, 1);
      b.ball("#efe9dc", 0.12, [0.14, 0.46, 0.2]);
      for (const side of [-1, 1])
        b.ball(
          hair,
          [0.075, 0.03, 0.03],
          [side * 0.06, 0.17, -0.265],
          [0, 0, side * 0.3],
        );
      break;
  }
}

function build(index: number): Parts {
  const random = rng(100 + index);
  const { color: outfit, trim } = characters[index];
  const skin = skins[index % skins.length];
  const hair = hairs[index % hairs.length];

  const torso = new Builder(random, 0.03);
  if (index === 7) {
    torso.cylinder(outfit, [0.24, 0.3, 0.62], [0, 0.31, 0], undefined, 9);
    torso.ball(outfit, [0.31, 0.29, 0.29], [0, 0.24, -0.04]);
  } else torso.cylinder(outfit, [0.22, 0.27, 0.62], [0, 0.31, 0], undefined, 9);
  if (index === 2 || index === 4)
    torso.cylinder(outfit, [0.25, 0.42, 0.52], [0, -0.1, 0], undefined, 10);
  torso.cylinder("#3a2c26", [0.28, 0.28, 0.07], [0, 0.07, 0], undefined, 9);
  torso.box("#c9a24a", [0.08, 0.06, 0.04], [0, 0.07, -0.28]);
  torso.cylinder(trim, [0.15, 0.21, 0.09], [0, 0.62, 0], undefined, 9);
  for (const y of [0.3, 0.45]) torso.ball(trim, 0.03, [0, y, -0.25]);
  if (index === 0)
    torso.box(outfit, [0.52, 0.72, 0.05], [0, 0.28, 0.25], [-0.12, 0, 0]);
  if (index === 6) torso.box("#6b4a36", [0.38, 0.55, 0.03], [0, 0.22, -0.27]);
  if (index === 2) torso.box("#7a5838", [0.16, 0.2, 0.1], [0.27, 0.12, 0.05]);
  const custom = outfits[characters[index].id];
  custom?.torso?.(torso, { outfit, trim, hair });

  const headBuilder = new Builder(random, 0.02);
  head(headBuilder, index, skin, hair, outfit, trim);

  const arm = (side: number) => {
    const b = new Builder(random, 0.03);
    b.ball(outfit, 0.1, [0, -0.02, 0]);
    b.cylinder(outfit, [0.075, 0.088, 0.42], [0, -0.22, 0], undefined, 7);
    b.cylinder(trim, [0.09, 0.09, 0.05], [0, -0.42, 0], undefined, 7);
    b.ball(skin, 0.078, [0, -0.5, 0]);
    if (side > 0 && index === 1) {
      b.box("#2d2324", [0.03, 0.2, 0.03], [0, -0.62, 0]);
      b.box("#3b2f2c", [0.17, 0.04, 0.17], [0, -0.7, 0]);
      b.box("#ffd27a", [0.13, 0.17, 0.13], [0, -0.8, 0]);
      b.box("#3b2f2c", [0.17, 0.04, 0.17], [0, -0.9, 0]);
    }
    if (side > 0 && index === 5) {
      // A hand bell: the handle sits in the fist, the bell hangs below it.
      b.cylinder(
        "#6b4c34",
        [0.022, 0.022, 0.2],
        [0, -0.52, -0.02],
        undefined,
        5,
      );
      b.cylinder(
        "#b8863b",
        [0.05, 0.12, 0.15],
        [0, -0.68, -0.02],
        undefined,
        9,
      );
      b.ball("#8a6428", 0.035, [0, -0.77, -0.02]);
    }
    if (side > 0 && index === 6) {
      b.cylinder(
        "#6b4c34",
        [0.025, 0.025, 0.45],
        [0, -0.55, -0.12],
        [Math.PI / 2, 0, 0],
        5,
      );
      b.box("#4a4a50", [0.12, 0.12, 0.2], [0, -0.55, -0.35]);
    }
    if (side < 0 && index === 4) {
      // The crook rests on the ground and leans out, clear of the wide brim.
      const top: Vec3 = [side * 0.22, 0.85, -0.31];
      pole(b, "#8a6a44", 0.022, [side * -0.074, -1.24, 0.077], top);
      const bend: Vec3 = [side * 0.3, 0.95, -0.4];
      pole(b, "#8a6a44", 0.022, top, bend);
      pole(b, "#8a6a44", 0.022, bend, [side * 0.34, 0.86, -0.48]);
    }
    if (side < 0 && index === 3) {
      // The rod runs through the fist and points up and away from the body.
      pole(b, "#6b4c34", 0.018, [0, -0.62, 0.03], [side * 0.15, 0.5, -0.75], 4);
    }
    custom?.hand?.(b, side);
    return b.build();
  };
  const leg = new Builder(random, 0.03)
    .cylinder(pants, [0.088, 0.075, 0.52], [0, -0.26, 0], undefined, 7)
    .box(boots, [0.17, 0.16, 0.27], [0, -0.6, -0.04])
    .build();
  return {
    torso: torso.build(),
    head: headBuilder.build(),
    armLeft: arm(-1),
    armRight: arm(1),
    leg,
  };
}

export type Label = {
  name: string;
  alive: boolean;
  host: boolean;
  ready?: boolean;
  mate: boolean;
  role?: string;
  camp?: "village" | "pack" | "solo";
};

const campColors = { village: "#9ccf7a", pack: "#ff7a6b", solo: "#c9a2ff" };

function drawLabel(label: Label) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = label.role ? 176 : 112;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.font = "700 46px Fraunces, Georgia, serif";
  const text = label.name;
  const width = Math.min(
    480,
    ctx.measureText(text).width +
      (label.host ? 120 : 76) +
      (label.mate ? 44 : 0),
  );
  const x = (512 - width) / 2;
  ctx.fillStyle = label.mate ? "rgba(70,14,18,0.86)" : "rgba(16,14,22,0.78)";
  ctx.beginPath();
  ctx.roundRect(x, 18, width, 78, 39);
  ctx.fill();
  ctx.strokeStyle = label.mate
    ? "#ff7a6b"
    : label.alive
      ? "rgba(255,214,150,0.55)"
      : "rgba(200,200,200,0.25)";
  ctx.lineWidth = 3;
  ctx.stroke();
  let cursor = x + 34;
  if (label.ready !== undefined) {
    ctx.fillStyle = label.ready ? "#9ccf7a" : "#6f6a72";
    ctx.beginPath();
    ctx.arc(cursor, 57, 10, 0, Math.PI * 2);
    ctx.fill();
    cursor += 22;
  } else cursor += 4;
  if (label.host) {
    ctx.fillStyle = "#f2c37a";
    ctx.beginPath();
    ctx.moveTo(cursor, 70);
    ctx.lineTo(cursor + 4, 44);
    ctx.lineTo(cursor + 14, 56);
    ctx.lineTo(cursor + 22, 40);
    ctx.lineTo(cursor + 30, 56);
    ctx.lineTo(cursor + 40, 44);
    ctx.lineTo(cursor + 44, 70);
    ctx.closePath();
    ctx.fill();
    cursor += 56;
  }
  if (label.mate) {
    ctx.strokeStyle = "#ff7a6b";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let claw = 0; claw < 3; claw++) {
      ctx.beginPath();
      ctx.moveTo(cursor + claw * 10, 42);
      ctx.lineTo(cursor + claw * 10 + 8, 72);
      ctx.stroke();
    }
    cursor += 44;
  }
  ctx.fillStyle = label.alive ? "#fbefd9" : "#9a948f";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cursor, 59, 512 - cursor - 24);
  if (label.role && label.camp) {
    ctx.font = "600 34px Manrope, system-ui, sans-serif";
    const roleWidth = ctx.measureText(label.role).width + 40;
    ctx.fillStyle = "rgba(16,14,22,0.82)";
    ctx.beginPath();
    ctx.roundRect((512 - roleWidth) / 2, 108, roleWidth, 56, 28);
    ctx.fill();
    ctx.fillStyle = campColors[label.camp];
    ctx.textAlign = "center";
    ctx.fillText(label.role, 256, 137);
  }
  return canvas;
}

export class PuppetFactory {
  private cache = new Map<number, Parts>();
  private silhouettes = new Map<number, T.BufferGeometry>();
  readonly hitGeometry = new T.CylinderGeometry(0.5, 0.5, 2, 8).translate(
    0,
    1,
    0,
  );
  readonly hitMaterial = new T.MeshBasicMaterial({ visible: false });
  /** Pale, see-through look for villagers asleep at home during the night. */
  readonly ghostMaterial = new T.MeshBasicMaterial({
    color: "#9db0d8",
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  readonly shadowGeometry = new T.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
  readonly shadowMaterial: T.MeshBasicMaterial;
  constructor(
    readonly materials: Materials,
    shadowTexture: T.Texture,
  ) {
    this.shadowMaterial = new T.MeshBasicMaterial({
      color: "#000000",
      map: shadowTexture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  }
  parts(index: number) {
    const safe =
      ((index % characters.length) + characters.length) % characters.length;
    let parts = this.cache.get(safe);
    if (!parts) {
      parts = build(safe);
      this.cache.set(safe, parts);
    }
    return parts;
  }

  silhouette(index: number) {
    const safe =
      ((index % characters.length) + characters.length) % characters.length;
    let geometry = this.silhouettes.get(safe);
    if (!geometry) {
      const { color, trim } = characters[safe];
      geometry = new Builder(rng(100 + safe), 0)
        .cylinder(color, [0.23, 0.31, 0.65], [0, 1, 0], undefined, 6)
        .ball(skins[safe % skins.length], 0.23, [0, 1.57, 0])
        .ball(hairs[safe % hairs.length], [0.24, 0.16, 0.24], [0, 1.72, 0])
        .box(trim, [0.44, 0.08, 0.37], [0, 1.24, 0])
        .box(color, [0.67, 0.45, 0.19], [0, 0.99, 0])
        .box(pants, [0.36, 0.59, 0.22], [0, 0.38, 0])
        .box(boots, [0.39, 0.13, 0.31], [0, 0.1, -0.04])
        .build();
      this.silhouettes.set(safe, geometry);
    }
    return geometry;
  }

  dispose() {
    for (const parts of this.cache.values())
      for (const geometry of Object.values(parts)) geometry.dispose();
    for (const geometry of this.silhouettes.values()) geometry.dispose();
    this.hitGeometry.dispose();
    this.hitMaterial.dispose();
    this.ghostMaterial.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
  }
}

export type Gesture = "none" | "wave" | "point" | "cheer" | "mourn" | "sleep";

export class Puppet {
  readonly root = new T.Group();
  readonly hit: T.Mesh;
  private body = new T.Group();
  private silhouette?: T.Mesh;
  private torso = new T.Group();
  private head = new T.Group();
  private armLeft = new T.Group();
  private armRight = new T.Group();
  private legLeft = new T.Group();
  private legRight = new T.Group();
  private label?: T.Sprite;
  private labelKey = "";
  private shadow: T.Mesh;
  private speed = 0;
  private stride = 0;
  private seed: number;
  private dying = -1;
  private initialised = false;
  private waveTimer = 0;
  private meshes: T.Mesh[] = [];
  private ghost = false;
  private solid: T.Material;
  private ghostMaterial: T.Material;
  gesture: Gesture = "none";
  readonly position = new T.Vector3();
  yaw = 0;

  constructor(
    readonly id: string,
    readonly character: number,
    private factory: PuppetFactory,
    private castShadow: boolean,
  ) {
    const parts = factory.parts(character);
    const solid = factory.materials.solid;
    this.solid = solid;
    this.ghostMaterial = factory.ghostMaterial;
    const add = (parent: T.Object3D, geometry: T.BufferGeometry) => {
      const mesh = new T.Mesh(geometry, solid);
      mesh.castShadow = castShadow;
      parent.add(mesh);
      this.meshes.push(mesh);
    };
    this.seed = (id.charCodeAt(id.length - 1) || 7) * 1.37;
    this.root.add(this.body);
    this.body.add(this.torso, this.legLeft, this.legRight);
    this.legLeft.position.set(-0.11, 0.68, 0);
    this.legRight.position.set(0.11, 0.68, 0);
    add(this.legLeft, parts.leg);
    add(this.legRight, parts.leg);
    this.torso.position.y = 0.68;
    add(this.torso, parts.torso);
    this.torso.add(this.head, this.armLeft, this.armRight);
    this.head.position.y = 0.66;
    add(this.head, parts.head);
    this.armLeft.position.set(-0.3, 0.56, 0);
    this.armRight.position.set(0.3, 0.56, 0);
    add(this.armLeft, parts.armLeft);
    add(this.armRight, parts.armRight);
    this.hit = new T.Mesh(factory.hitGeometry, factory.hitMaterial);
    this.hit.userData.player = id;
    this.root.add(this.hit);
    this.shadow = new T.Mesh(factory.shadowGeometry, factory.shadowMaterial);
    this.shadow.position.y = 0.13;
    this.shadow.renderOrder = 1;
    this.shadow.visible = !castShadow;
    this.root.add(this.shadow);
    this.root.userData.player = id;
  }

  setDetail(camera: T.Vector3, distance: number, shadows: boolean) {
    if (!this.root.visible) return;
    const cutoff = this.body.visible ? distance : distance * 0.9;
    const distant =
      !this.falling &&
      this.waveTimer <= 0 &&
      (this.gesture === "none" || this.gesture === "sleep") &&
      camera.distanceToSquared(this.position) > cutoff * cutoff;
    this.body.visible = !distant;
    this.shadow.visible = !this.ghost && !this.falling && (!shadows || distant);
    if (distant && !this.silhouette) {
      this.silhouette = new T.Mesh(
        this.factory.silhouette(this.character),
        this.solid,
      );
      this.root.add(this.silhouette);
    }
    if (this.silhouette) {
      this.silhouette.visible = distant;
      this.silhouette.material = this.ghost ? this.ghostMaterial : this.solid;
    }
  }

  setLabel(label: Label | null) {
    const key = label ? JSON.stringify(label) : "";
    if (key === this.labelKey) return;
    this.labelKey = key;
    if (this.label) {
      this.root.remove(this.label);
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.label = undefined;
    }
    if (!label) return;
    const canvas = drawLabel(label);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    this.label = new T.Sprite(
      new T.SpriteMaterial({
        map: texture,
        depthWrite: false,
        depthTest: true,
        transparent: true,
        fog: false,
      }),
    );
    const height = canvas.height / 512;
    this.label.scale.set(1.7, 1.7 * height, 1);
    this.label.center.set(0.5, 1 - 18 / canvas.height);
    this.label.position.y = 2.42;
    this.label.renderOrder = 5;
    this.root.add(this.label);
  }

  /** Shows the puppet as a sleeping silhouette that casts no shadow. */
  setGhost(on: boolean) {
    if (on === this.ghost) return;
    this.ghost = on;
    for (const mesh of this.meshes) {
      mesh.material = on ? this.ghostMaterial : this.solid;
      mesh.castShadow = !on && this.castShadow;
    }
  }

  wave() {
    this.waveTimer = 1.6;
  }

  fall() {
    if (this.dying < 0) this.dying = 0;
  }

  get fallen() {
    return this.dying >= 1.8;
  }
  get falling() {
    return this.dying >= 0;
  }

  /** Moves toward a goal pose and animates limbs from the resulting speed. */
  update(
    delta: number,
    time: number,
    goal: Pose | null,
    mode: "walk" | "glide" | "snap" | "track",
    look?: T.Vector3,
  ) {
    if (!goal) {
      this.root.visible = false;
      this.initialised = false;
      return;
    }
    this.root.visible = true;
    const previousX = this.position.x;
    const previousZ = this.position.z;
    if (!this.initialised || mode === "snap") {
      this.position.set(goal.x, 0, goal.z);
      this.yaw = goal.yaw;
      this.initialised = true;
    } else if (mode === "walk") {
      const dx = goal.x - this.position.x;
      const dz = goal.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 14) this.position.set(goal.x, 0, goal.z);
      else if (distance > 0.001) {
        const step = Math.min(distance, delta * 3.6);
        this.position.x += (dx / distance) * step;
        this.position.z += (dz / distance) * step;
      }
    } else if (
      mode === "track" &&
      Math.hypot(goal.x - this.position.x, goal.z - this.position.z) < 1.5
    ) {
      // Network poses are already smoothed: follow exactly, glide only to rejoin.
      this.position.set(goal.x, 0, goal.z);
    } else {
      const k = 1 - Math.exp(-delta * 7);
      this.position.x += (goal.x - this.position.x) * k;
      this.position.z += (goal.z - this.position.z) * k;
    }
    const moved = Math.hypot(
      this.position.x - previousX,
      this.position.z - previousZ,
    );
    const instant = delta > 0 ? moved / delta : 0;
    this.speed +=
      (Math.min(instant, 5) - this.speed) * (1 - Math.exp(-delta * 10));
    const walking = T.MathUtils.clamp(this.speed / 2.4, 0, 1);
    let targetYaw = goal.yaw;
    if (mode === "walk" && moved > delta * 0.4)
      targetYaw = Math.atan2(
        -(this.position.x - previousX),
        -(this.position.z - previousZ),
      );
    if (look)
      targetYaw = Math.atan2(
        -(look.x - this.position.x),
        -(look.z - this.position.z),
      );
    this.yaw = dampAngle(this.yaw, targetYaw, 9, delta);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;

    this.stride += delta * (2 + this.speed * 3.1);
    const swing = Math.sin(this.stride);
    const breathe = Math.sin(time * 2.1 + this.seed) * 0.012;
    this.legLeft.rotation.x = swing * 0.7 * walking;
    this.legRight.rotation.x = -swing * 0.7 * walking;
    this.armLeft.rotation.set(-swing * 0.6 * walking, 0, -0.08 - breathe);
    this.armRight.rotation.set(swing * 0.6 * walking, 0, 0.08 + breathe);
    this.torso.position.y =
      0.68 + Math.abs(Math.cos(this.stride)) * 0.06 * walking + breathe;
    this.torso.rotation.set(0.05 * walking, 0, 0);
    this.body.rotation.z = Math.sin(this.stride) * 0.05 * walking;
    this.body.position.y = 0;
    this.head.rotation.set(
      0,
      Math.sin(time * 0.37 + this.seed) * 0.35 * (1 - walking),
      0,
    );

    if (this.waveTimer > 0) {
      this.waveTimer -= delta;
      this.armRight.rotation.set(-0.2, 0, 2.5 + Math.sin(time * 14) * 0.35);
      this.head.rotation.z = 0.12;
    } else if (this.gesture === "point") {
      this.armRight.rotation.set(1.45, 0, 0.1);
    } else if (this.gesture === "cheer") {
      const hop = Math.abs(Math.sin(time * 6 + this.seed));
      this.body.position.y = hop * 0.32;
      this.armLeft.rotation.set(0, 0, -2.6 - hop * 0.3);
      this.armRight.rotation.set(0, 0, 2.6 + hop * 0.3);
      this.head.rotation.x = -0.2;
    } else if (this.gesture === "sleep") {
      this.head.rotation.set(0.55, 0, 0.18);
      this.armLeft.rotation.set(0.15, 0, 0.12);
      this.armRight.rotation.set(0.15, 0, -0.12);
    } else if (this.gesture === "mourn") {
      this.head.rotation.x = 0.45;
      this.torso.rotation.x = 0.18;
      this.armLeft.rotation.set(0.3, 0, 0.25);
      this.armRight.rotation.set(0.3, 0, -0.25);
    }

    if (this.dying >= 0) {
      this.dying += delta;
      const fall = T.MathUtils.smootherstep(this.dying, 0, 0.7);
      this.body.rotation.x = fall * (Math.PI / 2 - 0.1);
      this.body.position.y = -T.MathUtils.smoothstep(this.dying, 1, 1.8) * 1.2;
      const shrink = 1 - T.MathUtils.smoothstep(this.dying, 1.2, 1.8);
      this.body.scale.setScalar(Math.max(shrink, 0.001));
      if (this.label) this.label.visible = false;
      this.shadow.visible = false;
      if (this.dying >= 1.8) this.root.visible = false;
    } else if (this.label) this.label.visible = true;
  }

  headWorld(target = new T.Vector3()) {
    return target.set(this.position.x, 1.55, this.position.z);
  }

  dispose() {
    this.setLabel(null);
  }
}

export const lookYaw = (from: T.Vector3, to: T.Vector3) =>
  wrap(Math.atan2(-(to.x - from.x), -(to.z - from.z)));
