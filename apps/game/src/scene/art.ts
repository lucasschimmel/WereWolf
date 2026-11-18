import * as T from "three";
import { characters } from "../../shared/rules";

const palette = new Map<string, T.MeshStandardMaterial>();
function material(color: string) {
  let entry = palette.get(color);
  if (!entry) {
    entry = new T.MeshStandardMaterial({ color, roughness: 0.95 });
    palette.set(color, entry);
  }
  return entry;
}
const unitBox = new T.BoxGeometry(1, 1, 1);
const cones = new Map<number, T.ConeGeometry>();
export function box(
  parent: T.Object3D,
  color: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new T.Mesh(unitBox, material(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function cone(
  parent: T.Object3D,
  color: string,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  sides = 7,
) {
  let geometry = cones.get(sides);
  if (!geometry) {
    geometry = new T.ConeGeometry(1, 1, sides);
    cones.set(sides, geometry);
  }
  const mesh = new T.Mesh(geometry, material(color));
  mesh.scale.set(r, h, r);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
export function batchScenery(scene: T.Scene) {
  const groups = new Map<string, T.Mesh[]>();
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material)) return;
    const key = `${node.geometry.uuid}:${node.material.uuid}`;
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  });
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const { geometry, material } = meshes[0];
    const batch = new T.InstancedMesh(geometry, material, meshes.length);
    for (const [index, mesh] of meshes.entries()) {
      batch.setMatrixAt(index, mesh.matrixWorld);
      mesh.removeFromParent();
    }
    scene.add(batch);
  }
}

