import * as T from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Outcome, Phase, Role } from "../../shared/rules";
import type { MotionFeed } from "../net/motion";
import { useControls } from "../store";
import { Cast, type SceneMember } from "./cast";
import {
  followPose,
  isFree,
  lookFor,
  orbitPose,
  seatPhases,
  seatPose,
  transition,
  type View,
} from "./choreography";
import { type CameraPose, Director } from "./director";
import { buildNature } from "./forest";
import { haloField, haloMaterial, Motes, Particles, VoteArcs } from "./fx";
import { buildVillage } from "./hamlet";
import { Input } from "./input";
import { Interior } from "./interior";
import { createMaterials, disposeMaterials, disposeTree, softDot } from "./kit";
import {
  clampToPlaza,
  dampAngle,
  facing,
  type Pose,
  seat,
  towerPosition,
} from "./layout";
import { PuppetFactory } from "./puppets";
import { budgets, FrameGovernor, type Tier } from "./quality";
import { Seats } from "./seats";
import { Atmosphere } from "./sky";

export type { SceneMember };
export type SceneEvent = {
  cycle: number;
  label: string;
  deaths?: string[];
  votes?: Record<string, string>;
};
export type SceneState = {
  showcase: boolean;
  members: SceneMember[];
  me: string;
  /** Remote movement, sampled every frame (absent in the showcase). */
  motion?: MotionFeed;
  phase?: Phase;
  events: SceneEvent[];
  role?: Role;
  outcome?: Outcome;
  targets: string[];
  selected?: string;
  /** True while this player must point at someone on the square at night. */
  aiming?: boolean;
  /** Other players shown awake on the square during this night turn. */
  awake?: string[];
  /** Live aims of the other awake players (the pack's ballots). */
  aims?: Record<string, string>;
  onSelect: (id: string) => void;
  /** Abstain or pass the current pointing, when the action allows it. */
  onPass?: () => void;
};

/** Owns the renderer and orchestrates the village, its puppets and the camera. */
export class Stage {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(55, 1, 0.1, 700);
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private materials;
  private atmosphere: Atmosphere;
  private village;
  private seats: Seats;
  private interior: Interior;
  private motes: Motes;
  private smoke = new Particles(90, "#d9d4cc", 0.12, 2.6, 1.4);
  private dust = new Particles(90, "#cdb894", -2.6, 1.3, 1);
  private arcs = new VoteArcs();
  private halos: T.Points;
  private pointMaterials: T.ShaderMaterial[];
  private factory: PuppetFactory;
  private cast: Cast;
  private director = new Director();
  private input: Input;
  private governor: FrameGovernor;
  private observer: ResizeObserver;
  private raycaster = new T.Raycaster();
  private view: View = "village";
  private self: Pose = { x: 0, z: 7, yaw: 0 };
  private cameraYaw = 0;
  private cameraPitch = 0.15;
  private seatLook = 0;
  private orbit = { offset: 0, lift: 0.35 };
  private interiorLook = { yaw: 0, pitch: 0 };
  private started = false;
  private phase?: Phase;
  private eventCount = 0;
  private verdict = false;
  private bellSwing = 0;
  private smokeTimer = 0;
  private sentAt = 0;
  private lastSent?: Pose;
  private hoverAt = 0;
  private hoverId?: string;
  private focusId?: string;
  private compact = false;
  private last = 0;
  private placed = false;
  private positions = new Map<string, Pose>();

  constructor(
    private container: HTMLElement,
    private tier: Tier,
    private state: SceneState,
    private veil: HTMLElement,
  ) {
    const budget = budgets[tier];
    this.renderer = new T.WebGLRenderer({
      antialias: budget.antialias,
      powerPreference: "high-performance",
    });
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = budget.shadows;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.governor = new FrameGovernor(
      Math.min(window.devicePixelRatio, budget.dpr),
      budget.dpr,
      budget.bloom,
    );
    this.renderer.setPixelRatio(this.governor.dpr);
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Village en 3D. ZQSD ou WASD pour marcher, glisser pour tourner la caméra.",
    );
    container.prepend(canvas);

