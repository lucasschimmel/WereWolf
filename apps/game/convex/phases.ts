import { v } from "convex/values";
import {
  earlyEndAt,
  graceSeconds,
  hiddenFloorSeconds,
  isNight,
  maskedSeconds,
  matchSeconds,
  type Phase,
  revealsOnDeath,
} from "../shared/rules";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  advanceDayBallot,
  advanceNight,
  beginDebate,
  dawnRequiresResolution,
  finishDeaths,
  finishElection,
  holderAlive,
  isTurnComplete,
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
/**
 * Queues the bots of a solo match for the phase that just began. Each phase
 * has its own revision, so a late call from a previous phase is a no-op.
 */
export async function scheduleBots(
  ctx: MutationCtx,
  id: Id<"matches">,
  revision: number,
  phase: Phase,
) {
  const delay = 1500 + Math.random() * 3500;
  await ctx.scheduler.runAfter(delay, internal.bots.play, { id, revision });
  if (phase === "debate")
    await ctx.scheduler.runAfter(2500, internal.bots.chatter, { id, revision });
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
        next = dawnRequiresResolution(match) ? "dawnShot" : beginDebate(match);
        break;
      case "dawnShot":
        finishDeaths(
          match,
          revealsOnDeath(match.settings)
            ? "Riposte du Chasseur"
            : "Résolution de l’aube",
        );
        next = match.outcome ? "ended" : beginDebate(match);
        break;
      case "mayorElection":
        next = finishElection(match);
        break;
      case "debate":
        next = "vote";
        break;
      case "vote":
      case "runoff":
      case "mayorVerdict":
        next = advanceDayBallot(match);
        break;
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
    if (match.phase !== "ended") {
      await schedule(ctx, _id, match.revision, match.end);
      if (match.solo) await scheduleBots(ctx, _id, match.revision, match.phase);
    }
  },
});

/**
 * Multiplayer windows follow the public phase and its configured duration.
 * Solo retains shorter empty night turns.
 */
export function durationOf(match: Match, random: () => number = Math.random) {
  const { phase, turn, settings, solo } = match;
  if (phase === "ended") return 0;
  if (
    solo &&
    isNight(phase) &&
    turn &&
    !revealsOnDeath(settings) &&
    !holderAlive(match, turn)
  )
    return maskedSeconds(random);
  const timer =
    phase === "night" || phase === "potions"
      ? turn === "pack"
        ? "pack"
        : "night"
      : phase === "dayShot" || phase === "dawnShot"
        ? "shot"
        : phase;
  return matchSeconds(timer, Object.keys(match.seats).length, settings, solo);
}

const earlyPhases: ReadonlySet<Phase> = new Set([
  "night",
  "potions",
  "dawnShot",
  "mayorElection",
  "vote",
  "runoff",
  "mayorVerdict",
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
    (!match.solo &&
      (isNight(match.phase) ||
        match.phase === "dawnShot" ||
        match.phase === "dayShot")) ||
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
 * public. Multiplayer private-action windows use their full public duration.
 */
export function publicTiming(match: Doc<"matches">) {
  return {
    phase: isNight(match.phase) ? ("night" as const) : match.phase,
    end: match.end,
    turn: match.turn,
  };
}
