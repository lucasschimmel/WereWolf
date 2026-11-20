import { v } from "convex/values";
import { normalizePose } from "../shared/motion";
import { recordPresence } from "../shared/presence";
import { isDayBallot, isNight, revealsOnDeath } from "../shared/rules";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { access, fail, roster } from "./access";
import { applyChoice } from "./choices";
import {
  alive,
  dayAbility,
  nightOrder,
  nightSelection,
  turnAbility,
} from "./engine";
import { publicTiming, schedule } from "./phases";
import { huntsWithPack, packMembers, partnerOf, roleOf } from "./special";
import { choiceAction, credentials, tabPresenceReport } from "./validators";

function actionWindow(match: Doc<"matches">) {
  return `${match._id}:${match.cycle}:${match.phase}:${match.turn ?? ""}`;
}

function movementScope(
  room: Pick<Doc<"rooms">, "_id" | "expires">,
  match: Doc<"matches"> | null,
  player: string,
) {
  if (!match) return `${room._id}:lobby:${room.expires}`;
  if (
    (match.phase === "intro" || match.phase === "debate") &&
    match.seats[player]?.alive
  )
    return actionWindow(match);
}

const choiceInterval = 120;
const presenceWriteInterval = 250;
const movementInterval = 150;

export const view = query({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { room, player, isHost } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    const ended = match?.phase === "ended";
    const players = await roster(ctx, room._id);
    const deaths = new Set(
      match?.events.flatMap((event) => event.deaths ?? []),
    );
    const members = players.map(
      ({ _id, name, character, ready, seen, bot, tabs }) => ({
        id: _id,
        bot: bot === true,
        seen: seen ?? 0,
        tabs: tabs?.map(({ status, at }) => ({ status, at })),
        name,
        character,
        ready,
        host: _id === room.host,
        alive: !deaths.has(_id),
        role:
          match &&
          (ended || (deaths.has(_id) && revealsOnDeath(match.settings)))
            ? roleOf(match, _id)
            : undefined,
      }),
    );
    const base = {
      code: room.code,
      settings: room.settings,
      solo: room.solo ? { role: room.solo.role } : undefined,
      members,
      me: player._id,
      isHost,
      movementScope: movementScope(room, match, player._id),
    };
    if (!match) return { ...base, match: null };
    const seat = match.seats[player._id];
    const role = roleOf(match, player._id);
    const living = alive(match);
    const ballot = dayAbility(match, player._id);
    const shooting =
      (match.phase === "dayShot" || match.phase === "dawnShot") &&
      match.hunter === player._id;
    const shotDone = shooting && match.done === true;
    const witch = match.phase === "potions" && seat.alive && role === "witch";
    const ability = turnAbility(match, player._id);
    const targets =
      ballot?.targets ?? (shooting && !shotDone ? living : ability?.targets);
    const choice = ability ? nightSelection(match, player._id) : undefined;
    const finishedPointing =
      choice !== undefined &&
      (ability?.action === "inspect" ||
        ability?.action === "peek" ||
        ability?.action === "link");
    const mates = huntsWithPack(role)
      ? seat.alive
        ? packMembers(match)
        : (seat.knownPack ??
          packMembers(match).filter((id) => !match.seats[id].converted))
      : [];
    const ghosts =
      role === "necromancer" && seat.alive && !ended ? [...deaths] : undefined;
    const awake =
      ability?.action === "wolf"
        ? mates.filter((id) => id !== player._id && match.seats[id].alive)
        : undefined;
    const poisonTargets =
      witch && seat.poison && !match.done
        ? living.filter((id) => id !== player._id)
        : [];
    const sceneActors = isNight(match.phase)
      ? [
          ...new Set([
            player._id,
            ...(finishedPointing ? [] : (targets ?? [])),
            ...(awake ?? []),
            ...(ghosts ?? []),
            ...poisonTargets,
          ]),
        ]
      : undefined;
    return {
      ...base,
      match: {
        ...publicTiming(match),
        actionWindow:
          ballot || (shooting && !shotDone) || ability || (witch && !match.done)
            ? actionWindow(match)
            : undefined,
        cycle: match.cycle,
        remaining: match.remaining,
        pauses: match.pauses,
        outcome: match.outcome,
        winner: ended ? match.winner : undefined,
        events: match.events,
        audit: ended ? match.audit : undefined,
        role,
        partner: partnerOf(match, player._id),
        model: role === "wildChild" ? match.model : undefined,
        ghosts,
        awake,
        sceneActors,
        marks: role === "arsonist" ? match.marks : undefined,
        canIgnite: ability?.action === "douse" && !!match.marks?.length,
        linkCount:
          ability?.action === "link" ? (match.lovers?.length ?? 0) : undefined,
        mayor:
          match.mayor && !deaths.has(match.mayor) ? match.mayor : undefined,
        nightOrder: isNight(match.phase) ? nightOrder(match) : undefined,
        intel: seat.intel,
        mates,
        wolves: awake
          ? Object.fromEntries(awake.map((id) => [id, match.night[id] ?? ""]))
          : undefined,
        ballots: isDayBallot(match.phase)
          ? Object.fromEntries(
              Object.entries(match.votes).filter(
                ([voter, target]) => target && match.seats[voter]?.alive,
              ),
            )
          : undefined,
        action:
          ballot?.action ??
          (shooting && !shotDone ? ("shot" as const) : ability?.action),
        shotDone,
        targets: finishedPointing ? undefined : targets,
        selected: ballot
          ? match.votes[player._id]
          : shooting
            ? match.shot
            : choice,
        potions: witch
          ? {
              attack: seat.heal ? match.attack : "",
              targets: poisonTargets,
              heal: match.heal,
              poison: match.poison,
              done: match.done === true,
            }
          : undefined,
      },
    };
  },
});