    this.materials = createMaterials(tier);
    this.atmosphere = new Atmosphere(this.scene, budget, this.materials);
    this.village = buildVillage(budget, this.materials);
    this.scene.add(this.village.group);
    const avoid = [
      { x: towerPosition.x, z: towerPosition.z, r: 4.6 },
      { x: 0, z: 0, r: 11.4 },
      ...this.village.group.children
        .filter((child) => child instanceof T.LOD)
        .map((child) => ({ x: child.position.x, z: child.position.z, r: 4.2 })),
    ];
    this.scene.add(buildNature(budget, this.materials, avoid).group);
    const halo = haloMaterial(1);
    this.halos = haloField(this.village.glowSpots, halo);
    const seatHalo = haloMaterial(1);
    this.seats = new Seats(this.materials, seatHalo);
    this.interior = new Interior(this.scene, this.materials);
    this.motes = new Motes(budget.motes);
    this.scene.add(
      this.halos,
      this.seats.group,
      this.motes.points,
      this.smoke.points,
      this.dust.points,
      this.arcs.group,
    );
    this.pointMaterials = [
      halo,
      seatHalo,
      this.motes.points.material,
      this.smoke.points.material,
      this.dust.points.material,
    ];
    this.factory = new PuppetFactory(this.materials, softDot());
    this.cast = new Cast(
      this.scene,
      this.factory,
      this.seats,
      this.dust,
      budget.shadows,
    );
    if (state.showcase) this.cast.populateShowcase();

    if (budget.bloom) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(
        new T.Vector2(256, 256),
        0.5,
        0.55,
        0.82,
      );
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.input = new Input(canvas, {
      tap: (x, y) => this.tap(x, y),
      pass: () => this.pass(),
      command: (key) => this.command(key),
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    document.fonts?.ready.then(() => {
      for (const puppet of this.cast.puppets.values()) puppet.setLabel(null);
    });
    this.renderer.setAnimationLoop((time) => this.frame(time / 1000));
  }

  setState(state: SceneState) {
    this.state = state;
  }

  private resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.compact = width < 720;
    this.renderer.setPixelRatio(this.governor.dpr);
    this.renderer.setSize(width, height, false);
    this.composer?.setPixelRatio(this.governor.dpr);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const scale = height * this.governor.dpr * 0.5;
    for (const material of this.pointMaterials)
      material.uniforms.uScale.value = scale;
  }

  private me() {
    const index = this.state.members.findIndex(
      (member) => member.id === this.state.me,
    );
    return {
      index,
      member: index >= 0 ? this.state.members[index] : undefined,
    };
  }

  private desired(time: number): CameraPose {
    const { showcase, phase, members } = this.state;
    if (showcase)
      return orbitPose(time, this.orbit.offset, this.orbit.lift, 17);
    if (this.view === "interior") {
      const pose = this.interior.pose;
      pose.target.x += this.interiorLook.yaw * 2.2;
      pose.target.y += this.interiorLook.pitch * 1.6;
      return { ...pose, fov: this.compact ? 66 : 58 };
    }
    const { index, member } = this.me();
    if (!member?.alive || phase === "ended")
      return orbitPose(
        time,
        this.orbit.offset,
        this.orbit.lift,
        phase === "ended" ? 14 : 18,
      );
    if (phase && seatPhases.has(phase))
      return seatPose(index, members.length, this.seatLook, this.compact);
    return followPose(
      this.self,
      this.cameraYaw,
      this.cameraPitch,
      this.input.zoom,
      this.compact,
    );
  }

