import * as T from "three";
import type { Outcome, Phase, Role } from "../../shared/rules";
import type { MotionFeed } from "../net/motion";
import { useControls } from "../store";
import type { createBloom } from "./bloom";
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
import { Facades } from "./facades";
import {
  haloField,
  haloMaterial,
  Motes,
  Particles,
  setHalos,
  VoteArcs,
} from "./fx";
import { Input } from "./input";
import { Interior, interiorPose } from "./interior";
import { disposeTree } from "./kit";
import { clampToPlaza, dampAngle, facing, type Pose, seat } from "./layout";
import type { MapChoice, MapDefinition } from "./maps/types";
import {
  type Budget,
  budgets,
  FrameGovernor,
  pixelRatio,
  type Tier,
} from "./quality";
import {
  acquireSceneResources,
  releaseSceneResources,
  type SceneResources,
} from "./resources";
import { Seats } from "./seats";
import { Atmosphere } from "./sky";

export type { SceneMember };

const showcaseFps = 30;
const gameFps = 60;
const shadowFps = 30;
const shadowFocus = new T.Vector3();
const smokeNight = new T.Color("#4a5064");
const noAwake: string[] = [];
const noAims: Record<string, string> = {};

export type SceneEvent = {
  cycle: number;
  label: string;
  deaths?: string[];
  votes?: Record<string, string>;
};
export type SceneState = {
  /** Which map to build and the seed of its procedural details. */
  map: MapChoice & { seats?: number };
  showcase: boolean;
  members: SceneMember[];
  me: string;
  /** Remote movement, sampled every frame (absent in the showcase). */
  motion?: MotionFeed;
  phase?: Phase;
  events: SceneEvent[];
  role?: Role;
  outcome?: Outcome;
  winner?: string;
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
  private resources: SceneResources;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(55, 1, 0.1, 700);
  private bloom?: ReturnType<typeof createBloom>;
  private bloomRequested = false;
  private disposed = false;
  private contextLost = false;
  private budget: Budget;
  private targetFps: number;
  private outdoors = new T.Group();
  private materials;
  private atmosphere: Atmosphere;
  private world;
  private facades: Facades;
  private seats: Seats;
  private interior?: Interior;
  private motes: Motes;
  private smoke?: Particles;
  private dust: Particles;
  private arcs = new VoteArcs();
  private halos: T.Points;
  private pointMaterials: T.ShaderMaterial[];
  private cast: Cast;
  private director = new Director();
  private input: Input;
  private governor: FrameGovernor;
  private observer: ResizeObserver;
  private raycaster = new T.Raycaster();
  private pointer = new T.Vector2();
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
  private nextFrame = 0;
  private shadowAt = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private alive: boolean[] = [];
  private placed = false;
  private positions = new Map<string, Pose>();

  constructor(
    private container: HTMLElement,
    tier: Tier,
    private state: SceneState,
    private veil: HTMLElement,
    private onContextChange: (lost: boolean) => void,
    map: MapDefinition,
  ) {
    const budget = budgets[tier];
    this.scene.matrixAutoUpdate = false;
    this.outdoors.matrixAutoUpdate = false;
    this.budget = budget;
    this.targetFps = state.showcase ? showcaseFps : gameFps;
    this.resources = acquireSceneResources(tier, map, state.map.seed);
    const { renderer, materials, scenery, factory } = this.resources;
    this.renderer = renderer;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = budget.shadows;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.governor = new FrameGovernor(
      budget.bloom && this.renderer.extensions.has("EXT_color_buffer_float"),
      this.targetFps,
    );
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Village en 3D. ZQSD ou WASD pour marcher, glisser pour tourner la caméra.",
    );
    this.materials = materials;
    this.atmosphere = new Atmosphere(
      this.scene,
      budget,
      this.materials,
      map.mood,
    );
    this.world = scenery.world;
    scenery.setDetail(0);
    scenery.arrange(this.headCount(state));
    this.facades = new Facades(materials);
    const halo = haloMaterial(1);
    this.halos = haloField(scenery.glowSpots, halo);
    const seatHalo = haloMaterial(1);
    this.seats = new Seats(this.materials, seatHalo);
    this.motes = new Motes(budget.motes, map.motes);
    this.dust = new Particles(
      tier === "low" ? 36 : 90,
      "#cdb894",
      -2.6,
      1.3,
      1,
    );
    this.outdoors.add(
      scenery.group,
      this.halos,
      this.seats.group,
      this.motes.points,
      this.dust.points,
      this.arcs.group,
    );
    this.scene.add(this.outdoors);
    this.pointMaterials = [
      halo,
      seatHalo,
      this.motes.points.material,
      this.dust.points.material,
    ];
    this.cast = new Cast(
      this.scene,
      factory,
      this.seats,
      this.dust,
      budget.shadows,
    );
    this.setState(state);
    container.prepend(canvas);
    this.input = new Input(canvas, {
      tap: (x, y) => this.tap(x, y),
      pass: () => this.pass(),
      command: (key) => this.command(key),
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    document.fonts?.ready.then(() => {
      if (this.disposed) return;
      this.cast.refreshLabels();
    });
    canvas.addEventListener("webglcontextlost", this.loseContext);
    canvas.addEventListener("webglcontextrestored", this.restoreContext);
    document.addEventListener("visibilitychange", this.updateLoop);
    this.updateLoop();
  }

  setState(state: SceneState) {
    if (state.motion !== this.state.motion) this.lastSent = undefined;
    if (
      this.alive.length !== state.members.length ||
      this.state.members !== state.members
    )
      this.alive = state.members.map((member) => member.alive);
    this.state = state;
  }

  /** Seats the scenery is laid out for; the showcase shows a small table. */
  private headCount(state: SceneState) {
    return state.map.seats ?? (state.showcase ? 0 : state.members.length);
  }

  private resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.compact = width < 720;
    const dpr =
      pixelRatio(this.budget, width, height, window.devicePixelRatio) *
      this.governor.scale;
    if (this.width === width && this.height === height && this.dpr === dpr)
      return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.renderer.setDrawingBufferSize(width, height, dpr);
    this.bloom?.resize(width, height, dpr);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const scale = height * dpr * 0.5;
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
      const pose = interiorPose();
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
      interior: interiorPose,
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
      !this.contextLost &&
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
    this.pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.cast.pick(this.raycaster, this.state.targets);
  }

  private hover(time: number) {
    const point = this.input.hover;
    if (time - this.hoverAt < 0.1) return;
    this.hoverAt = time;
    const id =
      point && !this.input.dragging && this.aimable
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
    if (this.smoke?.points.visible) this.updateSmoke(delta, night, this.smoke);
    this.dust.update(delta);
    this.arcs.update(time);
    this.world.bell.rotation.x = Math.sin(time * 3.6) * this.bellSwing;
    this.world.animate?.(time, night);
    this.bellSwing = Math.max(0, this.bellSwing - delta * 0.1);
  }

  private updateSmoke(delta: number, night: number, smoke: Particles) {
    this.smokeTimer -= delta;
    if (this.smokeTimer < 0) {
      this.smokeTimer = 0.14;
      const { chimneys } = this.resources.scenery;
      if (chimneys.length)
        smoke.emit(
          chimneys[Math.floor(Math.random() * chimneys.length)],
          new T.Vector3(
            0.25 + Math.random() * 0.2,
            0.8 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.2,
          ),
          4.5,
          0.8,
        );
    }
    smoke.color.set("#d9d4cc").lerp(smokeNight, night);
    smoke.update(delta);
  }

  private updateLoop = () => {
    this.last = this.nextFrame = this.shadowAt = 0;
    this.governor.resetSamples();
    this.renderer.setAnimationLoop(
      document.hidden || this.contextLost ? null : this.frame,
    );
  };

  private loseContext = () => {
    this.contextLost = true;
    this.renderer.domElement.style.visibility = "hidden";
    this.updateLoop();
    this.onContextChange(true);
  };

  private restoreContext = () => {
    this.contextLost = false;
    this.renderer.domElement.style.visibility = "";
    this.updateLoop();
    this.onContextChange(false);
  };

  private applyDetail() {
    const reduction = this.governor.detailReduction;
    this.resources.scenery.setDetail(reduction);
    this.motes.points.visible = reduction < 2;
    if (this.smoke) this.smoke.points.visible = reduction === 0;
    this.renderer.shadowMap.enabled = this.budget.shadows && reduction === 0;
    this.atmosphere.setShadows(this.renderer.shadowMap.enabled);
    if (!this.governor.bloom && this.bloom) {
      this.bloom.dispose();
      this.bloom = undefined;
    }
  }

  private loadSmoke() {
    this.smoke = new Particles(this.budget.smoke, "#d9d4cc", 0.12, 2.6, 1.4);
    const material = this.smoke.points.material;
    material.uniforms.uScale.value = this.height * this.dpr * 0.5;
    this.pointMaterials.push(material);
    this.outdoors.add(this.smoke.points);
  }

  private async loadBloom() {
    this.bloomRequested = true;
    try {
      const { createBloom } = await import("./bloom");
      if (this.contextLost) this.bloomRequested = false;
      if (this.disposed || this.contextLost || !this.governor.bloom) return;
      this.bloom = createBloom(this.renderer, this.scene, this.camera);
      this.bloom.resize(this.width, this.height, this.dpr);
    } catch (cause) {
      if (this.disposed) return;
      this.governor.bloom = false;
      this.applyDetail();
      console.warn("Could not initialize village bloom", cause);
    }
  }

  private frame = (ms: number) => {
    const now = ms / 1000;
    const interval = 1 / this.targetFps;
    if (now + 0.001 < this.nextFrame) return;
    this.nextFrame = this.last
      ? Math.max(this.nextFrame + interval, now)
      : now + interval;
    const elapsed = this.last ? now - this.last : 0;
    const delta = Math.min(elapsed, 0.075);
    this.last = now;
    const state = this.state;
    if (this.resources.scenery.arrange(this.headCount(state)))
      setHalos(this.halos, this.resources.scenery.glowSpots);
    this.facades.sync(this.world.homes, state.showcase ? [] : state.members);
    this.materials.time.value = now;
    this.choreograph(now);
    this.cast.sync(state.members, state.me, state.phase, this.view, () =>
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
      ? shadowFocus.set(this.self.x, 0, this.self.z)
      : this.camera.position;
    this.atmosphere.update(delta, this.camera, this.renderer, focus);
    this.atmosphere.setOutdoors(outside);
    this.outdoors.visible = outside;
    if (outside) this.cast.updateBurials(state.members.length);
    this.seats.update(
      delta,
      now,
      state.members.length,
      this.alive,
      this.atmosphere.night,
      outside && !state.showcase,
    );
    if (!outside) {
      this.interior ??= new Interior(this.scene, this.materials);
      this.interior.setRole(state.role);
    }
    this.interior?.update(now, !outside);
    this.positions.clear();
    if (outside && state.motion)
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
      winner: state.winner,
      awake: state.awake ?? noAwake,
      aims: state.aims ?? noAims,
    });
    if (this.governor.tick(elapsed)) {
      this.applyDetail();
      this.resize();
    }
    if (outside) this.updateOutdoors(delta, now);
    if (this.bloom && outside) this.bloom.render(delta, this.atmosphere.night);
    else this.renderer.render(this.scene, this.camera);
    this.advanceLoading(outside, state.showcase);
  };

  private updateOutdoors(delta: number, now: number) {
    const shadows = this.renderer.shadowMap.enabled;
    this.cast.setDetail(
      this.camera.position,
      this.budget.puppetLod * (1 - this.governor.detailReduction * 0.15),
      shadows,
    );
    this.hover(now);
    this.rings();
    this.effects(delta, now);
    if (shadows && now + 0.001 >= this.shadowAt) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowAt = now + 1 / shadowFps;
    }
  }

  private advanceLoading(outside: boolean, showcase: boolean) {
    if (!outside) return;
    const { scenery } = this.resources;
    if (!scenery.loaded) scenery.loadBatch(this.governor.detailReduction);
    else if (this.budget.smoke && !this.smoke && !this.governor.detailReduction)
      this.loadSmoke();
    else if (showcase && !this.cast.hasShowcase) this.cast.populateShowcase();
    else if (this.governor.bloom && !this.bloomRequested) void this.loadBloom();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    document.removeEventListener("visibilitychange", this.updateLoop);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("webglcontextlost", this.loseContext);
    canvas.removeEventListener("webglcontextrestored", this.restoreContext);
    this.observer.disconnect();
    this.input.dispose();
    this.cast.dispose();
    this.arcs.clear();
    this.atmosphere.dispose();
    this.interior?.dispose(this.materials);
    this.facades.dispose();
    this.outdoors.remove(this.resources.scenery.group);
    disposeTree(this.scene, this.resources.sharedMaterials);
    this.bloom?.dispose();
    canvas.remove();
    releaseSceneResources(this.resources);
  }
}
