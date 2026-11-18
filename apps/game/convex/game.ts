import { v } from "convex/values";
import { isNight } from "../shared/rules";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { access, fail, roster } from "./access";
import { alive, camp, nightAbility } from "./engine";
import { publicTiming, schedule } from "./phases";
import { credentials } from "./validators";

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
    const members = players.map(({ _id, name, character, ready }) => ({
      id: _id,
      name,
      character,
      ready,
      host: _id === room.host,
      alive: !deaths.has(_id),
      role:
        match &&
        (ended ||
          (deaths.has(_id) &&
            room.settings.mode !== "mystery" &&
            (room.settings.mode !== "workshop" || room.settings.reveal)))
          ? match.seats[_id].role
          : undefined,
    }));
    const base = {
      code: room.code,
      settings: room.settings,
      members,
      me: player._id,
      isHost,
    };
    if (!match) return { ...base, match: null };
    const seat = match.seats[player._id];
    const living = alive(match);
    const ballot =
      seat.alive && (match.phase === "vote" || match.phase === "runoff");
    const shooting =
      (match.phase === "dayShot" || match.phase === "nightShot") &&
      match.hunter === player._id;
    const witch =
      match.phase === "potions" && seat.alive && seat.role === "witch";
    const ability =
      match.phase === "night" ? nightAbility(match, player._id) : undefined;
    const targets = ballot
      ? (match.phase === "runoff" ? match.runoff : living).filter(
          (id) => id !== player._id,
        )
      : shooting
        ? living
        : ability?.targets;
    const mates =
      seat.role === "wolf"
        ? Object.keys(match.seats).filter((id) => camp(match, id) === "pack")
        : [];
    const revealIntel = !isNight(match.phase);
    return {
      ...base,
      match: {
        ...publicTiming(match),
        cycle: match.cycle,
        remaining: match.remaining,
        pauses: match.pauses,
        outcome: match.outcome,
        events: match.events,
        audit: ended ? match.audit : undefined,
        role: seat.role,
        intel: revealIntel
          ? seat.intel.filter(
              (entry) =>
                Number(entry.split("|")[0]) < match.cycle || seat.alive,
            )
          : seat.intel.filter(
              (entry) => Number(entry.split("|")[0]) < match.cycle,
            ),
        mates,
        wolves:
          ability?.action === "wolf"
            ? Object.fromEntries(mates.map((id) => [id, match.night[id] ?? ""]))
            : undefined,
        action: ballot
          ? ("vote" as const)
          : shooting
            ? ("shot" as const)
            : ability?.action,
        targets,
        selected: ballot
          ? match.votes[player._id]
          : shooting
            ? match.shot
            : ability
              ? match.night[player._id]
              : undefined,
        potions: witch
          ? {
              attack: seat.heal ? match.attack : "",
              targets: seat.poison
                ? living.filter((id) => id !== player._id)
                : [],
              heal: match.heal,
              poison: match.poison,
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
    action: v.union(
      v.literal("vote"),
      v.literal("shot"),
      v.literal("wolf"),
      v.literal("inspect"),
      v.literal("protect"),
      v.literal("activity"),
      v.literal("heal"),
      v.literal("poison"),
    ),
  },
  handler: async (ctx, { code, key, target, action }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (!match || match.end <= Date.now())
      fail("Cette fenêtre d’action est terminée.");
    const id = player._id;
    const seat = match.seats[id];
    if (action === "shot") {
      if (
        (match.phase !== "dayShot" && match.phase !== "nightShot") ||
        match.hunter !== id ||
        (target && !match.seats[target]?.alive)
      )
        fail("Riposte indisponible.");
      await ctx.db.patch(match._id, { shot: target });
      return;
    }
    if (!seat.alive) fail("Tu observes la partie.");
    if (action === "vote") {
      if (
        (match.phase !== "vote" && match.phase !== "runoff") ||
        (target &&
          (!match.seats[target]?.alive ||
            target === id ||
            (match.phase === "runoff" && !match.runoff.includes(target))))
      )
        fail("Vote invalide.");
      await ctx.db.patch(match._id, {
        votes: { ...match.votes, [id]: target },
      });
      return;
    }
    if (action === "heal" || action === "poison") {
      if (match.phase !== "potions" || seat.role !== "witch")
        fail("Potions indisponibles.");
      if (action === "heal") {
        if (target && (!seat.heal || target !== match.attack))
          fail("Remède indisponible.");
        await ctx.db.patch(match._id, { heal: !!target });
        return;
      }
      if (
        target &&
        (!seat.poison || target === id || !match.seats[target]?.alive)
      )
        fail("Poison indisponible.");
      await ctx.db.patch(match._id, { poison: target });
      return;
    }
    const ability =
      match.phase === "night" ? nightAbility(match, id) : undefined;
    if (
      ability?.action !== action ||
      (target && !ability.targets.includes(target))
    )
      fail("Action de nuit indisponible.");
    await ctx.db.patch(match._id, { night: { ...match.night, [id]: target } });
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

import { internalMutation } from "./_generated/server";
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
  args: credentials,
  handler: async (ctx, { code, key }) => {
    const { room } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (match && match.phase !== "intro" && match.phase !== "debate") return [];
    return (
      await ctx.db
        .query("positions")
        .withIndex("by_room", (q) => q.eq("room", room._id))
        .collect()
    ).map(({ player, x, z, yaw }) => ({ player, x, z, yaw }));
  },
});

export const move = mutation({
  args: { ...credentials, x: v.number(), z: v.number(), yaw: v.number() },
  handler: async (ctx, { code, key, x, z, yaw }) => {
    const { room, player } = await access(ctx, code, key);
    const match = room.match ? await ctx.db.get(room.match) : null;
    if (
      match &&
      ((match.phase !== "intro" && match.phase !== "debate") ||
        !match.seats[player._id].alive)
    )
      return;
    if (
      ![x, z, yaw].every(Number.isFinite) ||
      Math.hypot(x, z) > 10.01 ||
      Math.abs(yaw) > Math.PI + 0.01
    )
      return;
    const previous = await ctx.db
      .query("positions")
      .withIndex("by_player", (q) => q.eq("player", player._id))
      .unique();
    const updated = Date.now();
    if (previous && updated - previous.updated < 125) return;
    if (previous) await ctx.db.patch(previous._id, { x, z, yaw, updated });
    else
      await ctx.db.insert("positions", {
        room: room._id,
        player: player._id,
        x,
        z,
        yaw,
        updated,
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
    }
  },
});