  private steer(delta: number, time: number) {
    const look = this.input.takeLook();
    if (this.director.busy) return;
    const { showcase, phase } = this.state;
    const { member } = this.me();
    const pitch = useControls.getState().reducedMotion ? 0 : 1;
    if (showcase || !member || !member.alive || phase === "ended") {
      this.orbit.offset += look.yaw * 1.4;
      this.orbit.lift = T.MathUtils.clamp(
        this.orbit.lift + look.pitch,
        -0.2,
        1.2,
      );
      return;
    }
    if (this.view === "interior") {
      this.interiorLook.yaw = T.MathUtils.clamp(
        this.interiorLook.yaw - look.yaw,
        -0.45,
        0.45,
      );
      this.interiorLook.pitch = T.MathUtils.clamp(
        this.interiorLook.pitch - look.pitch,
        -0.3,
        0.35,
      );
      return;
    }
    if (phase && seatPhases.has(phase)) {
      this.seatLook = T.MathUtils.clamp(this.seatLook + look.yaw, -1.2, 1.2);
      return;
    }
    const axes = this.input.axes();
    this.cameraYaw += look.yaw + axes.turn * delta * 2.2;
    this.cameraPitch = T.MathUtils.clamp(
      this.cameraPitch + look.pitch * pitch,
      -0.2,
      0.9,
    );
    if (!isFree(phase)) return;
    const speed = axes.sprint ? 5.6 : 3.6;
    const ahead = facing(this.cameraYaw);
    const vx =
      (ahead.x * axes.forward + Math.cos(this.cameraYaw) * axes.side) * speed;
    const vz =
      (ahead.z * axes.forward - Math.sin(this.cameraYaw) * axes.side) * speed;
    if (Math.hypot(vx, vz) > 0.01) {
      const next = clampToPlaza(
        this.self.x + vx * delta,
        this.self.z + vz * delta,
      );
      this.self.x = next.x;
      this.self.z = next.z;
      this.self.yaw = dampAngle(this.self.yaw, Math.atan2(-vx, -vz), 10, delta);
    }
    this.report(time);
  }

  private report(time: number, force = false) {
    const last = this.lastSent;
    const changed =
      !last ||
      Math.hypot(last.x - this.self.x, last.z - this.self.z) > 0.03 ||
      Math.abs(last.yaw - this.self.yaw) > 0.04;
    const motion = this.state.motion;
    if (!motion) return;
    // Called every frame, so a stop is always followed by a final report.
    if (!force && (time - this.sentAt < motion.interval || !changed)) return;
    this.sentAt = time;
    this.lastSent = { ...this.self };
    motion.send({ ...this.self });
  }

  private placeSelf(time: number) {
    const { index, member } = this.me();
    if (!member) return;
    const own = this.cast.ownPosition(member.id);
    const stored = this.state.motion?.latest(member.id);
    const fallback = seat(index, this.state.members.length);
    const base: Pose =
      !this.placed && stored
        ? stored
        : own && own.lengthSq() > 0
          ? { x: own.x, z: own.z, yaw: fallback.yaw }
          : fallback;
    this.self = { ...clampToPlaza(base.x, base.z), yaw: base.yaw };
    this.cameraYaw = this.self.yaw;
    this.cameraPitch = 0.15;
    this.placed = true;
    if (isFree(this.state.phase) && member.alive) this.report(time, true);
  }

  private choreograph(time: number) {
    const { phase, events, showcase, outcome } = this.state;
    const reduced = useControls.getState().reducedMotion;
    if (events.length > this.eventCount) {
      for (const event of events.slice(this.eventCount))
        if (event.votes) this.revealVotes(event.votes, time);
    }
    this.eventCount = events.length;
    const { member } = this.me();
    if (!this.started) {
      this.started = true;
      this.phase = phase;
      this.view =
        phase === "night" && member?.alive && !showcase
          ? "interior"
          : "village";
      this.atmosphere.set(showcase ? "night" : lookFor(phase, outcome), true);
      this.director.snap({
        position: new T.Vector3(-10, 34, 52),
        target: new T.Vector3(0, 0, 0),
        fov: 50,
      });
      this.director.fade = 1;
      this.placeSelf(time);
      this.director.play([
        {
          to: () => this.desired(this.last),
          duration: reduced ? 0.6 : 3.6,
          fade: [1, 0],
          arc: reduced ? 0 : 4,
        },
      ]);
      return;
    }
    if (phase === this.phase) {
      if (phase === "night" && member?.alive) this.followTurn();
      return;
    }
    const previous = this.phase;
    this.phase = phase;
    this.director.stop();
    const stranded =
      phase !== "night" && previous !== "night" && this.view === "interior";
    if (stranded) {
      this.view = "village";
      this.atmosphere.set(lookFor(phase, outcome), true);
      this.director.fade = 1;
    }
    if (isFree(phase)) this.placeSelf(time);
    if (stranded) this.director.snap(this.desired(time));
    this.seatLook = 0;
    const shots = transition(previous, phase, {
      pose: () => this.desired(this.last),
      interior: () => this.interior.pose,
      setView: (view) => {
        this.view = view;
      },
      setLook: (look, immediate) => this.atmosphere.set(look, immediate),
      ring: () => {
        this.bellSwing = 0.55;
      },
      alive: !!member?.alive,
      reduced,
      verdict: this.verdict,
      outcome,
    });
    this.verdict = false;
    if (shots.length) this.director.play(shots);
    else this.director.soften(1.8);
  }

