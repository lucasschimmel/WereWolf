import type { ConvexReactClient } from "convex/react";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { MotionBuffer, type Pose, renderDelay } from "../../shared/motion";
import type { Credentials } from "../session";

/**
 * Remote-player movement, kept out of React state: the 3D loop samples it
 * every frame, so position traffic never re-renders the HUD.
 */
export interface MotionFeed {
  /** Minimum seconds between two `send` calls. */
  readonly interval: number;
  send(pose: Pose): void;
  /** Interpolated pose to render now. */
  sample(player: string): Pose | undefined;
  /** Newest known pose (used to restore one's own spot after a reload). */
  latest(player: string): Pose | undefined;
}

/** Absolute `ws(s)://` URL, or a path (e.g. `/relay`) on the page's own host. */
function resolveRelay(value: string | undefined) {
  const url = value?.trim().replace(/\/$/, "");
  if (!url?.startsWith("/")) return url || undefined;
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}${url}`;
}
/** Consecutive failed connections before giving up on the relay. */
const relayAttempts = 4;
/** Give up on a connection attempt that has not opened by then (ms). */
const connectTimeout = 4000;
/** Convex fallback: 5 Hz sends, so render further behind. */
const fallbackDelay = 260;

type ServerMessage =
  | { type: "snapshot"; poses: (Pose & { t: number; p: string })[] }
  | (Pose & { type: "pose"; p: string; t: number });

class MotionLink implements MotionFeed {
  interval = 0.2;
  private buffer = new MotionBuffer(fallbackDelay);
  private socket?: WebSocket;
  private unwatch?: () => void;
  private failures = 0;
  private retry?: number;
  private closed = false;

  constructor(
    private convex: ConvexReactClient,
    private credentials: Credentials,
  ) {
    const relayUrl = resolveRelay(import.meta.env.VITE_RELAY_URL);
    if (relayUrl) void this.connect(relayUrl);
    else this.fallback();
  }

  send(pose: Pose) {
    const stamped = { ...pose, t: Date.now() };
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(stamped));
      return;
    }
    if (this.unwatch)
      void this.convex
        .mutation(api.game.move, { ...this.credentials, ...pose })
        .catch((cause) => console.warn("Position update dropped", cause));
  }

  sample(player: string) {
    return this.buffer.sample(player, performance.now());
  }

  latest(player: string) {
    return this.buffer.latest(player);
  }

  dispose() {
    this.closed = true;
    window.clearTimeout(this.retry);
    this.socket?.close(1000, "leaving");
    this.unwatch?.();
  }

  private async connect(base: string) {
    let access: Awaited<ReturnType<typeof this.requestTicket>>;
    try {
      access = await this.requestTicket();
    } catch (cause) {
      console.warn("Relay ticket unavailable", cause);
      this.scheduleRetry(base);
      return;
    }
    if (this.closed) return;
    if (!access) {
      // The deployment has no relay secret: Convex carries movement.
      this.fallback();
      return;
    }
    const socket = new WebSocket(
      `${base}/rooms/${access.room}?ticket=${encodeURIComponent(access.ticket)}`,
    );
    this.socket = socket;
    // A blocked or black-holed connection may never fire `close` by itself.
    const timeout = window.setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) socket.close();
    }, connectTimeout);
    socket.onopen = () => {
      window.clearTimeout(timeout);
      this.failures = 0;
      this.interval = 1 / 15;
      this.buffer = new MotionBuffer(renderDelay);
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onclose = () => {
      window.clearTimeout(timeout);
      if (this.socket === socket) this.socket = undefined;
      this.scheduleRetry(base);
    };
  }

  private requestTicket() {
    return this.convex.mutation(api.game.ticket, this.credentials);
  }

  private scheduleRetry(base: string) {
    if (this.closed) return;
    this.failures += 1;
    if (this.failures >= relayAttempts) {
      console.warn("Movement relay unreachable, falling back to Convex");
      this.fallback();
      return;
    }
    const wait = Math.min(1000 * 2 ** (this.failures - 1), 8000);
    this.retry = window.setTimeout(() => void this.connect(base), wait);
  }

  private receive(data: unknown) {
    if (typeof data !== "string") return;
    let message: ServerMessage;
    try {
      message = JSON.parse(data);
    } catch (cause) {
      console.warn("Malformed relay frame", cause);
      return;
    }
    const now = performance.now();
    if (message.type === "snapshot")
      for (const { p, ...pose } of message.poses)
        this.buffer.reset(p, pose, now);
    else if (message.type === "pose") {
      const { p, x, z, yaw, t } = message;
      this.buffer.push(p, { x, z, yaw, t }, now);
    }
  }

  private fallback() {
    if (this.unwatch || this.closed) return;
    this.interval = 0.2;
    this.buffer = new MotionBuffer(fallbackDelay);
    const watch = this.convex.watchQuery(api.game.positions, this.credentials);
    const read = () => {
      let rows: ReturnType<typeof watch.localQueryResult>;
      try {
        rows = watch.localQueryResult();
      } catch (cause) {
        console.warn("Positions query failed", cause);
        return;
      }
      const now = performance.now();
      for (const { player, x, z, yaw, updated } of rows ?? [])
        this.buffer.push(player, { x, z, yaw, t: updated }, now);
    };
    this.unwatch = watch.onUpdate(read);
    read();
  }
}

/** One movement link per seat, alive while the room is open. */
export function useMotion(credentials: Credentials): MotionFeed | undefined {
  const convex = useConvex();
  const [link, setLink] = useState<MotionLink>();
  const { code, key } = credentials;
  useEffect(() => {
    const created = new MotionLink(convex, { code, key });
    setLink(created);
    return () => created.dispose();
  }, [convex, code, key]);
  return link;
}
