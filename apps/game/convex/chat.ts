import { v } from "convex/values";
import { chatMessageLimit } from "../shared/chat";
import { isNight } from "../shared/rules";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { access, fail } from "./access";
import { credentials } from "./validators";

const historySize = 100;
const cleanupBatchSize = 100;
const sendInterval = 1000;

function writeBlock(match: Doc<"matches"> | null, player: Id<"players">) {
  if (!match) return null;
  if (isNight(match.phase)) return "Le chat est en lecture seule la nuit.";
  if (match.phase === "ended") return "La partie est terminée.";
  if (!match.seats[player]?.alive)
    return "Seuls les joueurs vivants peuvent écrire.";
  return null;
}

function eliminatedMatch(match: Doc<"matches"> | null, player: Id<"players">) {
  // The private chat must not reveal a death before the village announces it.
  if (!match?.events.some((event) => event.deaths?.includes(player)))
    return null;
  return match._id;
}

async function recentMessages(
  ctx: QueryCtx,
  room: Id<"rooms">,
  match?: Id<"matches">,
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_room_match", (q) => q.eq("room", room).eq("match", match))
    .order("desc")
    .take(historySize);
  return messages
    .reverse()
    .map(({ _id, _creationTime, author, name, text }) => ({
      id: _id,
      time: _creationTime,
      author,
      name,
      text,
    }));
}

export const history = query({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    const eliminated = eliminatedMatch(match, player._id);
    return {
      writeBlock: writeBlock(match, player._id),
      messages: await recentMessages(ctx, room._id),
      eliminated: eliminated
        ? {
            match: eliminated,
            messages: await recentMessages(ctx, room._id, eliminated),
          }
        : null,
    };
  },
});

export const send = mutation({
  args: {
    ...credentials,
    text: v.string(),
    match: v.optional(v.id("matches")),
  },
  handler: async (ctx, { code, key, text, match: destination }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (destination) {
      if (eliminatedMatch(match, player._id) !== destination)
        fail("Ce chat est réservé aux joueurs éliminés de cette partie.");
    } else {
      const blocked = writeBlock(match, player._id);
      if (blocked) fail(blocked);
    }

    const message = text.trim();
    if (!message || message.length > chatMessageLimit)
      fail(`Écris un message de 1 à ${chatMessageLimit} caractères.`);

    const previous = await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("author", player._id))
      .order("desc")
      .first();
    if (previous && Date.now() - previous._creationTime < sendInterval)
      fail("Attends une seconde entre deux messages.");

    await ctx.db.insert("messages", {
      room: room._id,
      ...(destination ? { match: destination } : {}),
      author: player._id,
      name: player.name,
      text: message,
    });
  },
});

export const clean = internalMutation({
  args: { room: v.id("rooms"), match: v.optional(v.id("matches")) },
  handler: async (ctx, { room, match }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_room_match", (q) => {
        const inRoom = q.eq("room", room);
        return match ? inRoom.eq("match", match) : inRoom;
      })
      .take(cleanupBatchSize);
    await Promise.all(messages.map(({ _id }) => ctx.db.delete(_id)));
    if (messages.length === cleanupBatchSize)
      await ctx.scheduler.runAfter(0, internal.chat.clean, {
        room,
        ...(match ? { match } : {}),
      });
  },
});
