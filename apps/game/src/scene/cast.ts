import * as T from "three";
import type { Camp, Outcome, Phase } from "../../shared/rules";
import { isFree, seatPhases, type View } from "./choreography";
import type { Particles } from "./fx";
import { type Pose, plazaRadius, seat } from "./layout";
import { Puppet, type PuppetFactory } from "./puppets";
import type { Seats } from "./seats";

export type SceneMember = {
  id: string;
  name: string;
  character: number;
  alive: boolean;
  host: boolean;
  ready: boolean;
  role?: string;
  camp?: Camp;
  mate: boolean;
};

type Wanderer = { puppet: Puppet; goal: Pose; wait: number };

/** Owns every villager puppet: lifecycle, deaths, gestures and goals. */
export class Cast {
  readonly puppets = new Map<string, Puppet>();
  private alive = new Map<string, boolean>();
  private ready = new Map<string, boolean>();
  private dusted = new Set<number>();
  private wanderers: Wanderer[] = [];
  private seed = 1;

  constructor(
    private scene: T.Scene,
    private factory: PuppetFactory,
    private seats: Seats,
    private dust: Particles,
    private shadows: boolean,
  ) {}

  private random() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  populateShowcase() {
    for (let index = 0; index < 8; index++) {
      const puppet = new Puppet(
        `npc-${index}`,
        index,
        this.factory,
        this.shadows,
      );
      this.scene.add(puppet.root);
      this.wanderers.push({
        puppet,
        goal: seat(index, 8),
        wait: this.random() * 3,
      });
    }
  }

  /** Creates, replaces and buries puppets to match the room roster. */
  sync(
    members: SceneMember[],
    phase: Phase | undefined,
    view: View,
    onDeath: () => void,
  ) {
    const seen = new Set<string>();
    for (const [index, member] of members.entries()) {
      seen.add(member.id);
      let puppet = this.puppets.get(member.id);
      if (
        !puppet ||
        puppet.character !== member.character ||
        (member.alive && puppet.falling)
      ) {
        if (puppet) this.remove(puppet);
        puppet = new Puppet(
          member.id,
          member.character,
          this.factory,
          this.shadows,
        );
        this.puppets.set(member.id, puppet);
        this.scene.add(puppet.root);
      }
      const before = this.alive.get(member.id);
      if (before === undefined) {
        if (!member.alive) this.seats.bury(index, -1);
      } else if (before && !member.alive) {
        if (phase === "dawn" || view === "interior" || !puppet.root.visible)
          this.seats.bury(index, 3.4);
        else {
          puppet.fall();
          this.seats.bury(index, 1.5);
          onDeath();
        }
      } else if (!before && member.alive) {
        this.seats.revive(index);
        this.dusted.delete(index);
      }
      this.alive.set(member.id, member.alive);
      if (this.ready.get(member.id) === false && member.ready && !phase)
        puppet.wave();
      this.ready.set(member.id, member.ready);
    }
    for (const [id, puppet] of this.puppets)
      if (!seen.has(id)) {
        this.remove(puppet);
        this.puppets.delete(id);
        this.alive.delete(id);
        this.ready.delete(id);
      }
    for (let index = 0; index < members.length; index++)
      if (!this.dusted.has(index) && this.seats.rising(index)) {
        this.dusted.add(index);
        this.burst(this.seats.tombTop(index));
      }
  }

  burst(at: T.Vector3) {
    const velocity = new T.Vector3();
    for (let index = 0; index < 22; index++) {
      const angle = this.random() * Math.PI * 2;
      const speed = 0.6 + this.random() * 1.6;
      velocity.set(
        Math.cos(angle) * speed,
        1 + this.random() * 1.8,
        Math.sin(angle) * speed,
      );
      this.dust.emit(
        at,
        velocity,
        0.9 + this.random() * 0.6,
        0.5 + this.random() * 0.5,
      );
    }
  }

