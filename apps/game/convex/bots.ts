import { ConvexError, v } from "convex/values";
import { freeCharacter, maxPlayers } from "../shared/rules";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { applyChoice, type ChoiceAction } from "./choices";
import {
  alive,
  dayAbility,
  type Match,
  nightSelection,
  turnAbility,
} from "./engine";
import { huntsWithPack, roleOf } from "./special";

/** One thing a bot does with `applyChoice`; `target` is "" to pass. */
export type Move = { action: ChoiceAction; target: string };
type Random = () => number;

const botNames = [
  "Margaux",
  "Hugo",
  "Élise",
  "Thibault",
  "Camille",
  "Bastien",
  "Nolwenn",
  "Gaspard",
  "Léna",
  "Octave",
  "Maëlle",
  "Anselme",
  "Rosalie",
  "Eliott",
] as const;
/** The most bots a room can hold next to its human host. */
export const maxBots = maxPlayers - 1;

const pick = <T>(items: readonly T[], random: Random) =>
  items[Math.floor(random() * items.length)];
const hex = () =>
  Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

/** Names `n` bots after the unused entries of the list. */
export async function fillBots(
  ctx: MutationCtx,
  room: Id<"rooms">,
  total: number,
) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("room", room))
    .collect();
  const taken = new Set(players.map((player) => player.name.toLowerCase()));
  const free = botNames.filter((name) => !taken.has(name.toLowerCase()));
  const worn = players.map((player) => player.character);
  let count = players.length;
  for (const name of free) {
    if (count >= total) break;
    const character = freeCharacter(worn, count + 1);
    worn.push(character);
    await ctx.db.insert("players", {
      room,
      key: hex(),
      name,
      character,
      ready: true,
      bot: true,
    });
    count += 1;
  }
}

/** Drops the most recent bots until `total` seats remain. */
export async function trimBots(
  ctx: MutationCtx,
  room: Id<"rooms">,
  total: number,
) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("room", room))
    .collect();
  const bots = players.filter((player) => player.bot).reverse();
  for (const bot of bots.slice(0, Math.max(0, players.length - total)))
    await ctx.db.delete(bot._id);
}

export async function botCount(ctx: QueryCtx, room: Id<"rooms">) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("room", room))
    .collect();
  return players.filter((player) => player.bot).length;
}

/**
 * What a bot does right now, if anything. Bots play legally but simply: wolves
 * hunt villagers, a seer's bot votes against the wolves it found, everybody
 * else votes at random. Several moves are returned when one turn needs more
 * than one call (Cupid's two links, the witch's potions then "done").
 */
export function decide(
  match: Match,
  id: string,
  random: Random = Math.random,
): Move[] {
  const seat = match.seats[id];
  if (!seat) return [];
  const shooting =
    (match.phase === "dawnShot" || match.phase === "dayShot") &&
    match.hunter === id &&
    match.done !== true;
  if (shooting) {
    const targets = alive(match).filter((other) => other !== id);
    return [
      {
        action: "shot",
        target: targets.length && random() < 0.85 ? pick(targets, random) : "",
      },
    ];
  }
  if (!seat.alive) return [];
  switch (match.phase) {
    case "intro":
      return introMoves(match, id, random);
    case "night":
      return nightMoves(match, id, random);
    case "potions":
      return witchMoves(match, id, random);
    case "mayorElection":
    case "vote":
    case "runoff":
    case "mayorVerdict":
      return ballotMoves(match, id, random);
    default:
      return [];
  }
}

function introMoves(match: Match, id: string, random: Random): Move[] {
  const ability = turnAbility(match, id);
  if (ability?.action !== "model" || match.model !== undefined) return [];
  return [{ action: "model", target: pick(ability.targets, random) }];
}

function nightMoves(match: Match, id: string, random: Random): Move[] {
  const ability = turnAbility(match, id);
  if (!ability || nightSelection(match, id) !== undefined) return [];
  const { targets } = ability;
  const any = () => (targets.length ? pick(targets, random) : "");
  switch (ability.action) {
    case "inspect":
    case "peek": {
      const seen = new Set(match.seats[id].intel.map((e) => e.split("|")[1]));
      const fresh = targets.filter((target) => !seen.has(target));
      const pool = fresh.length ? fresh : targets;
      return [
        {
          action: ability.action,
          target: pool.length ? pick(pool, random) : "",
        },
      ];
    }
    case "link": {
      if (match.lovers?.length === 1)
        return [{ action: "link", target: any() }];
      if (targets.length < 2) return [{ action: "link", target: "" }];
      const first = pick(targets, random);
      const second = pick(
        targets.filter((target) => target !== first),
        random,
      );
      return [
        { action: "link", target: first },
        { action: "link", target: second },
      ];
    }
    case "betray":
      return [
        {
          action: "betray",
          target: match.cycle >= 2 && random() < 0.4 ? any() : "",
        },
      ];
    case "infect":
      return [
        {
          action: "infect",
          target: targets.length && random() < 0.6 ? targets[0] : "",
        },
      ];
    case "douse": {
      const marks = match.marks?.length ?? 0;
      if (marks >= 2 || (marks === 1 && match.cycle >= 3 && random() < 0.5))
        return [{ action: "ignite", target: "" }];
      return [{ action: "douse", target: any() }];
    }
    default:
      return [{ action: ability.action, target: any() }];
  }
}

