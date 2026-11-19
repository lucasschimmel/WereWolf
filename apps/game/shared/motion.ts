/**
 * Entity interpolation for remote players.
 *
 * Senders stamp each pose with their own clock. Receivers map those stamps to
 * their local clock with a per-sender offset (the smallest observed transit,
 * which absorbs clock skew without any sync round trip), then render every
 * remote player a fixed `delay` in the past, interpolating between the two
 * snapshots that bracket that instant. Short gaps are extrapolated from the
 * last velocity, then the pose holds.
 */

export type Pose = { x: number; z: number; yaw: number };
export type Stamped = Pose & { t: number };

/** How far in the past remote players are rendered (ms). */
export const renderDelay = 120;
/** Longest extrapolation past the newest snapshot (ms). */
export const maxExtrapolation = 150;
/** Snapshots older than this behind render time are discarded (ms). */
const history = 1000;
/** How fast the offset estimate may drift upward when transit grows. */
const offsetDrift = 0.02;

/** Bounds of the walkable square, shared by every transport. */
export const plazaRadius = 10.01;

/** Wraps an angle into [-π, π]. */
export const wrapAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * Brings a pose back into the shared conventions: yaw wrapped into [-π, π],
 * position clamped to the square. Every transport normalizes rather than
 * rejects, so a pose that drifted out of range (an unwrapped yaw after a few
 * turns, a float past the edge) never silently stops a player's updates.
 * Returns null only for frames that are not poses at all.
 */
export function normalizePose(raw: unknown): Stamped | null {
  if (!raw || typeof raw !== "object") return null;
  const { x, z, yaw, t } = raw as Partial<Record<keyof Stamped, unknown>>;
  if (
    typeof x !== "number" ||
    typeof z !== "number" ||
    typeof yaw !== "number" ||
    typeof t !== "number" ||
    ![x, z, yaw, t].every(Number.isFinite)
  )
    return null;
  const radius = Math.hypot(x, z);
  const scale = radius > plazaRadius ? plazaRadius / radius : 1;
  return { x: x * scale, z: z * scale, yaw: wrapAngle(yaw), t };
}

const shortestAngle = (from: number, to: number) => wrapAngle(to - from);

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    x: a.x + (b.x - a.x) * k,
    z: a.z + (b.z - a.z) * k,
    yaw: a.yaw + shortestAngle(a.yaw, b.yaw) * k,
  };
}

/** A snapshot on the local clock, remembering the sender's own stamp. */
type Entry = Stamped & { sent: number };
type Track = { offset: number; snapshots: Entry[] };

/** Per-player snapshot buffers, sampled once per rendered frame. */
export class MotionBuffer {
  private tracks = new Map<string, Track>();

  constructor(private delay = renderDelay) {}

  /** Records a pose stamped `t` by its sender, received at local `now`. */
  push(player: string, pose: Stamped, now: number) {
    let track = this.tracks.get(player);
    const transit = now - pose.t;
    if (!track) {
      track = { offset: transit, snapshots: [] };
      this.tracks.set(player, track);
    } else if (transit < track.offset) track.offset = transit;
    else track.offset += (transit - track.offset) * offsetDrift;
    const list = track.snapshots;
    // Re-delivered snapshots (e.g. an unchanged query row) are ignored.
    if (list.some((entry) => entry.sent === pose.t)) return;
    const local = { ...pose, t: pose.t + track.offset, sent: pose.t };
    const newest = list[list.length - 1];
    list.push(local);
    // A late packet (or a lowered offset) is slotted back in order.
    if (newest && local.t <= newest.t) list.sort((a, b) => a.t - b.t);
    const cutoff = now - this.delay - history;
    while (list.length > 2 && list[1].t < cutoff) list.shift();
  }

  /** Replaces a player's state outright (e.g. an initial snapshot). */
  reset(player: string, pose: Stamped, now: number) {
    this.tracks.set(player, {
      offset: now - pose.t,
      snapshots: [{ ...pose, t: now - this.delay, sent: pose.t }],
    });
  }

  forget(player: string) {
    this.tracks.delete(player);
  }

  /** The newest known pose, without interpolation. */
  latest(player: string): Pose | undefined {
    const list = this.tracks.get(player)?.snapshots;
    const newest = list?.[list.length - 1];
    return newest && { x: newest.x, z: newest.z, yaw: newest.yaw };
  }

  /** The interpolated pose to render at local time `now`. */
  sample(player: string, now: number): Pose | undefined {
    const list = this.tracks.get(player)?.snapshots;
    if (!list?.length) return undefined;
    const at = now - this.delay;
    const first = list[0];
    if (list.length === 1 || at <= first.t)
      return { x: first.x, z: first.z, yaw: first.yaw };
    for (let index = list.length - 1; index > 0; index--) {
      const a = list[index - 1];
      const b = list[index];
      if (at >= a.t && at <= b.t)
        return lerpPose(a, b, b.t === a.t ? 1 : (at - a.t) / (b.t - a.t));
    }
    const a = list[list.length - 2];
    const b = list[list.length - 1];
    const span = b.t - a.t;
    const ahead = Math.min(at - b.t, maxExtrapolation);
    // A long silence means the player stopped: hold the last pose.
    if (span <= 0 || span > 400) return { x: b.x, z: b.z, yaw: b.yaw };
    const k = 1 + ahead / span;
    const pose = lerpPose(a, b, k);
    const radius = Math.hypot(pose.x, pose.z);
    if (radius > plazaRadius) {
      pose.x *= plazaRadius / radius;
      pose.z *= plazaRadius / radius;
    }
    return { ...pose, yaw: b.yaw };
  }
}
