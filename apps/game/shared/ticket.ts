/**
 * Short-lived seat tickets for the movement relay.
 *
 * Convex (the authority on seats) signs `{room, player, exp}` with a secret it
 * shares with the relay; the relay only verifies. Web Crypto only, so the same
 * code runs in Convex, Cloudflare Workers and Bun.
 */

export type Ticket = { room: string; player: string; exp: number };

/** How long a ticket stays valid to open a connection (ms). */
export const ticketLifetime = 5 * 60_000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signTicket(ticket: Ticket, secret: string) {
  const body = toBase64Url(encoder.encode(JSON.stringify(ticket)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the ticket when the signature is valid and it has not expired. */
export async function verifyTicket(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<Ticket | null> {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  let valid: boolean;
  let ticket: Partial<Ticket>;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(body),
    );
    ticket = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  } catch {
    // Malformed base64 or JSON is just an invalid ticket.
    return null;
  }
  if (
    !valid ||
    typeof ticket.room !== "string" ||
    typeof ticket.player !== "string" ||
    typeof ticket.exp !== "number" ||
    ticket.exp <= now
  )
    return null;
  return { room: ticket.room, player: ticket.player, exp: ticket.exp };
}