function witchMoves(match: Match, id: string, random: Random): Move[] {
  if (roleOf(match, id) !== "witch" || match.done === true) return [];
  const moves: Move[] = [];
  const me = match.seats[id];
  if (me.heal && match.attack && random() < 0.7)
    moves.push({ action: "heal", target: match.attack });
  const victims = alive(match).filter((other) => other !== id);
  if (me.poison && match.cycle >= 2 && victims.length && random() < 0.12)
    moves.push({ action: "poison", target: pick(victims, random) });
  moves.push({ action: "done", target: "" });
  return moves;
}

function ballotMoves(match: Match, id: string, random: Random): Move[] {
  const ballot = dayAbility(match, id);
  if (!ballot || id in match.votes) return [];
  let targets = [...ballot.targets];
  if (ballot.action === "electMayor") {
    const others = targets.filter((other) => other !== id);
    return [{ action: "electMayor", target: pick(others, random) }];
  }
  if (ballot.action === "decideTie")
    return [
      {
        action: "decideTie",
        target: targets.length && random() < 0.85 ? pick(targets, random) : "",
      },
    ];
  // Wolves spare their own pack while a villager is left to blame.
  if (huntsWithPack(roleOf(match, id))) {
    const village = targets.filter(
      (other) => !huntsWithPack(roleOf(match, other)),
    );
    if (village.length) targets = village;
  }
  // A seer's bot trusts what it saw.
  const guilty = match.seats[id].intel
    .map((entry) => entry.split("|"))
    .filter(
      ([, target, result]) => result === "pack" && targets.includes(target),
    )
    .map(([, target]) => target);
  if (guilty.length) return [{ action: "vote", target: guilty[0] }];
  if (!targets.length || random() < 0.12)
    return [{ action: "vote", target: "" }];
  return [{ action: "vote", target: pick(targets, random) }];
}

/** Lets every bot of a solo match act once on the current phase. */
export const play = internalMutation({
  args: { id: v.id("matches"), revision: v.number() },
  handler: async (ctx, { id, revision }) => {
    const first = await ctx.db.get(id);
    if (
      !first ||
      first.revision !== revision ||
      first.phase === "ended" ||
      first.remaining !== undefined
    )
      return;
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("room", first.room))
      .collect();
    for (const bot of players.filter((player) => player.bot)) {
      const current = await ctx.db.get(id);
      if (!current || current.phase !== first.phase) return;
      const { _id, _creationTime, ...match } = current;
      for (const move of decide(match, bot._id)) {
        const fresh = await ctx.db.get(id);
        if (!fresh) return;
        try {
          await applyChoice(ctx, fresh, bot._id, move.target, move.action);
        } catch (cause) {
          // A move made stale by a teammate's earlier one: skip, never crash.
          if (!(cause instanceof ConvexError)) throw cause;
          break;
        }
      }
    }
  },
});

const remarks = [
  (other: string) => `${other} m’a l’air bien silencieux·se…`,
  (other: string) => `Je me méfie de ${other}, honnêtement.`,
  (other: string) => `Et si c’était ${other} ? Je dis ça, je dis rien.`,
  () => "Je suis un simple villageois, je vous le jure !",
  () => "Quelqu’un a un indice ? Je n’ai rien vu cette nuit.",
  () => "Ne votons pas au hasard, cette fois.",
];

/** A couple of bots say something in the debate so the village feels alive. */
export const chatter = internalMutation({
  args: { id: v.id("matches"), revision: v.number() },
  handler: async (ctx, { id, revision }) => {
    const match = await ctx.db.get(id);
    if (!match || match.revision !== revision || match.phase !== "debate")
      return;
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("room", match.room))
      .collect();
    const speakers = players.filter(
      (player) => player.bot && match.seats[player._id]?.alive,
    );
    const living = players.filter((player) => match.seats[player._id]?.alive);
    const author = pick(speakers, Math.random);
    if (!author) return;
    const other = pick(
      living.filter((player) => player._id !== author._id),
      Math.random,
    );
    const remark = pick(remarks, Math.random);
    await ctx.db.insert("messages", {
      room: match.room,
      author: author._id,
      name: author.name,
      text: remark(other?.name ?? "quelqu’un"),
    });
    await ctx.scheduler.runAfter(
      4000 + Math.random() * 6000,
      internal.bots.chatter,
      { id, revision },
    );
  },
});
