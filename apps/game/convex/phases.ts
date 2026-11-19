import { v } from "convex/values";
import {
  earlyEndAt,
  graceSeconds,
  hiddenFloorSeconds,
  isNight,
  maskedSeconds,
  type Phase,
  plurality,
  revealsOnDeath,
  secondsFor,
  turnSeconds,
} from "../shared/rules";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  advanceNight,
  finishDeaths,
  holderAlive,
  isTurnComplete,
  kill,
  type Match,
  nextNight,
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
      case "potions":
        next = advanceNight(match);
        break;
      case "dawn":
        next = match.hunter ? "dawnShot" : "debate";
        break;
      case "dawnShot":
        finishDeaths(match, "Riposte du Chasseur");
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
    if (!isNight(match.phase)) match.turn = undefined;
    match.started = Date.now();
    match.done = undefined;
    match.end = match.started + durationOf(match) * 1000;
    match.revision += 1;
    await ctx.db.replace(_id, match);
    if (match.phase !== "ended")
      await schedule(ctx, _id, match.revision, match.end);
  },
});

/**
 * Seconds allotted to the match's current phase or night turn. In hidden
 * modes a dead holder's slot is a short masked window picked at random.
 */
export function durationOf(match: Match, random: () => number = Math.random) {
  if (isNight(match.phase) && match.turn) {
    const masked =
      !revealsOnDeath(match.settings) && !holderAlive(match, match.turn);
    return masked ? maskedSeconds(random) : turnSeconds(match.turn);
  }
  return secondsFor(
    match.phase,
    Object.keys(match.seats).length,
    match.settings.mode,
  );
}

const earlyPhases: ReadonlySet<Phase> = new Set([
  "night",
  "potions",
  "dawnShot",
  "vote",
  "runoff",
  "dayShot",
]);

/**
 * Ends the current slot after a short grace once its actors are done. Any
 * later change re-runs this: the end is moved, the revision bumped (so the
 * previously scheduled `advance` becomes a no-op) and a new one scheduled.
 * Paused matches (`remaining`) are left alone.
 */
export async function settleEarly(ctx: MutationCtx, id: Id<"matches">) {
  const match = await ctx.db.get(id);
  if (
    !match ||
    match.remaining !== undefined ||
    match.started === undefined ||
    !earlyPhases.has(match.phase) ||
    !isTurnComplete(match)
  )
    return;
  const end = earlyEndAt({
    now: Date.now(),
    started: match.started,
    deadline: match.started + durationOf(match) * 1000,
    graceSeconds: graceSeconds(isNight(match.phase) ? match.turn : undefined),
    floorSeconds:
      isNight(match.phase) && !revealsOnDeath(match.settings)
        ? hiddenFloorSeconds
        : 0,
  });
  if (end === match.end) return;
  const revision = match.revision + 1;
  await ctx.db.patch(id, { end, revision });
  await schedule(ctx, id, revision, end);
}

/**
 * Night sub-phases are reported as a single public `night` phase. The turn is
 * public; its length is not fixed (see `settleEarly` and `durationOf`).
 */
export function publicTiming(match: Doc<"matches">) {
  return {
    phase: isNight(match.phase) ? ("night" as const) : match.phase,
    end: match.end,
    turn: match.turn,
  };
}
