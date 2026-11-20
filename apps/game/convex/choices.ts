import type { Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { fail } from "./access";
import { dayAbility, inspect, turnAbility } from "./engine";
import { settleEarly } from "./phases";
import { igniteChoice, roleOf } from "./special";
import type { choiceAction } from "./validators";

export type ChoiceAction = Infer<typeof choiceAction>;

/**
 * Applies one player's choice to a running match. Shared by the `game.choose`
 * mutation (human seats) and the solo bots, so both obey the same rules.
 * `target` is "" to pass or abstain.
 */
export async function applyChoice(
  ctx: MutationCtx,
  match: Doc<"matches">,
  id: string,
  target: string,
  action: ChoiceAction,
) {
  const seat = match.seats[id];
  if (action === "shot") {
    if (
      (match.phase !== "dayShot" && match.phase !== "dawnShot") ||
      match.hunter !== id ||
      match.done ||
      (target && !match.seats[target]?.alive)
    )
      fail("Riposte indisponible.");
    await ctx.db.patch(match._id, { shot: target, done: true });
    await settleEarly(ctx, match._id);
    return;
  }
  if (!seat.alive) fail("Tu observes la partie.");
  if (action === "vote" || action === "electMayor" || action === "decideTie") {
    const ballot = dayAbility(match, id);
    if (
      ballot?.action !== action ||
      (target && !ballot.targets.includes(target))
    )
      fail("Vote invalide.");
    await ctx.db.patch(match._id, {
      votes: { ...match.votes, [id]: target },
    });
    await settleEarly(ctx, match._id);
    return;
  }
  if (action === "heal" || action === "poison" || action === "done") {
    if (
      match.phase !== "potions" ||
      roleOf(match, id) !== "witch" ||
      match.done
    )
      fail("Potions indisponibles.");
    if (action === "done") {
      await ctx.db.patch(match._id, { done: true });
      await settleEarly(ctx, match._id);
      return;
    }
    if (action === "heal") {
      if (target && (!seat.heal || target !== match.attack))
        fail("Remède indisponible.");
      await ctx.db.patch(match._id, { heal: !!target });
      await settleEarly(ctx, match._id);
      return;
    }
    if (
      target &&
      (!seat.poison || target === id || !match.seats[target]?.alive)
    )
      fail("Poison indisponible.");
    await ctx.db.patch(match._id, { poison: target });
    await settleEarly(ctx, match._id);
    return;
  }
  const ability = turnAbility(match, id);
  if (action === "ignite") {
    if (ability?.action !== "douse" || target || !match.marks?.length)
      fail("Embrasement indisponible.");
    await ctx.db.patch(match._id, {
      night: { ...match.night, [id]: igniteChoice },
    });
    await settleEarly(ctx, match._id);
    return;
  }
  if (
    ability?.action !== action ||
    (target && !ability.targets.includes(target))
  )
    fail("Ce n’est pas ton tour, ou cette cible est indisponible.");
  if (action === "model") {
    await ctx.db.patch(match._id, { model: target || undefined });
    return;
  }
  if (action === "link") {
    if (match.night[id] !== undefined) fail("Tu as déjà joué ce tour.");
    const pair = target ? [...(match.lovers ?? []), target] : [];
    await ctx.db.patch(match._id, {
      lovers: pair,
      ...(pair.length !== 1 ? { night: { ...match.night, [id]: target } } : {}),
    });
    await settleEarly(ctx, match._id);
    return;
  }
  if (action === "betray" || action === "infect") {
    await ctx.db.patch(match._id, {
      wolfPowers: { ...match.wolfPowers, [id]: target },
    });
    await settleEarly(ctx, match._id);
    return;
  }
  if (action === "inspect" || action === "peek") {
    if (match.night[id] !== undefined) fail("Tu as déjà joué ce tour.");
    const { _id, _creationTime, ...next } = match;
    inspect(next, id, target);
    await ctx.db.patch(_id, { night: next.night, seats: next.seats });
    await settleEarly(ctx, _id);
    return;
  }
  await ctx.db.patch(match._id, { night: { ...match.night, [id]: target } });
  await settleEarly(ctx, match._id);
}
