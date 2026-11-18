import { v } from "convex/values";
import { isNight, type Phase, plurality, secondsFor } from "../shared/rules";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  finishDeaths,
  firstWindow,
  hasHunter,
  kill,
  nextNight,
  resolvePotions,
} from "./engine";

export async function schedule(
  ctx: MutationCtx,
  id: Id<"matches">,
  revision: number,
  end: number,
) {
  await ctx.scheduler.runAt(end, internal.phases.advance, { id, revision });
}
export const advance = internalMutation({
  args: { id: v.id("matches"), revision: v.number() },
  handler: async (ctx, { id, revision }) => {
    const current = await ctx.db.get(id);
    if (
      !current ||
      current.phase === "ended" ||
      current.revision !== revision ||
      current.remaining !== undefined
    )
      return;
    const { _id, _creationTime, ...match } = current;
    let next: Phase;
    switch (match.phase) {
      case "intro":
        next = nextNight(match);
        break;
      case "night":
        firstWindow(match);
        next = "potions";
        break;
      case "potions":
        resolvePotions(match);
        next = "dawn";
        if (hasHunter(match)) next = "nightShot";
        else finishDeaths(match, "À l’aube");
        break;
      case "nightShot":
        finishDeaths(match, "À l’aube");
        next = "dawn";
        break;
      case "dawn":
        next = "debate";
        break;
      case "debate":
        next = "vote";
        break;
      case "vote":
      case "runoff": {
        const leaders = plurality(match.votes);
        match.events.push({
          cycle: match.cycle,
          label: match.phase === "vote" ? "Vote du village" : "Départage",
          votes: match.votes,
        });
        match.votes = {};
        if (match.phase === "vote" && leaders.length > 1) {
          match.runoff = leaders;
          next = "runoff";
          break;
        }
        if (leaders.length === 1) {
          kill(match, leaders);
          if (match.seats[leaders[0]].role === "jester") match.outcome = "solo";
        }
        if (match.hunter) {
          next = "dayShot";
          break;
        }
        finishDeaths(match, "Verdict");
        next = match.outcome ? "ended" : nextNight(match);
        break;
      }
      case "dayShot":
        finishDeaths(match, "Verdict");
        next = match.outcome ? "ended" : nextNight(match);
        break;
      default:
        return;
    }
    match.phase = match.outcome ? "ended" : next;
    match.end =
      Date.now() +
      secondsFor(
        match.phase,
        Object.keys(match.seats).length,
        match.settings.mode,
      ) *
        1000;
    match.revision += 1;
    await ctx.db.replace(_id, match);
    if (match.phase !== "ended")
      await schedule(ctx, _id, match.revision, match.end);
  },
});

export function publicTiming(match: Doc<"matches">) {
  if (!isNight(match.phase)) return { phase: match.phase, end: match.end };
  const shotTime = hasHunter(match) && match.phase !== "nightShot" ? 15_000 : 0;
  const potionTime = match.phase === "night" ? 25_000 : 0;
  return { phase: "night" as const, end: match.end + shotTime + potionTime };
}
