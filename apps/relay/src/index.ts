import { DurableObject } from "cloudflare:workers";

type Env = { SQUARE: DurableObjectNamespace<Square> };

function unavailable() {
  return new Response("Movement relay disabled", { status: 503 });
}

export default {
  fetch: unavailable,
} satisfies ExportedHandler<Env>;

/** Keep the deployed binding so hibernating sockets can be closed on wake. */
export class Square extends DurableObject<Env> {
  fetch() {
    return unavailable();
  }

  webSocketMessage(socket: WebSocket) {
    socket.close(1008, "Movement relay disabled");
  }

  webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1005 ? 1000 : code, "closing");
  }
}
