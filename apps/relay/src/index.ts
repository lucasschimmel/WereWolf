import { DurableObject } from "cloudflare:workers";
import { normalizePose, type Stamped } from "../../game/shared/motion";
import { verifyTicket } from "../../game/shared/ticket";

/**
 * Movement relay: one Durable Object per room fans out ephemeral poses over
 * WebSockets. Convex stays the authority for seats, rules and phases; this
 * service only forwards throw-away positions and never persists them.
 */

type Env = {
  SQUARE: DurableObjectNamespace<Square>;
  RELAY_SECRET: string;
  /** Comma-separated allowed browser origins; empty allows any. */
  ALLOWED_ORIGINS?: string;
};

/** What each socket remembers across hibernation. */
type Attachment = { player: string; pose?: Stamped; at: number };

export type ServerMessage =
  | { type: "snapshot"; poses: (Stamped & { p: string })[] }
  | ({ type: "pose"; p: string } & Stamped);

/** Minimum spacing between accepted poses from one socket (ms). */
const minInterval = 30;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = /^\/rooms\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
    if (!match) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected WebSocket", { status: 426 });
    const origins = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") ?? "";
    if (origins.length && !origins.includes(origin))
      return new Response("Forbidden origin", { status: 403 });
    if (!env.RELAY_SECRET)
      return new Response("Relay not configured", { status: 503 });
    const ticket = await verifyTicket(
      url.searchParams.get("ticket") ?? "",
      env.RELAY_SECRET,
    );
    if (!ticket || ticket.room !== match[1])
      return new Response("Invalid ticket", { status: 401 });
    const square = env.SQUARE.get(env.SQUARE.idFromName(ticket.room));
    const forwarded = new Request(request);
    forwarded.headers.set("X-Player", ticket.player);
    return square.fetch(forwarded);
  },
} satisfies ExportedHandler<Env>;

export class Square extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const player = request.headers.get("X-Player");
    if (!player) return new Response("Missing player", { status: 400 });
    const { 0: client, 1: server } = new WebSocketPair();
    // Hibernatable: the object can sleep between messages without dropping sockets.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ player, at: 0 } satisfies Attachment);
    server.send(JSON.stringify(this.snapshot()));
    return new Response(null, { status: 101, webSocket: client });
  }

  /** The newest pose of every player, across all their open sockets. */
  private snapshot(): ServerMessage {
    const latest = new Map<string, Stamped>();
    for (const socket of this.ctx.getWebSockets()) {
      const { player, pose } = socket.deserializeAttachment() as Attachment;
      const known = latest.get(player);
      if (pose && (!known || pose.t > known.t)) latest.set(player, pose);
    }
    return {
      type: "snapshot",
      poses: [...latest].map(([p, pose]) => ({ p, ...pose })),
    };
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const state = socket.deserializeAttachment() as Attachment;
    const now = Date.now();
    if (now - state.at < minInterval) return;
    let pose: Stamped | null = null;
    if (typeof message === "string" && message.length <= 256)
      try {
        pose = normalizePose(JSON.parse(message));
      } catch {
        // Not JSON: handled as a dropped frame below.
      }
    if (!pose) {
      // Never drop silently: a client stuck sending bad frames must show up.
      console.warn("Relay dropped a malformed pose", state.player);
      return;
    }
    socket.serializeAttachment({
      ...state,
      pose,
      at: now,
    } satisfies Attachment);
    const frame = JSON.stringify({
      type: "pose",
      p: state.player,
      ...pose,
    } satisfies ServerMessage);
    for (const peer of this.ctx.getWebSockets())
      if (peer !== socket) {
        try {
          peer.send(frame);
        } catch (cause) {
          // A peer closing mid-broadcast must not stop the fan-out.
          console.warn("Relay send failed", state.player, cause);
        }
      }
  }

  async webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1005 ? 1000 : code, "closing");
  }
}