  update(
    delta: number,
    time: number,
    context: {
      members: SceneMember[];
      me: string;
      phase?: Phase;
      view: View;
      self: Pose;
      positions: Map<string, Pose>;
      selected?: string;
      pointing: boolean;
      outcome?: Outcome;
      /** Players shown awake on the square during a night turn (the pack). */
      awake: string[];
      /** Live aims of other awake players, by player id. */
      aims: Record<string, string>;
    },
  ) {
    for (const wanderer of this.wanderers) this.wander(wanderer, delta, time);
    const { members, me, phase, view, self, positions, selected, outcome } =
      context;
    const count = members.length;
    const seated = phase !== undefined && seatPhases.has(phase);
    const winner = outcome && outcome !== "draw" ? outcome : undefined;
    const target = selected ? this.puppets.get(selected) : undefined;
    for (const [index, member] of members.entries()) {
      const puppet = this.puppets.get(member.id);
      if (!puppet) continue;
      puppet.setLabel(
        member.id === me
          ? null
          : {
              name: member.name,
              alive: member.alive,
              host: member.host,
              ready: phase ? undefined : member.ready,
              mate: member.mate,
              role: member.role,
              camp: member.camp,
            },
      );
      const asleep =
        phase === "night" &&
        member.id !== me &&
        !context.awake.includes(member.id);
      puppet.setGhost(asleep);
      const aim =
        member.id === me
          ? context.pointing
            ? target
            : undefined
          : this.puppets.get(context.aims[member.id] ?? "");
      puppet.gesture = asleep
        ? "sleep"
        : phase === "ended" && winner && member.camp
          ? member.camp === winner
            ? "cheer"
            : "mourn"
          : aim
            ? "point"
            : "none";
      if (view === "interior" || (!member.alive && !puppet.falling)) {
        puppet.update(delta, time, null, "snap");
        continue;
      }
      if (puppet.falling) {
        puppet.update(
          delta,
          time,
          { x: puppet.position.x, z: puppet.position.z, yaw: puppet.yaw },
          "glide",
        );
        continue;
      }
      if (seated || !isFree(phase)) {
        const look = aim?.root.visible ? aim.position : undefined;
        puppet.update(delta, time, seat(index, count), "walk", look);
      } else if (member.id === me) puppet.update(delta, time, self, "glide");
      else
        puppet.update(
          delta,
          time,
          positions.get(member.id) ?? seat(index, count),
          "track",
        );
    }
  }

  private wander(wanderer: Wanderer, delta: number, time: number) {
    const { puppet, goal } = wanderer;
    const distance = Math.hypot(
      puppet.position.x - goal.x,
      puppet.position.z - goal.z,
    );
    if (distance < 0.25) {
      wanderer.wait -= delta;
      if (wanderer.wait < 0) {
        const angle = this.random() * Math.PI * 2;
        const radius = 3 + this.random() * (plazaRadius - 3.5);
        wanderer.goal = {
          x: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
          yaw: angle,
        };
        wanderer.wait = 1.5 + this.random() * 4;
        if (this.random() < 0.2) puppet.wave();
      }
    }
    puppet.update(delta, time, wanderer.goal, "walk");
  }

  pick(raycaster: T.Raycaster) {
    const roots = [...this.puppets.values()]
      .filter((puppet) => puppet.root.visible && !puppet.falling)
      .map((puppet) => puppet.root);
    for (const hit of raycaster.intersectObjects(roots, true))
      for (let node: T.Object3D | null = hit.object; node; node = node.parent)
        if (typeof node.userData.player === "string")
          return node.userData.player as string;
    return undefined;
  }

  ownPosition(me: string) {
    return this.puppets.get(me)?.position;
  }

  private remove(puppet: Puppet) {
    this.scene.remove(puppet.root);
    puppet.dispose();
  }

  dispose() {
    for (const puppet of this.puppets.values()) this.remove(puppet);
    for (const { puppet } of this.wanderers) this.remove(puppet);
    this.puppets.clear();
    this.wanderers = [];
  }
}
