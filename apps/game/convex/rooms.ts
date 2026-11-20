import { v } from "convex/values";
import {
  characters,
  customCardCopies,
  customSettings,
  deckFor,
  defaultSettings,
  freeCharacter,
  matchSeconds,
  maxPlayers,
  minForMode,
  minPlayers,
} from "../shared/rules";
import { internal } from "./_generated/api";
import { type MutationCtx, mutation } from "./_generated/server";
import { access, fail, roomByCode, roster, validKey } from "./access";
import { fillBots, trimBots } from "./bots";
import { schedule, scheduleBots } from "./phases";
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

async function openRoom(
  ctx: MutationCtx,
  { key, name, character }: { key: string; name: string; character?: number },
  solo: boolean,
) {
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
    ...(solo ? { solo: {} } : {}),
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
  if (solo) await fillBots(ctx, room, minPlayers);
  return code;
}

export const create = mutation({
  args: admission,
  handler: (ctx, args) => openRoom(ctx, args, false),
});

/** A practice room: the host plus bots, ready to launch from the lobby. */
export const createSolo = mutation({
  args: admission,
  handler: (ctx, args) => openRoom(ctx, args, true),
});

/** Solo lobby: how many bots sit next to the host, and which card the host wants. */
export const soloSetup = mutation({
  args: {
    ...credentials,
    players: v.optional(v.number()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { code, key, players, role }) => {
    const { isHost, room } = await access(ctx, code, key);
    if (!isHost || !room.solo || room.match) fail("Réglage solo indisponible.");
    if (role !== undefined)
      await ctx.db.patch(room._id, { solo: { role: role || undefined } });
    if (players === undefined) return;
    if (
      !Number.isInteger(players) ||
      players < minForMode(room.settings.mode) ||
      players > maxPlayers
    )
      fail(
        `Choisis entre ${minForMode(room.settings.mode)} et ${maxPlayers} joueurs.`,
      );
    await fillBots(ctx, room._id, players);
    await trimBots(ctx, room._id, players);
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
    if (room.solo) fail("Ce salon est une partie solo.");
    const players = await roster(ctx, room._id);
    if (players.length >= maxPlayers) fail("Ce salon est complet.");
    const trimmed = nickname(name);
    if (
      players.some(
        (player) => player.name.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      fail("Ce pseudo est déjà pris dans le salon.");
    // The home screen cannot see who wears what, so a taken wish falls back
    // to the next free profession instead of failing the join.
    await ctx.db.insert("players", {
      room: room._id,
      key,
      name: trimmed,
      character: freeCharacter(
        players.map((player) => player.character),
        look(character, players.length),
      ),
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
    if (character !== undefined && character !== player.character) {
      look(character, player.character);
      const wearer = (await roster(ctx, room._id)).find(
        (other) => other._id !== player._id && other.character === character,
      );
      if (wearer) fail(`${wearer.name} a déjà choisi ce personnage.`);
    }
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
    // A solo table is always as full as its mode requires.
    if (room.solo) await fillBots(ctx, room._id, minForMode(settings.mode));
    const players = await roster(ctx, room._id);
    const next =
      settings.mode === "custom"
        ? customSettings(
            room.settings.mode === "custom"
              ? room.settings.reveal
              : defaultSettings.reveal,
            settings.copies,
          )
        : settings;
    if (next.mode === "custom") {
      try {
        deckFor(Math.max(players.length, minForMode(next.mode)), next);
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : "Réglages invalides.");
      }
    }
    await ctx.db.patch(room._id, { settings: next });
    await Promise.all(
      players
        .filter((player) => player.ready && !player.bot)
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
    if (!room.solo && players.some((player) => !player.ready))
      fail("Attends que tout le monde soit prêt.");
    const settings =
      room.settings.mode === "custom"
        ? customSettings(
            room.settings.reveal,
            customCardCopies(players.length, room.settings),
          )
        : room.settings;
    let deck: ReturnType<typeof deckFor>;
    try {
      deck = deckFor(players.length, settings);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Paquet invalide.");
    }
    for (let index = deck.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }
    // Practice: the host may ask for a card, if the deck holds it.
    const wanted = room.solo?.role;
    if (wanted) {
      const own = players.findIndex((player) => player._id === room.host);
      const slot = deck.indexOf(wanted as (typeof deck)[number]);
      if (own >= 0 && slot >= 0)
        [deck[own], deck[slot]] = [deck[slot], deck[own]];
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
      Date.now() + matchSeconds("intro", players.length, settings) * 1000;
    const match = await ctx.db.insert("matches", {
      room: room._id,
      settings,
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
      ...(room.solo ? { solo: true } : {}),
    });
    await ctx.db.patch(room._id, {
      match,
      settings,
      expires: Date.now() + lifetime,
    });
    await schedule(ctx, match, 0, end);
    if (room.solo) await scheduleBots(ctx, match, 0, "intro");
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