  /**
   * During the night, a player whose turn it is to point steps out onto the
   * square; everyone else stays home. Only this client sees the switch.
   */
  private followTurn() {
    const wanted: View = this.state.aiming ? "village" : "interior";
    if (wanted === this.view || this.director.busy) return;
    const reduced = useControls.getState().reducedMotion;
    this.director.play([
      { to: () => this.desired(this.last), duration: 0.35, fade: [0, 1] },
      {
        cut: true,
        to: () => {
          this.view = wanted;
          return this.desired(this.last);
        },
        duration: reduced ? 0.3 : 0.7,
        fade: [1, 0],
      },
    ]);
  }

  private revealVotes(votes: Record<string, string>, time: number) {
    const { members } = this.state;
    const head = (id: string) => {
      const index = members.findIndex((member) => member.id === id);
      if (index < 0) return undefined;
      const place = seat(index, members.length);
      return new T.Vector3(place.x, 1.5, place.z);
    };
    const pairs: [T.Vector3, T.Vector3][] = [];
    for (const [from, to] of Object.entries(votes)) {
      const start = head(from);
      const end = to ? head(to) : undefined;
      if (start && end) pairs.push([start, end]);
    }
    if (!pairs.length) return;
    this.verdict = !useControls.getState().reducedMotion;
    this.arcs.show(pairs, time + 1.2);
  }

  private get aimable() {
    return (
      !this.director.busy &&
      this.view === "village" &&
      this.state.targets.length > 0
    );
  }

  private tap(x: number, y: number) {
    if (!this.aimable) return;
    const id = this.pick(x, y);
    if (id && this.state.targets.includes(id)) this.state.onSelect(id);
  }

  private pass() {
    if (this.aimable) this.state.onPass?.();
  }

  /** Keyboard targeting: Tab walks the targets in seat order, Enter picks. */
  private command(key: "next" | "previous" | "confirm") {
    if (!this.aimable) return false;
    const { targets, members } = this.state;
    const ordered = members
      .map((member) => member.id)
      .filter((id) => targets.includes(id));
    if (key === "confirm") {
      if (!this.focusId || !ordered.includes(this.focusId)) return false;
      this.state.onSelect(this.focusId);
      return true;
    }
    const index = this.focusId ? ordered.indexOf(this.focusId) : -1;
    const step = key === "next" ? 1 : -1;
    this.focusId =
      ordered[(index + step + ordered.length) % ordered.length] ?? undefined;
    return true;
  }

  private pick(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new T.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.cast.pick(this.raycaster);
  }

  private hover(time: number) {
    const point = this.input.hover;
    if (time - this.hoverAt < 0.1) return;
    this.hoverAt = time;
    const id =
      point && !this.input.dragging && this.view === "village"
        ? this.pick(point.x, point.y)
        : undefined;
    if (id) this.focusId = undefined;
    if (this.focusId && !this.state.targets.includes(this.focusId))
      this.focusId = undefined;
    const aimed = this.focusId ?? id;
    this.hoverId =
      aimed && this.state.targets.includes(aimed) ? aimed : undefined;
    this.renderer.domElement.style.cursor = this.hoverId
      ? "pointer"
      : this.input.dragging
        ? "grabbing"
        : "grab";
  }