export function seatLantern() {
  const stand = new T.Group();
  box(stand, "#574743", 0.34, 0.62, 0.34, 0, 0.31, 0);
  box(stand, "#3e3236", 0.33, 0.32, 0.33, 0, 0.75, 0);
  const flame = new T.Mesh(
    unitBox,
    new T.MeshBasicMaterial({ color: "#efae59" }),
  );
  flame.scale.set(0.24, 0.19, 0.34);
  flame.position.y = 0.75;
  stand.add(flame);
  return { stand, flame };
}
export function village(scene: T.Scene) {
  box(scene, "#565f4d", 95, 0.3, 95, 0, -0.16, 0);
  const plaza = new T.Mesh(
    new T.CylinderGeometry(10.5, 10.5, 0.12, 48),
    material("#76736a"),
  );
  plaza.position.y = -0.055;
  scene.add(plaza);
  const tiles = ["#77746a", "#7b776c", "#6d6d63", "#858074"];
  for (let x = -10; x <= 10; x++)
    for (let z = -10; z <= 10; z++) {
      if (Math.hypot(x, z) > 10) continue;
      box(
        scene,
        tiles[Math.abs(x * 37 + z * 17) % tiles.length],
        0.92,
        0.022,
        0.92,
        x,
        0,
        z,
      );
    }
  const cottages = [
    "#774b43",
    "#77754f",
    "#886253",
    "#44646a",
    "#846751",
    "#8d7861",
    "#6b514c",
    "#5b695e",
  ];
  for (const [index, color] of cottages.entries()) {
    const angle = (index * Math.PI) / 4;
    const house = new T.Group();
    house.position.set(Math.sin(angle) * 15, 0, Math.cos(angle) * 15);
    house.rotation.y = angle + Math.PI;
    scene.add(house);
    box(house, "#77726c", 4.7, 0.65, 3.9, 0, 0.3, 0);
    box(house, color, 4.45, 3.05, closeDepth(index), 0, 2, 0);
    const roof = cone(house, "#382e36", 3.65, 2.3, 0, 4.57, 0, 4);
    roof.rotation.y = Math.PI / 4;
    box(house, "#544443", 0.55, 1.85, 0.65, 1.23, 4.48, -0.83);
    box(house, "#342723", 0.92, 1.72, 0.08, 0, 1.22, 1.78);
    for (const x of [-1.48, 1.48]) {
      box(house, "#402e34", 0.86, 0.95, 0.16, x, 2.28, 1.78);
      box(house, "#e5b466", 0.62, 0.7, 0.18, x, 2.28, 1.83);
      box(house, "#5d4140", 0.055, 0.72, 0.19, x, 2.28, 1.87);
      box(house, "#5d4140", 0.63, 0.055, 0.19, x, 2.28, 1.87);
    }
    const post = new T.Group();
    post.position.set(
      Math.sin(angle + 0.16) * 11.1,
      0,
      Math.cos(angle + 0.16) * 11.1,
    );
    scene.add(post);
    box(post, "#584435", 0.14, 2.55, 0.14, 0, 1.27, 0);
    lantern(post, 0, 2.53, 0);
  }
  for (let index = 0; index < 96; index++) {
    const angle = index * 2.39996,
      radius = 19 + (index % 9) * 2.05;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius,
      h = 3.7 + (index % 7) * 0.55;
    box(scene, "#4e453d", 0.32, h * 0.58, 0.32, x, h * 0.29, z);
    cone(
      scene,
      index % 2 === 0 ? "#354e45" : "#405a49",
      h * 0.35,
      h * 0.67,
      x,
      h * 0.63,
      z,
      6,
    );
    cone(scene, "#3b554c", h * 0.27, h * 0.62, x, h * 0.9, z, 6);
  }
  const well = new T.Mesh(
    new T.CylinderGeometry(1.02, 1.04, 0.78, 10, 1, true),
    material("#68615f").clone(),
  );
  well.material.side = T.DoubleSide;
  well.position.set(0, 0.4, 0);
  scene.add(well);
  const water = new T.Mesh(new T.CircleGeometry(0.93, 24), material("#324c53"));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.24;
  scene.add(water);
  for (const x of [-0.86, 0.86])
    box(scene, "#614938", 0.15, 2.3, 0.16, x, 1.15, 0);
  const roof = cone(scene, "#654649", 1.58, 0.75, 0, 2.47, 0, 4);
  roof.rotation.y = Math.PI / 4;
}
function closeDepth(index: number) {
  return 3.5 + (index % 2) * 0.04;
}
function lantern(parent: T.Object3D, x: number, y: number, z: number) {
  box(parent, "#6c5140", 0.31, 0.38, 0.31, x, y, z);
  for (const sign of [-1, 1])
    box(parent, "#ffc371", 0.22, 0.24, 0.03, x, y, z + sign * 0.158);
  box(parent, "#ffc371", 0.31, 0.23, 0.2, x, y, z);
  box(parent, "#43333b", 0.4, 0.06, 0.4, x, y + 0.21, z);
}
export function cabin(scene: T.Scene) {
  const cabin = new T.Group();
  cabin.position.set(0, 0, 100);
  scene.add(cabin);
  box(cabin, "#382a29", 12, 0.3, 11, 0, -0.16, 0);
  for (let i = -5; i <= 5; i++) {
    box(cabin, i % 2 ? "#473331" : "#503934", 0.95, 0.05, 10, i, 0, 0);
    box(cabin, i % 2 ? "#513837" : "#583b36", 0.94, 5, 0.2, i, 2.5, -4.8);
  }
  for (const side of [-1, 1])
    box(cabin, "#493432", 0.2, 5, 10, side * 5.35, 2.5, 0);
  box(cabin, "#442e2c", 10.5, 0.2, 10, 0, 4.7, 0);
  box(cabin, "#8a7164", 1.8, 2.2, 0.1, 0, 2.63, -4.65);
  box(cabin, "#32445a", 1.6, 2, 0.12, 0, 2.63, -4.58);
  box(cabin, "#806359", 0.075, 2, 0.14, 0, 2.63, -4.5);
  box(cabin, "#806359", 1.6, 0.075, 0.14, 0, 2.63, -4.5);
  box(cabin, "#654837", 3.2, 0.14, 1.25, 0, 0.9, -1.66);
  for (const x of [-1.35, 1.35])
    box(cabin, "#523831", 0.17, 0.9, 0.9, x, 0.45, -1.66);
  lantern(cabin, -1.0, 1.16, -1.7);
  const light = new T.PointLight("#ffc078", 28, 9);
  light.position.set(-0.8, 1.8, -1.55);
  cabin.add(light);
}
export function pawn(name: string, index: number, isAlive: boolean) {
  const character = characters[index];
  const root = new T.Group();
  const outfit = isAlive ? character.color : "#4b4a50";
  const trim = isAlive ? character.trim : "#666269";
  box(root, outfit, 0.51, 0.74, 0.32, 0, 0.89, 0);
  box(root, trim, 0.06, 0.55, 0.04, 0.09, 0.91, 0.18);
  for (const side of [-1, 1]) {
    const arm = box(root, outfit, 0.15, 0.55, 0.18, side * 0.33, 0.85, 0);
    arm.rotation.z = side * 0.13;
    box(root, "#56453e", 0.18, 0.36, 0.21, side * 0.13, 0.38, 0);
    box(root, "#392e32", 0.2, 0.18, 0.29, side * 0.13, 0.13, 0.04);
    box(root, "#523630", 0.04, 0.04, 0.02, side * 0.083, 1.42, 0.177);
  }
  box(root, "#b9876d", 0.34, 0.35, 0.33, 0, 1.4, 0);
  if (index % 3 === 0) {
    const hat = cone(root, trim, 0.31, 0.41, 0, 1.77, 0, 7);
    hat.rotation.z = -0.14;
  } else {
    box(root, trim, index % 3 === 1 ? 0.54 : 0.36, 0.11, 0.43, 0, 1.57, 0);
    box(root, outfit, 0.32, 0.17 + index * 0.014, 0.32, 0, 1.68, 0);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 92;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#141720db";
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 84, 20);
    ctx.fill();
    ctx.font = "600 35px system-ui";
    ctx.fillStyle = isAlive ? "#f5e7cd" : "#b0a8a3";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 256, 47, 473);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthWrite: false }),
    );
    label.position.y = 2.19;
    label.scale.set(1.8, 0.32, 1);
    root.add(label);
  }
  return root;
}
export function freePawn(group: T.Group) {
  group.traverse((item) => {
    if (item instanceof T.Sprite) {
      item.material.map?.dispose();
      item.material.dispose();
    }
  });
}