export const choose = mutation({
  args: {
    ...credentials,
    target: v.string(),
    action: choiceAction,
    window: v.string(),
  },
  handler: async (ctx, { code, key, target, action, window }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    const now = Date.now();
    if (!match || match.end <= now || window !== actionWindow(match))
      fail("Cette fenêtre d’action est terminée.");
    if (
      action !== "done" &&
      action !== "link" &&
      player.lastChoice !== undefined &&
      now - player.lastChoice < choiceInterval
    )
      fail("Attends un instant avant de rejouer.");
    await applyChoice(ctx, match, player._id, target, action);
    await ctx.db.patch(player._id, { lastChoice: now });
  },
});

export const pause = mutation({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { room, isHost } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (
      !isHost ||
      !match ||
      match.phase !== "debate" ||
      match.remaining !== undefined ||
      match.pauses === 0 ||
      match.end <= Date.now()
    )
      fail("Pause indisponible.");
    const revision = match.revision + 1;
    await ctx.db.patch(match._id, {
      revision,
      remaining: match.end - Date.now(),
      pauses: match.pauses - 1,
    });
    await ctx.scheduler.runAfter(60_000, internal.game.resume, {
      id: match._id,
      revision,
    });
  },
});

const skippable = new Set(["intro", "dawn", "debate"]);

/** Solo only: moves on from a waiting phase (intro, dawn, debate) at once. */
export const skip = mutation({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { room, isHost } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (
      !isHost ||
      !room.solo ||
      !match ||
      match.remaining !== undefined ||
      !skippable.has(match.phase)
    )
      fail("Impossible de passer cette étape.");
    const revision = match.revision + 1;
    const end = Date.now();
    await ctx.db.patch(match._id, { revision, end });
    await schedule(ctx, match._id, revision, end);
  },
});

export const resume = internalMutation({
  args: { id: v.id("matches"), revision: v.number() },
  handler: async (ctx, { id, revision }) => {
    const match = await ctx.db.get(id);
    if (!match || match.revision !== revision || match.remaining === undefined)
      return;
    const end = Date.now() + match.remaining;
    await ctx.db.patch(id, {
      end,
      revision: revision + 1,
      remaining: undefined,
    });
    await schedule(ctx, id, revision + 1, end);
  },
});

export const positions = query({
  args: { ...credentials, scope: v.string() },
  handler: async (ctx, { code, key, scope }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (scope !== movementScope(room, match, player._id)) return [];
    return (
      await ctx.db
        .query("positions")
        .withIndex("by_room", (q) => q.eq("room", room._id))
        .collect()
    )
      .filter(
        (row) =>
          row.scope === scope && (!match || match.seats[row.player]?.alive),
      )
      .map(({ player, x, z, yaw, updated }) => ({
        player,
        x,
        z,
        yaw,
        updated,
      }));
  },
});

/** The retired relay no longer issues tickets. */
export const ticket = mutation({
  args: credentials,
  handler: async (ctx, { code, key }) => {
    await access(ctx, code, key);
    return null;
  },
});

/** Browser presence reports are independent of seat membership. */
export const beat = mutation({
  args: { ...credentials, report: v.optional(v.object(tabPresenceReport)) },
  handler: async (ctx, { code, key, report }) => {
    const { player } = await access(ctx, code, key);
    const at = Date.now();
    if (player.seen !== undefined && at - player.seen < presenceWriteInterval)
      return;
    if (!report) {
      await ctx.db.patch(player._id, { seen: at });
      return;
    }
    if (
      !/^[0-9a-f]{32}$/.test(report.tab) ||
      !Number.isSafeInteger(report.revision) ||
      report.revision < 1
    )
      fail("Signal de présence invalide.");
    const tabs = recordPresence(player.tabs ?? [], { ...report, at });
    if (tabs !== player.tabs)
      await ctx.db.patch(player._id, { tabs, seen: at });
  },
});

export const move = mutation({
  args: {
    ...credentials,
    scope: v.string(),
    x: v.number(),
    z: v.number(),
    yaw: v.number(),
  },
  handler: async (ctx, { code, key, scope, x, z, yaw }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (scope !== movementScope(room, match, player._id)) return;
    const pose = normalizePose({ x, z, yaw, t: 0 });
    if (!pose) return;
    const previous = await ctx.db
      .query("positions")
      .withIndex("by_player", (q) => q.eq("player", player._id))
      .unique();
    const updated = Date.now();
    if (
      previous?.scope === scope &&
      updated - previous.updated < movementInterval
    )
      return;
    const row = { scope, x: pose.x, z: pose.z, yaw: pose.yaw, updated };
    if (previous) await ctx.db.patch(previous._id, row);
    else
      await ctx.db.insert("positions", {
        room: room._id,
        player: player._id,
        ...row,
      });
  },
});

export const clean = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("rooms")
      .withIndex("by_expiry", (q) => q.lt("expires", Date.now()))
      .take(20);
    for (const room of expired) {
      const players = await roster(ctx, room._id);
      const positions = await ctx.db
        .query("positions")
        .withIndex("by_room", (q) => q.eq("room", room._id))
        .collect();
      await Promise.all(
        [...players, ...positions].map(({ _id }) => ctx.db.delete(_id)),
      );
      if (room.match) await ctx.db.delete(room.match);
      await ctx.db.delete(room._id);
      await ctx.scheduler.runAfter(0, internal.chat.clean, { room: room._id });
    }
  },
});
