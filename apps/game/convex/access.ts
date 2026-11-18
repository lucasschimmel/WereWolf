import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export function fail(message: string): never {
  throw new ConvexError(message);
}
export function validKey(key: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) fail("Session invitée invalide.");
}
export async function roomByCode(ctx: QueryCtx, code: string) {
  return ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
    .unique();
}
export async function access(
  ctx: QueryCtx | MutationCtx,
  code: string,
  key: string,
) {
  validKey(key);
  const room = await roomByCode(ctx, code);
  if (!room || room.expires <= Date.now())
    fail("Ce salon est introuvable ou a expiré.");
  const player = await ctx.db
    .query("players")
    .withIndex("by_seat", (q) => q.eq("room", room._id).eq("key", key))
    .unique();
  if (!player) fail("Cette session ne correspond à aucune place du salon.");
  return { room, player, isHost: room.host === player._id };
}
export function roster(ctx: QueryCtx, room: Id<"rooms">) {
  return ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("room", room))
    .collect();
}