  private rings() {
    const outside = this.view === "village";
    const place = (ring: T.Mesh, id?: string) => {
      const puppet = id ? this.cast.puppets.get(id) : undefined;
      ring.visible = outside && !!puppet?.root.visible && !puppet.falling;
      if (puppet) ring.position.set(puppet.position.x, 0.16, puppet.position.z);
    };
    place(this.seats.aim, this.state.selected);
    place(
      this.seats.hover,
      this.hoverId !== this.state.selected ? this.hoverId : undefined,
    );
  }

  private effects(delta: number, time: number) {
    const night = this.atmosphere.night;
    this.materials.glow.color.setScalar(this.atmosphere.glow);
    (this.halos.material as T.ShaderMaterial).uniforms.uIntensity.value =
      0.12 + night * 0.9;
    this.motes.update(time, night);
    this.smokeTimer -= delta;
    if (this.smokeTimer < 0 && this.view === "village") {
      this.smokeTimer = 0.14;
      const chimney =
        this.village.chimneys[
          Math.floor(Math.random() * this.village.chimneys.length)
        ];
      this.smoke.emit(
        chimney,
        new T.Vector3(
          0.25 + Math.random() * 0.2,
          0.8 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.2,
        ),
        4.5,
        0.8,
      );
    }
    this.smoke.color.set("#d9d4cc").lerp(new T.Color("#4a5064"), night);
    this.smoke.update(delta);
    this.dust.update(delta);
    this.arcs.update(time);
    this.village.bell.rotation.x = Math.sin(time * 3.6) * this.bellSwing;
    this.bellSwing = Math.max(0, this.bellSwing - delta * 0.1);
    if (this.bloom) this.bloom.strength = 0.22 + night * 0.5;
  }

  private frame(now: number) {
    const delta = T.MathUtils.clamp(now - (this.last || now), 0, 0.05);
    this.last = now;
    const state = this.state;
    this.materials.time.value = now;
    this.choreograph(now);
    this.cast.sync(state.members, state.phase, this.view, () =>
      this.director.bump(0.12),
    );
    this.steer(delta, now);
    this.director.update(
      delta,
      this.desired(now),
      this.state.phase && isFree(this.state.phase) ? 7 : 4,
    );
    if (!this.director.busy) this.director.fadeTo(0, delta);
    this.veil.style.opacity = String(this.director.fade);
    this.director.apply(this.camera, now);

    const outside = this.view === "village";
    const { member } = this.me();
    const focus = outside
      ? new T.Vector3(this.self.x, 0, this.self.z)
      : this.camera.position;
    this.atmosphere.update(delta, this.camera, this.renderer, focus);
    for (const object of [
      this.village.group,
      this.halos,
      this.motes.points,
      this.smoke.points,
    ])
      object.visible = outside;
    this.seats.update(
      delta,
      now,
      state.members.length,
      state.members.map((entry) => entry.alive),
      this.atmosphere.night,
      outside && !state.showcase,
    );
    this.interior.setRole(state.role);
    this.interior.update(now, !outside);
    this.positions.clear();
    if (state.motion)
      for (const entry of state.members) {
        if (entry.id === state.me) continue;
        const pose = state.motion.sample(entry.id);
        if (pose) this.positions.set(entry.id, pose);
      }
    this.cast.update(delta, now, {
      members: state.members,
      me: state.me,
      phase: state.phase,
      view: this.view,
      self: this.self,
      positions: this.positions,
      selected: state.selected,
      pointing: !!state.selected && !!member?.alive && state.targets.length > 0,
      outcome: state.outcome,
      awake: state.awake ?? [],
      aims: state.aims ?? {},
    });
    this.hover(now);
    this.rings();
    this.effects(delta, now);
    this.renderer.shadowMap.autoUpdate = budgets[this.tier].shadows && outside;
    if (this.governor.tick(delta)) this.resize();
    if (this.composer && this.governor.bloom) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.input.dispose();
    this.cast.dispose();
    this.arcs.clear();
    this.atmosphere.dispose();
    this.interior.dispose();
    this.seats.dispose();
    this.factory.dispose();
    const shared = new Set<T.Material>([
      this.materials.solid,
      this.materials.wind,
      this.materials.glow,
    ]);
    disposeTree(this.scene, shared);
    disposeMaterials(this.materials);
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
