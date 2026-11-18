import * as T from "three";
import { Builder, type Materials, rng } from "./kit";
import { terrainHeight } from "./layout";
import type { Budget } from "./quality";

type Circle = { x: number; z: number; r: number };

function terrain(budget: Budget, materials: Materials) {
  const plane = new T.PlaneGeometry(340, 340, budget.terrain, budget.terrain);
  plane.rotateX(-Math.PI / 2);
  const geometry = plane.toNonIndexed();
  plane.dispose();
  const position = geometry.attributes.position as T.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const z = position.getZ(index);
    position.setY(
      index,
      Math.hypot(x, z) < 11 ? -0.06 : terrainHeight(x, z) - 0.02,
    );
  }
  const colors = new Float32Array(position.count * 3);
  const color = new T.Color();
  const palette = {
    meadow: new T.Color("#6f8c46"),
    lush: new T.Color("#5b7a3a"),
    village: new T.Color("#859a58"),
    forest: new T.Color("#4a6533"),
    hill: new T.Color("#6e7b4b"),
    dirt: new T.Color("#8a7052"),
    worn: new T.Color("#7d7650"),
  };
  for (let index = 0; index < position.count; index += 3) {
    const x =
      (position.getX(index) +
        position.getX(index + 1) +
        position.getX(index + 2)) /
      3;
    const z =
      (position.getZ(index) +
        position.getZ(index + 1) +
        position.getZ(index + 2)) /
      3;
    const y =
      (position.getY(index) +
        position.getY(index + 1) +
        position.getY(index + 2)) /
      3;
    const distance = Math.hypot(x, z);
    const noise =
      Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin((x + z) * 0.07);
    color.copy(palette.meadow).lerp(palette.lush, noise * 0.35 + 0.5);
    if (distance < 24) color.lerp(palette.village, 0.45);
    if (distance > 27)
      color.lerp(palette.forest, Math.min(1, (distance - 27) / 12) * 0.7);
    if (y > 4) color.lerp(palette.hill, Math.min(1, (y - 4) / 4));
    if (distance > 10.5 && distance < 12.5) color.lerp(palette.worn, 0.55);
    if (z > 10 && Math.abs(x) < 2.6) color.copy(palette.dirt);
    for (let corner = 0; corner < 3; corner++) {
      colors[(index + corner) * 3] = color.r;
      colors[(index + corner) * 3 + 1] = color.g;
      colors[(index + corner) * 3 + 2] = color.b;
    }
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, materials.solid);
  mesh.receiveShadow = budget.shadows;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function treeGeometries() {
  const random = rng(5);
  const pineHigh = new Builder(random, 0.04)
    .cylinder("#5a4232", [0.14, 0.2, 1.1], [0, 0.55, 0], undefined, 6)
    .cone("#2f5a43", 1.35, 1.7, [0, 1.75, 0], undefined, 7)
    .cone("#376649", 1.05, 1.45, [0, 2.55, 0], [0, 0.4, 0], 7)
    .cone("#3f7350", 0.7, 1.15, [0, 3.3, 0], [0, 0.9, 0], 7)
    .build();
  const pineLow = new Builder(random, 0)
    .cylinder("#5a4232", [0.16, 0.2, 1], [0, 0.5, 0], undefined, 4)
    .cone("#35604a", 1.3, 3.4, [0, 2.3, 0], undefined, 5)
    .build();
  const roundHigh = new Builder(random, 0.04)
    .cylinder("#5d4535", [0.16, 0.24, 1.7], [0, 0.85, 0], undefined, 6)
    .ball("#5a7f3e", [1.2, 1.05, 1.2], [0, 2.4, 0])
    .ball("#6a8f45", 0.85, [0.6, 2.9, 0.3])
    .ball("#4f7438", 0.8, [-0.55, 2.75, -0.35])
    .ball("#73984c", 0.7, [0.1, 3.3, -0.2])
    .build();
  const roundLow = new Builder(random, 0)
    .cylinder("#5d4535", [0.18, 0.24, 1.6], [0, 0.8, 0], undefined, 4)
    .ball("#5e8441", [1.4, 1.3, 1.4], [0, 2.65, 0])
    .build();
  return { pineHigh, pineLow, roundHigh, roundLow };
}

type Placement = { matrix: T.Matrix4; tint: T.Color; pine: boolean };

