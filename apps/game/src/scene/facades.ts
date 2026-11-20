import * as T from "three";
import { characters } from "../../shared/rules";
import { Builder, type Materials, rng } from "./kit";
import type { Home } from "./maps/types";
import { trades } from "./trades";

type Facade = { character: number; group: T.Group };

/**
 * Dresses the home behind each seat with its owner's profession: a hanging
 * sign in the profession colours and a trade prop by the door. Facades only
 * change in the lobby; nothing here reacts to night actions.
 */
export class Facades {
  private dressed = new Map<T.Object3D, Facade>();
  private bounds = new WeakMap<T.Object3D, T.Box3>();

  constructor(private materials: Materials) {}

  /** `members[i]` owns home `i`, the one just behind and right of seat `i`. */
  sync(homes: readonly Home[], members: readonly { character: number }[]) {
    for (const [index, { object }] of homes.entries()) {
      const character = members[index]?.character;
      const current = this.dressed.get(object);
      if (current?.character === character) continue;
      if (current) this.undress(object, current);
      if (character === undefined || !characters[character]) continue;
      const group = this.build(character, this.footprint(object));
      object.add(group);
      this.dressed.set(object, { character, group });
    }
  }

  dispose() {
    for (const [object, facade] of this.dressed) this.undress(object, facade);
  }

  private undress(object: T.Object3D, { group }: Facade) {
    object.remove(group);
    for (const child of group.children)
      if (child instanceof T.Mesh) child.geometry.dispose();
    this.dressed.delete(object);
  }

  /** The home's own extent, measured once before any facade is attached. */
  private footprint(object: T.Object3D) {
    const known = this.bounds.get(object);
    if (known) return known;
    object.updateWorldMatrix(true, true);
    const inverse = object.matrixWorld.clone().invert();
    const box = new T.Box3();
    const part = new T.Box3();
    object.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      node.geometry.computeBoundingBox();
      if (!node.geometry.boundingBox) return;
      part
        .copy(node.geometry.boundingBox)
        .applyMatrix4(inverse.clone().multiply(node.matrixWorld));
      box.union(part);
    });
    if (box.isEmpty())
      box.set(new T.Vector3(-2, 0, -2), new T.Vector3(2, 3, 2));
    this.bounds.set(object, box);
    return box;
  }

  private build(character: number, box: T.Box3) {
    const look = characters[character];
    const solid = new Builder(rng(31 + character), 0.04);
    const glow = new Builder(rng(7), 0);
    // Local +X points back toward the owner's seat, so the sign and the prop
    // both stand on that side of the door.
    const front = box.max.z + 0.35;
    const side = T.MathUtils.clamp(box.max.x, 1.2, 2.6);
    signpost(solid, glow, look.color, look.trim, side + 0.35, front);
    const prop = new Builder(rng(53 + character), 0.04);
    const propGlow = new Builder(rng(11), 0);
    trades[look.id](prop, propGlow);
    const group = new T.Group();
    for (const [builder, material, x] of [
      [solid, this.materials.solid, 0],
      [glow, this.materials.glow, 0],
      [prop, this.materials.solid, side * 0.6],
      [propGlow, this.materials.glow, side * 0.6],
    ] as const) {
      if (!builder.size) continue;
      const mesh = new T.Mesh(builder.build(), material);
      mesh.position.set(x, 0, x ? front + 0.25 : 0);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    group.matrixAutoUpdate = false;
    group.updateMatrix();
    return group;
  }
}

/**
 * A post with an arm and a board in the profession colours. The painted panel
 * is unlit so the colour reads the same at dusk and at night, for every home.
 */
function signpost(
  b: Builder,
  g: Builder,
  color: string,
  trim: string,
  x: number,
  z: number,
) {
  b.box("#4a3324", [0.14, 2.4, 0.14], [x, 1.2, z]);
  b.box("#4a3324", [1, 0.1, 0.1], [x - 0.45, 2.25, z]);
  for (const offset of [-0.78, -0.22])
    b.box("#2f2a28", [0.02, 0.2, 0.02], [x + offset, 2.1, z]);
  b.box(trim, [0.84, 0.6, 0.08], [x - 0.5, 1.72, z]);
  g.box(color, [0.7, 0.46, 0.1], [x - 0.5, 1.72, z]);
}
