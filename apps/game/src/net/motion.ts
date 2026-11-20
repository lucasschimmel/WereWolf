import type { ConvexReactClient } from "convex/react";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  MotionBuffer,
  normalizePose,
  type Pose,
  type Stamped,
} from "../../shared/motion";
import type { Credentials } from "../session";

/** Movement stays outside React; the 3D loop samples interpolated poses. */
export interface MotionFeed {
  readonly interval: number;
  send(pose: Pose): void;
  sample(player: string): Pose | undefined;
  latest(player: string): Pose | undefined;
}

const interpolationDelay = 260;
const heartbeat = 1000;
const heartbeatSpan = 10_000;

class MotionLink implements MotionFeed {
  readonly interval = 0.2;
  private buffer = new MotionBuffer(interpolationDelay);
  private tracked = new Set<string>();
  private unwatch: () => void;
  private pulse: number;
  private last?: Stamped;
  private movedAt = 0;

  constructor(
    private convex: ConvexReactClient,
    readonly credentials: Credentials,
    readonly scope: string,
  ) {
    const watch = convex.watchQuery(api.game.positions, {
      ...credentials,
      scope,
    });
    const read = () => {
      try {
        const rows = watch.localQueryResult() ?? [];
        const current = new Set<string>(rows.map(({ player }) => player));
        for (const player of this.tracked)
          if (!current.has(player)) this.buffer.forget(player);
        this.tracked = current;
        const now = performance.now();
        for (const { player, x, z, yaw, updated } of rows)
          this.buffer.push(player, { x, z, yaw, t: updated }, now);
      } catch {
        this.buffer = new MotionBuffer(interpolationDelay);
        console.warn("Could not read room positions");
      }
    };
    this.unwatch = watch.onUpdate(read);
    this.pulse = window.setInterval(() => this.beat(), heartbeat / 4);
    read();
  }

  send(pose: Pose) {
    const stamped = normalizePose({ ...pose, t: Date.now() });
    if (!stamped) return;
    this.last = stamped;
    this.movedAt = stamped.t;
    this.transmit(stamped);
  }

  private transmit({ x, z, yaw }: Pose) {
    void this.convex
      .mutation(api.game.move, {
        ...this.credentials,
        scope: this.scope,
        x,
        z,
        yaw,
      })
      .catch(() => console.warn("Position update dropped"));
  }

  private beat() {
    const now = Date.now();
    if (!this.last || now - this.last.t < heartbeat) return;
    if (now - this.movedAt > heartbeatSpan) return;
    this.last = { ...this.last, t: now };
    this.transmit(this.last);
  }

  sample(player: string) {
    return this.buffer.sample(player, performance.now());
  }

  latest(player: string) {
    return this.buffer.latest(player);
  }

  dispose() {
    window.clearInterval(this.pulse);
    this.unwatch();
    this.buffer = new MotionBuffer(interpolationDelay);
  }
}

export function useMotion(
  { code, key }: Credentials,
  scope: string | undefined,
): MotionFeed | undefined {
  const convex = useConvex();
  const [link, setLink] = useState<MotionLink>();
  useEffect(() => {
    if (!scope) {
      setLink(undefined);
      return;
    }
    const created = new MotionLink(convex, { code, key }, scope);
    setLink(created);
    return () => created.dispose();
  }, [convex, code, key, scope]);
  if (
    link?.scope === scope &&
    link?.credentials.code === code &&
    link.credentials.key === key
  )
    return link;
}