function instanced(
  geometry: T.BufferGeometry,
  material: T.Material,
  items: Placement[],
  origin: T.Vector3,
) {
  const mesh = new T.InstancedMesh(
    geometry,
    material,
    Math.max(items.length, 1),
  );
  mesh.count = items.length;
  const local = new T.Matrix4();
  const offset = new T.Matrix4().makeTranslation(
    -origin.x,
    -origin.y,
    -origin.z,
  );
  for (const [index, item] of items.entries()) {
    mesh.setMatrixAt(index, local.multiplyMatrices(offset, item.matrix));
    mesh.setColorAt(index, item.tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function blocked(x: number, z: number, avoid: Circle[]) {
  if (z > 8 && Math.abs(x) < 3.4) return true;
  return avoid.some(
    (circle) => Math.hypot(x - circle.x, z - circle.z) < circle.r,
  );
}

export function buildNature(
  budget: Budget,
  materials: Materials,
  avoid: Circle[],
) {
  const group = new T.Group();
  group.add(terrain(budget, materials));
  const random = rng(19);
  const trees = treeGeometries();
  const sectors = 8;
  const chunks = Array.from({ length: sectors * 2 }, () => [] as Placement[]);
  const matrix = new T.Matrix4();
  const quaternion = new T.Quaternion();
  const up = new T.Vector3(0, 1, 0);
  const autumn = new T.Color(1.55, 0.92, 0.45);
  let placed = 0;
  let attempts = 0;
  while (placed < budget.trees && attempts < budget.trees * 6) {
    attempts++;
    const inner = placed < 22;
    const radius = inner ? 19.5 + random() * 5 : 25 + random() ** 0.85 * 52;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocked(x, z, avoid)) continue;
    const scale = (inner ? 0.75 : 0.85) + random() * 0.75;
    const pine = random() > (radius > 45 ? 0.25 : 0.55);
    quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
    const item: Placement = {
      matrix: new T.Matrix4().compose(
        new T.Vector3(x, terrainHeight(x, z) - 0.1, z),
        quaternion.clone(),
        new T.Vector3(scale, scale * (0.9 + random() * 0.3), scale),
      ),
      tint:
        !pine && random() < 0.28
          ? autumn.clone().multiplyScalar(0.9 + random() * 0.2)
          : new T.Color().setScalar(0.85 + random() * 0.3),
      pine,
    };
    const sector =
      Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * sectors) %
      sectors;
    chunks[sector + (radius > 46 ? sectors : 0)].push(item);
    placed++;
  }
  for (const [index, items] of chunks.entries()) {
    if (!items.length) continue;
    const origin = new T.Vector3();
    for (const item of items)
      origin.add(new T.Vector3().setFromMatrixPosition(item.matrix));
    origin.divideScalar(items.length);
    const lod = new T.LOD();
    lod.position.copy(origin);
    const near = new T.Group();
    const far = new T.Group();
    for (const pine of [true, false]) {
      const subset = items.filter((item) => item.pine === pine);
      if (!subset.length) continue;
      const highMesh = instanced(
        pine ? trees.pineHigh : trees.roundHigh,
        materials.wind,
        subset,
        origin,
      );
      highMesh.castShadow = budget.shadows && index < sectors;
      near.add(highMesh);
      far.add(
        instanced(
          pine ? trees.pineLow : trees.roundLow,
          materials.solid,
          subset,
          origin,
        ),
      );
    }
    lod.addLevel(near, 0);
    lod.addLevel(far, index < sectors ? 62 : 48);
    group.add(lod);
  }

  const bushGeometry = new Builder(random, 0.05)
    .ball("#4f7a3a", [0.7, 0.55, 0.7], [0, 0.35, 0])
    .ball("#5e8a42", 0.5, [0.45, 0.45, 0.2])
    .ball("#466e34", 0.45, [-0.4, 0.4, -0.15])
    .build();
  const bushes: Placement[] = [];
  for (let attempt = 0; attempt < 400 && bushes.length < 80; attempt++) {
    const radius = 19 + random() * 9;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocked(x, z, avoid)) continue;
    const scale = 0.7 + random() * 0.8;
    bushes.push({
      matrix: matrix
        .compose(
          new T.Vector3(x, terrainHeight(x, z), z),
          quaternion.setFromAxisAngle(up, random() * 6).clone(),
          new T.Vector3(scale, scale, scale),
        )
        .clone(),
      tint: new T.Color().setScalar(0.85 + random() * 0.3),
      pine: false,
    });
  }
  group.add(instanced(bushGeometry, materials.wind, bushes, new T.Vector3()));

  const rockGeometry = new T.DodecahedronGeometry(1, 0);
  const rockColors = new Float32Array(
    rockGeometry.attributes.position.count * 3,
  ).fill(0.42);
  rockGeometry.setAttribute("color", new T.BufferAttribute(rockColors, 3));
  const rocks: Placement[] = [];
  for (let index = 0; index < 46; index++) {
    const radius = 14 + random() * 50;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocked(x, z, avoid)) continue;
    const scale = 0.3 + random() ** 2 * 1.4;
    rocks.push({
      matrix: new T.Matrix4().compose(
        new T.Vector3(x, terrainHeight(x, z) + scale * 0.2, z),
        new T.Quaternion().setFromEuler(
          new T.Euler(random(), random() * 6, random()),
        ),
        new T.Vector3(scale * 1.3, scale * 0.8, scale),
      ),
      tint: new T.Color().setScalar(0.8 + random() * 0.5),
      pine: false,
    });
  }
  group.add(instanced(rockGeometry, materials.solid, rocks, new T.Vector3()));

  if (budget.grass > 0) {
    const tuft = new Builder(random, 0.1);
    for (let blade = 0; blade < 5; blade++) {
      const angle = (blade / 5) * Math.PI * 2;
      tuft.cone(
        blade % 2 ? "#7fa04f" : "#6a8c42",
        0.06,
        0.55 + (blade % 3) * 0.12,
        [Math.cos(angle) * 0.08, 0.28, Math.sin(angle) * 0.08],
        [Math.sin(angle) * 0.25, 0, Math.cos(angle) * 0.25],
        3,
      );
    }
    const grass: Placement[] = [];
    for (
      let attempt = 0;
      attempt < budget.grass * 3 && grass.length < budget.grass;
      attempt++
    ) {
      const radius = 11.2 + random() ** 1.4 * 30;
      const angle = random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (blocked(x, z, avoid)) continue;
      const scale = 0.6 + random() * 0.8;
      grass.push({
        matrix: new T.Matrix4().compose(
          new T.Vector3(x, terrainHeight(x, z) - 0.05, z),
          new T.Quaternion().setFromAxisAngle(up, random() * 6),
          new T.Vector3(scale, scale, scale),
        ),
        tint: new T.Color().setScalar(0.8 + random() * 0.4),
        pine: false,
      });
    }
    group.add(instanced(tuft.build(), materials.wind, grass, new T.Vector3()));
  }

  const flowerGeometry = new T.IcosahedronGeometry(0.1, 0);
  flowerGeometry.setAttribute(
    "color",
    new T.BufferAttribute(
      new Float32Array(flowerGeometry.attributes.position.count * 3).fill(1),
      3,
    ),
  );
  const petals = ["#e8584f", "#f2c14e", "#f6f1e7", "#c86fb0", "#7ea6e0"].map(
    (hex) => new T.Color(hex),
  );
  const blooms: Placement[] = [];
  for (let patch = 0; patch < 26; patch++) {
    const radius = 11.8 + random() * 14;
    const angle = random() * Math.PI * 2;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const petal = petals[patch % petals.length];
    for (let index = 0; index < 9; index++) {
      const x = cx + (random() - 0.5) * 2.2;
      const z = cz + (random() - 0.5) * 2.2;
      if (blocked(x, z, avoid)) continue;
      blooms.push({
        matrix: new T.Matrix4().makeTranslation(
          x,
          terrainHeight(x, z) + 0.2,
          z,
        ),
        tint: petal,
        pine: false,
      });
    }
  }
  group.add(
    instanced(flowerGeometry, materials.solid, blooms, new T.Vector3()),
  );

  const peaks = new Builder(random, 0.05);
  for (let index = 0; index < 28; index++) {
    const angle = (index / 28) * Math.PI * 2 + random() * 0.15;
    const distance = 175 + random() * 50;
    const height = 35 + random() * 50;
    const radius = 28 + random() * 22;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    peaks.cone(
      index % 2 ? "#4b5670" : "#56617b",
      radius,
      height,
      [x, height / 2 - 4, z],
      [0, random() * 3, 0],
      5,
    );
    if (height > 62)
      peaks.cone(
        "#dfe3ea",
        radius * 0.32,
        height * 0.32,
        [x, height * 0.84 - 4, z],
        [0, random() * 3, 0],
        5,
      );
  }
  const range = new T.Mesh(peaks.build(), materials.solid);
  range.matrixAutoUpdate = false;
  group.add(range);
  return { group };
}
