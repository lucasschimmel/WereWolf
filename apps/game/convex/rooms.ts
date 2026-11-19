import { v } from "convex/values";
import {
  characters,
  deckFor,
  defaultSettings,
  maxPlayers,
  secondsFor,
} from "../shared/rules";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { access, fail, roomByCode, roster, validKey } from "./access";
import { schedule } from "./phases";
import { credentials, settings as settingsValidator } from "./validators";

const admission = {
  key: v.string(),
  name: v.string(),
  character: v.optional(v.number()),
};
function look(character: number | undefined, fallback: number) {
  if (character === undefined) return fallback;
  if (!Number.isInteger(character) || !characters[character])
    fail("Personnage invalide.");
  return character;
}
const lifetime = 12 * 60 * 60 * 1000;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nickname(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (
    !normalized ||
    normalized.length > 20 ||
    /[\p{Cc}\p{Cf}]/u.test(normalized)
  )
    fail("Choisis un pseudo de 1 à 20 caractères.");
  return normalized;
}

export const create = mutation({
  args: admission,
  handler: async (ctx, { key, name, character }) => {
    validKey(key);
    const chosen = look(character, 0);
    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = Array.from(
        { length: 6 },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      ).join("");
      if (!(await roomByCode(ctx, candidate))) {
        code = candidate;
        break;
      }
    }
    if (!code) fail("Création indisponible. Réessaie.");
    const room = await ctx.db.insert("rooms", {
      code,
      settings: defaultSettings,
      expires: Date.now() + lifetime,
    });
    const host = await ctx.db.insert("players", {
      room,
      key,
      name: nickname(name),
      character: chosen,
      ready: false,
    });
    await ctx.db.patch(room, { host });
    return code;
  },
});

export const join = mutation({
  args: { ...admission, code: v.string() },
  handler: async (ctx, { code, key, name, character }) => {
    validKey(key);
    const room = await roomByCode(ctx, code);
    if (!room || room.expires <= Date.now())
      fail("Ce salon est introuvable ou a expiré.");
    const existing = await ctx.db
      .query("players")
      .withIndex("by_seat", (q) => q.eq("room", room._id).eq("key", key))
      .unique();
    if (existing) return room.code;
    if (room.match) fail("La partie a déjà commencé.");
    const players = await roster(ctx, room._id);
    if (players.length >= maxPlayers) fail("Ce salon est complet.");
    const trimmed = nickname(name);
    if (
      players.some(
        (player) => player.name.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      fail("Ce pseudo est déjà pris dans le salon.");
    await ctx.db.insert("players", {
      room: room._id,
      key,
      name: trimmed,
      character: look(character, players.length % characters.length),
      ready: false,
    });
    return room.code;
  },
});

export const profile = mutation({
  args: {
    ...credentials,
    character: v.optional(v.number()),
    ready: v.optional(v.boolean()),
  },
  handler: async (ctx, { code, key, character, ready }) => {
    const { room, player } = await access(ctx, code, key);
    if (room.match) fail("La partie a déjà commencé.");
    if (
      character !== undefined &&
      (!Number.isInteger(character) || !characters[character])
    )
      fail("Personnage invalide.");
    await ctx.db.patch(player._id, {
      character: character ?? player.character,
      ready: ready ?? player.ready,
    });
  },
});

export const configure = mutation({
  args: { ...credentials, settings: settingsValidator },
  handler: async (ctx, { code, key, settings }) => {
    const { isHost, room } = await access(ctx, code, key);
    if (!isHost || room.match)
      fail("Seul l’hôte peut régler le salon avant le lancement.");
    if (
      settings.custom.length > 2 ||
      settings.replaced.length > 2 ||
      settings.custom.some(
        (card) => card.name.length > 32 || card.flavor.length > 140,
      )
    )
      fail("Cartes personnalisées invalides.");
    const players = await roster(ctx, room._id);
    await ctx.db.patch(room._id, { settings });
    await Promise.all(
      players
        .filter((player) => player.ready)
        .map((player) => ctx.db.patch(player._id, { ready: false })),
    );
  },
});

export const leave = mutation({
  args: { ...credentials, playerId: v.optional(v.id("players")) },
  handler: async (ctx, { code, key, playerId }) => {
    const { isHost, room, player } = await access(ctx, code, key);
    if (room.match) fail("Les sièges restent réservés pendant la partie.");
    if (isHost && (!playerId || playerId === player._id))
      fail("L’hôte garde sa place jusqu’à la fermeture du salon.");
    if (playerId && !isHost) fail("Seul l’hôte peut libérer une autre place.");
    const target = playerId ? await ctx.db.get(playerId) : player;
    if (!target || target.room !== room._id) fail("Joueur introuvable.");
    const position = await ctx.db
      .query("positions")
      .withIndex("by_player", (q) => q.eq("player", target._id))
      .unique();
    if (position) await ctx.db.delete(position._id);
    await ctx.db.delete(target._id);
  },
});

export const start = mutation({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { isHost, room } = await access(ctx, code, key);
    if (!isHost || room.match) fail("Seul l’hôte peut lancer la partie.");
    const players = await roster(ctx, room._id);
    let deck: ReturnType<typeof deckFor>;
    try {
      deck = deckFor(players.length, room.settings);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Paquet invalide.");
    }
    if (players.some((player) => !player.ready))
      fail("Attends que tout le monde soit prêt.");
    for (let index = deck.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }
    const seats = Object.fromEntries(
      players.map((player, index) => [
        player._id,
        {
          role: deck[index],
          alive: true,
          spent: false,
          guard: "",
          heal: true,
          poison: true,
          intel: [],
        },
      ]),
    );
    const end =
      Date.now() +
      secondsFor("intro", players.length, room.settings.mode) * 1000;
    const match = await ctx.db.insert("matches", {
      room: room._id,
      settings: room.settings,
      phase: "intro",
      cycle: 0,
      revision: 0,
      end,
      seats,
      votes: {},
      night: {},
      runoff: [],
      attack: "",
      heal: false,
      poison: "",
      shot: "",
      hunter: "",
      deaths: [],
      events: [],
      audit: [],
      pauses: 2,
    });
    await ctx.db.patch(room._id, { match, expires: Date.now() + lifetime });
    await schedule(ctx, match, 0, end);
  },
});

export const rematch = mutation({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { isHost, room } = await access(ctx, code, key);
    if (!isHost || !room.match) fail("Seul l’hôte peut rouvrir le lobby.");
    const match = await ctx.db.get(room.match);
    if (match?.phase !== "ended") fail("La partie est en cours.");
    const players = await roster(ctx, room._id);
    await Promise.all(
      players.map((player) => ctx.db.patch(player._id, { ready: false })),
    );
    await ctx.db.patch(room._id, {
      match: undefined,
      expires: Date.now() + lifetime,
    });
    await ctx.db.delete(match._id);
    await ctx.scheduler.runAfter(0, internal.chat.clean, {
      room: room._id,
      match: match._id,
    });
  },
});
