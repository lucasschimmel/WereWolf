import * as T from "three";
import type { Role } from "../../shared/rules";
import { Builder, type Materials, rng } from "./kit";
import { interiorOrigin } from "./layout";

const plank = ["#6b4a35", "#5f412f", "#744f38", "#583c2b"];

function backdrop() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new T.CanvasTexture(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, 384);
  sky.addColorStop(0, "#070b1d");
  sky.addColorStop(0.65, "#1f2f57");
  sky.addColorStop(1, "#33395c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 384);
  const random = rng(77);
  for (let index = 0; index < 140; index++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.7})`;
    ctx.fillRect(random() * 512, random() * 220, 1.5, 1.5);
  }
  const moon = ctx.createRadialGradient(360, 90, 0, 360, 90, 90);
  moon.addColorStop(0, "rgba(255,244,220,1)");
  moon.addColorStop(0.32, "rgba(255,244,220,1)");
  moon.addColorStop(0.36, "rgba(170,190,255,0.35)");
  moon.addColorStop(1, "rgba(170,190,255,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(250, 0, 220, 200);
  ctx.fillStyle = "#151b33";
  ctx.beginPath();
  ctx.moveTo(0, 290);
  for (let x = 0; x <= 512; x += 32)
    ctx.lineTo(x, 250 + Math.sin(x * 0.02) * 26 + random() * 14);
  ctx.lineTo(512, 384);
  ctx.lineTo(0, 384);
  ctx.fill();
  ctx.fillStyle = "#0b0f1f";
  for (let x = -10; x < 530; x += 18 + random() * 16) {
    const height = 50 + random() * 60;
    ctx.beginPath();
    ctx.moveTo(x, 384);
    ctx.lineTo(x + 14, 384 - height);
    ctx.lineTo(x + 28, 384);
    ctx.fill();
  }
  for (const [x, w] of [
    [60, 70],
    [190, 56],
    [330, 80],
  ]) {
    ctx.fillStyle = "#10142a";
    ctx.fillRect(x, 300, w, 84);
    ctx.beginPath();
    ctx.moveTo(x - 8, 300);
    ctx.lineTo(x + w / 2, 262);
    ctx.lineTo(x + w + 8, 300);
    ctx.fill();
    ctx.fillStyle = "#ffbf63";
    ctx.fillRect(x + 12, 318, 12, 14);
    ctx.fillRect(x + w - 24, 318, 12, 14);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export class Interior {
  readonly group = new T.Group();
  readonly candle: T.PointLight;
  private flame: T.Mesh;
  private props = new Map<string, T.Object3D>();
  private backdrop: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  private glowMaterial = new T.MeshBasicMaterial({ vertexColors: true });
  private role: Role | undefined;

  constructor(
    private scene: T.Scene,
    materials: Materials,
  ) {
    const random = rng(61);
    const room = new Builder(random, 0.06);
    const glow = new Builder(random, 0);
    for (let index = 0; index < 12; index++)
      room.box(
        plank[index % plank.length],
        [0.5, 0.08, 6],
        [-2.75 + index * 0.5, 0, 0],
      );
    for (let index = 0; index < 12; index++) {
      const x = -2.75 + index * 0.5;
      if (Math.abs(x) < 0.9) {
        room.box(
          plank[index % plank.length],
          [0.5, 1.1, 0.14],
          [x, 0.55, -2.8],
        );
        room.box(
          plank[index % plank.length],
          [0.5, 0.95, 0.14],
          [x, 2.75, -2.8],
        );
      } else
        room.box(
          plank[index % plank.length],
          [0.5, 3.3, 0.14],
          [x, 1.65, -2.8],
        );
    }
    for (const side of [-1, 1])
      room.box("#5a3e2e", [0.14, 3.3, 6], [side * 3, 1.65, 0]);
    room.box("#4a3326", [6.2, 0.12, 6.2], [0, 3.3, 0]);
    for (let beam = 0; beam < 4; beam++)
      room.box("#3b2a20", [6.1, 0.22, 0.22], [0, 3.15, -2.2 + beam * 1.5]);
    room.box("#3b2a20", [1.6, 0.12, 0.22], [0, 1.12, -2.72]);
    room.box("#3b2a20", [1.6, 0.12, 0.22], [0, 2.3, -2.72]);
    for (const x of [-0.78, 0.78])
      room.box("#3b2a20", [0.12, 1.3, 0.22], [x, 1.7, -2.72]);
    room.box("#3b2a20", [0.06, 1.2, 0.12], [0, 1.7, -2.74]);
    room.box("#3b2a20", [1.5, 0.06, 0.12], [0, 1.7, -2.74]);
    for (const x of [-1.05, 1.05])
      room.box("#7c2f2f", [0.38, 1.6, 0.06], [x, 1.75, -2.65]);
    room.box("#6e4f39", [1.9, 0.1, 1.05], [0, 0.82, -1.35]);
    for (const x of [-0.8, 0.8])
      for (const z of [-1.75, -0.95])
        room.box("#553a2a", [0.1, 0.8, 0.1], [x, 0.4, z]);
    room.cylinder(
      "#8a3b34",
      [1.25, 1.25, 0.03],
      [0, 0.05, -0.6],
      undefined,
      16,
    );
    room.cylinder(
      "#c99a5b",
      [0.95, 0.95, 0.035],
      [0, 0.055, -0.6],
      undefined,
      16,
    );
    room.box("#553a2a", [1.2, 0.45, 2.3], [-2.25, 0.22, 0.7]);
    room.box("#e8dfcc", [1.1, 0.18, 2.1], [-2.25, 0.53, 0.7]);
    room.box("#7d3c4a", [1.15, 0.12, 1.4], [-2.25, 0.63, 1.05]);
    room.box("#efe7d6", [0.7, 0.14, 0.4], [-2.25, 0.66, -0.1]);
    room.box("#553a2a", [1.2, 1.1, 0.12], [-2.25, 0.55, -0.45]);
    room.box("#5a3e2e", [0.4, 0.05, 1.8], [2.75, 1.9, -0.6]);
    room.box("#5a3e2e", [0.4, 0.05, 1.8], [2.75, 1.35, -0.6]);
    for (let index = 0; index < 5; index++)
      room.box(
        ["#7d3c3c", "#3c5a7d", "#6b7d3c", "#7d6a3c", "#5a3c7d"][index],
        [0.3, 0.38, 0.1],
        [2.75, 1.57, -1.3 + index * 0.13],
      );
    for (let index = 0; index < 3; index++)
      room.cylinder(
        "#9aa6a0",
        [0.09, 0.1, 0.26],
        [2.75, 2.06, -0.9 + index * 0.35],
        undefined,
        7,
      );
    room.cylinder(
      "#efe6d2",
      [0.05, 0.05, 0.22],
      [0.55, 0.98, -1.25],
      undefined,
      8,
    );
    room.cylinder(
      "#9a7a40",
      [0.11, 0.13, 0.04],
      [0.55, 0.88, -1.25],
      undefined,
      8,
    );
    room.box("#4b3428", [0.5, 0.06, 0.5], [0, 0.48, 1.5]);
    this.group.add(new T.Mesh(room.build(), materials.solid));
    glow.cone("#ffd27a", 0.035, 0.11, [0, 0, 0], undefined, 6);
    this.flame = new T.Mesh(glow.build(), this.glowMaterial);
    this.flame.position.set(0.55, 1.15, -1.25);
    this.group.add(this.flame);

    this.backdrop = new T.Mesh(
      new T.PlaneGeometry(4.6, 3.45),
      new T.MeshBasicMaterial({ map: backdrop(), fog: false }),
    );
    this.backdrop.position.set(0, 1.9, -4.2);
    this.group.add(this.backdrop);

    const prop = (name: string, build: (b: Builder, g: Builder) => void) => {
      const b = new Builder(random, 0.04);
      const g = new Builder(random, 0);
      build(b, g);
      const group = new T.Group();
      group.add(new T.Mesh(b.build(), materials.solid));
      if (g.size) group.add(new T.Mesh(g.build(), this.glowMaterial));
      group.visible = false;
      this.props.set(name, group);
      this.group.add(group);
    };
    prop("seer", (b, g) => {
      b.cylinder(
        "#4a3a5a",
        [0.12, 0.18, 0.12],
        [-0.25, 0.93, -1.35],
        undefined,
        8,
      );
      g.ball("#9d7bff", 0.2, [-0.25, 1.17, -1.35], undefined, 2);
    });
    prop("wolf", (b) => {
      for (let claw = 0; claw < 4; claw++)
        b.box(
          "#24161a",
          [0.06, 0.9, 0.02],
          [1.6 + claw * 0.18, 1.8 - claw * 0.05, -2.72],
          [0, 0, 0.35],
        );
      b.box("#cfc6b8", [0.25, 0.1, 0.12], [-0.3, 0.9, -1.4], [0, 0.5, 0]);
      b.box("#cfc6b8", [0.18, 0.06, 0.08], [-0.15, 0.89, -1.2], [0, -0.4, 0]);
    });
    prop("witch", (b, g) => {
      g.ball("#6be08a", 0.13, [-0.35, 1.0, -1.35], undefined, 1);
      b.cylinder(
        "#3c4a3e",
        [0.04, 0.05, 0.14],
        [-0.35, 1.17, -1.35],
        undefined,
        6,
      );
      g.ball("#d24a7a", 0.11, [-0.05, 0.98, -1.45], undefined, 1);
      b.cylinder(
        "#4a2e3a",
        [0.035, 0.045, 0.12],
        [-0.05, 1.12, -1.45],
        undefined,
        6,
      );
      b.cylinder("#2d2a2a", [0.22, 0.18, 0.2], [2.3, 0.1, -2.2], undefined, 9);
    });
    prop("guard", (b) => {
      b.cylinder(
        "#5d6b85",
        [0.5, 0.5, 0.06],
        [-1.8, 1.9, -2.7],
        [Math.PI / 2, 0, 0],
        12,
      );
      b.box("#d2a458", [0.1, 0.8, 0.07], [-1.8, 1.9, -2.66]);
      b.box("#d2a458", [0.8, 0.1, 0.07], [-1.8, 1.9, -2.66]);
    });
    prop("hunter", (b) => {
      b.box("#5d4534", [1.3, 0.1, 0.08], [-1.8, 1.9, -2.7], [0, 0, 0.1]);
      b.box("#3b2a20", [0.06, 0.9, 0.06], [-1.25, 1.95, -2.66]);
      b.box("#d9d2c0", [0.02, 0.9, 0.02], [-1.35, 1.95, -2.64]);
      b.box("#8a7a5a", [0.4, 0.3, 0.3], [-0.3, 0.98, -1.35]);
    });
    prop("jester", (b) => {
      b.cone("#c94a6a", 0.12, 0.38, [-0.4, 1.08, -1.3], [0, 0, 0.6], 6);
      b.cone("#e3c24a", 0.12, 0.38, [-0.2, 1.08, -1.3], [0, 0, -0.6], 6);
      b.ball("#f4e7a8", 0.045, [-0.57, 1.18, -1.3]);
      b.ball("#f4e7a8", 0.045, [-0.03, 1.18, -1.3]);
    });
    prop("villager", (b) => {
      b.ball("#c48a4e", [0.22, 0.1, 0.13], [-0.3, 0.92, -1.35]);
      b.cylinder(
        "#7a6a5a",
        [0.07, 0.07, 0.15],
        [0.05, 0.95, -1.5],
        undefined,
        8,
      );
    });

    this.candle = new T.PointLight("#ffb46b", 0, 9, 1.4);
    this.candle.position
      .copy(interiorOrigin)
      .add(new T.Vector3(0.55, 1.4, -1.2));
    scene.add(this.candle);
    this.group.position.copy(interiorOrigin);
    this.group.visible = false;
    scene.add(this.group);
  }

  setRole(role: Role | undefined) {
    if (role === this.role) return;
    this.role = role;
    const key = !role
      ? ""
      : role.startsWith("custom:") || !this.props.has(role)
        ? "villager"
        : role;
    for (const [name, group] of this.props) group.visible = name === key;
    this.backdrop.material.color.set(role === "wolf" ? "#ff8f84" : "#ffffff");
  }

  get pose() {
    return {
      position: interiorOrigin.clone().add(new T.Vector3(0.15, 1.38, 1.45)),
      target: interiorOrigin.clone().add(new T.Vector3(-0.05, 1.12, -1.6)),
    };
  }

  update(time: number, active: boolean) {
    this.group.visible = active;
    const flicker =
      0.85 + Math.sin(time * 11) * 0.08 + Math.sin(time * 27.3) * 0.05;
    this.candle.intensity = active ? 7 * flicker : 0;
    this.flame.scale.set(1, flicker, 1);
    this.glowMaterial.color.setScalar(2.2 + Math.sin(time * 2.4) * 0.5);
  }

  dispose() {
    this.scene.remove(this.group, this.candle);
    this.backdrop.material.map?.dispose();
    this.glowMaterial.dispose();
  }
}
