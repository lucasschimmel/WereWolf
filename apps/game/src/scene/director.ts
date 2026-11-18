import * as T from "three";

export type CameraPose = {
  position: T.Vector3;
  target: T.Vector3;
  fov?: number;
};

export type Shot = {
  /** Destination pose, resolved when the shot starts. */
  to: CameraPose | (() => CameraPose);
  duration: number;
  hold?: number;
  /** Start the shot at its destination instead of travelling. */
  cut?: boolean;
  fade?: [number, number];
  /** Lift the path through the air between start and destination. */
  arc?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Blends gameplay camera poses and plays scripted cinematic shots. */
export class Director {
  readonly position = new T.Vector3(0, 30, 45);
  readonly target = new T.Vector3();
  fov = 52;
  fade = 1;
  private queue: Shot[] = [];
  private active?: {
    shot: Shot;
    from: CameraPose;
    to: CameraPose;
    elapsed: number;
  };
  private shake = 0;
  private rate = 5;
  private rateTimer = 0;

  get busy() {
    return !!this.active || this.queue.length > 0;
  }

  play(shots: Shot[]) {
    this.queue.push(...shots);
  }

  stop() {
    this.queue = [];
    this.active?.shot.onEnd?.();
    this.active = undefined;
  }

  snap(pose: CameraPose) {
    this.position.copy(pose.position);
    this.target.copy(pose.target);
    if (pose.fov) this.fov = pose.fov;
  }

  /** Temporarily slows the follow damping for a smooth swoop to a new mode. */
  soften(seconds = 1.4, rate = 2.2) {
    this.rate = rate;
    this.rateTimer = seconds;
  }

  bump(amount = 0.25) {
    this.shake = Math.max(this.shake, amount);
  }

  fadeTo(value: number, delta: number, speed = 2.5) {
    this.fade += T.MathUtils.clamp(
      value - this.fade,
      -delta * speed,
      delta * speed,
    );
  }

  update(delta: number, desired: CameraPose, followRate = 6) {
    if (!this.active && this.queue.length) {
      const shot = this.queue.shift() as Shot;
      const to = typeof shot.to === "function" ? shot.to() : shot.to;
      const from = {
        position: this.position.clone(),
        target: this.target.clone(),
        fov: this.fov,
      };
      shot.onStart?.();
      if (shot.cut) this.snap(to);
      this.active = { shot, from: shot.cut ? to : from, to, elapsed: 0 };
    }
    if (this.active) {
      const { shot, from, to } = this.active;
      this.active.elapsed += delta;
      const raw = T.MathUtils.clamp(
        this.active.elapsed / Math.max(shot.duration, 0.001),
        0,
        1,
      );
      const t = ease(raw);
      this.position.lerpVectors(from.position, to.position, t);
      if (shot.arc) this.position.y += Math.sin(raw * Math.PI) * shot.arc;
      this.target.lerpVectors(from.target, to.target, t);
      this.fov = T.MathUtils.lerp(from.fov ?? this.fov, to.fov ?? 52, t);
      if (shot.fade)
        this.fade = T.MathUtils.lerp(shot.fade[0], shot.fade[1], raw);
      if (this.active.elapsed >= shot.duration + (shot.hold ?? 0)) {
        this.active = undefined;
        shot.onEnd?.();
      }
    } else {
      if (this.rateTimer > 0) this.rateTimer -= delta;
      const rate = this.rateTimer > 0 ? this.rate : followRate;
      const k = 1 - Math.exp(-delta * rate);
      this.position.lerp(desired.position, k);
      this.target.lerp(desired.target, 1 - Math.exp(-delta * rate * 1.4));
      this.fov += ((desired.fov ?? 52) - this.fov) * k;
    }
    this.shake = Math.max(0, this.shake - delta * 0.9);
  }

  apply(camera: T.PerspectiveCamera, time: number) {
    camera.position.copy(this.position);
    if (this.shake > 0) {
      camera.position.x += Math.sin(time * 41) * this.shake * 0.2;
      camera.position.y += Math.sin(time * 37 + 1) * this.shake * 0.2;
    }
    camera.lookAt(this.target);
    if (Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
