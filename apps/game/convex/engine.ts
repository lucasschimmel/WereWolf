import {
  cardFor,
  maxCycles,
  type NightTurn,
  nightTurns,
  type Phase,
  plurality,
  revealsOnDeath,
  turnOf,
  victory,
} from "../shared/rules";
import type { Doc } from "./_generated/dataModel";

export type Match = Omit<Doc<"matches">, "_id" | "_creationTime">;
export const skip = "";
export const alive = (match: Match) =>
  Object.keys(match.seats).filter((id) => match.seats[id].alive);
export const camp = (match: Match, id: string) =>
  cardFor(match.seats[id].role, match.settings).camp;
const dealt = (match: Match, role: string) =>
  Object.values(match.seats).some((seat) => seat.role === role);
export const hasWitch = (match: Match) => dealt(match, "witch");
export const deckTurns = (match: Match) =>
  nightTurns(Object.values(match.seats).map((seat) => seat.role));

/** Living seats whose card owns `turn`. The hunter's shot has no night holder. */
export function turnHolders(match: Match, turn: NightTurn) {
  return alive(match).filter((id) => {
    const role = match.seats[id].role;
    return turn === "hunter" ? false : turnOf(role) === turn || role === turn;
  });
}
export const holderAlive = (match: Match, turn: NightTurn) =>
  turnHolders(match, turn).length > 0;

/**
 * The night slots that will actually run, in order: the dealt deck's action
 * turns then the witch. Holders that are dead have their slot skipped when
 * roles are revealed on death; hidden modes keep every dealt slot.
 */
export function nightOrder(match: Match): NightTurn[] {
  const turns: NightTurn[] = [...deckTurns(match)];
  if (hasWitch(match)) turns.push("witch");
  if (!revealsOnDeath(match.settings)) return turns;
  return turns.filter((turn) => holderAlive(match, turn));
}

/**
 * Whether everyone who can act in the current slot has finished, so the slot
 * may end after a short grace instead of waiting for its timer. Debate, intro
 * and dawn are never complete.
 */
export function isTurnComplete(match: Match): boolean {
  switch (match.phase) {
    case "night": {
      if (!match.turn) return false;
      const holders = turnHolders(match, match.turn);
      if (holders.length === 0) return false;
      return holders.every((id) => {
        if (!nightAbility(match, id)) return true;
        // Wolves abstain with "" and the seer passes with "": both are keys.
        return match.night[id] !== undefined;
      });
    }
    case "potions":
      return holderAlive(match, "witch") && match.done === true;
    case "nightShot":
    case "dayShot":
      return !!match.hunter && match.done === true;
    case "vote":
    case "runoff": {
      const living = alive(match);
      return living.length > 0 && living.every((id) => id in match.votes);
    }
    default:
      return false;
  }
}

/** The night ability of `id`, only while its turn is the current one. */
export function turnAbility(match: Match, id: string) {
  if (match.phase !== "night" || turnOf(match.seats[id].role) !== match.turn)
    return;
  return nightAbility(match, id);
}

/** Records a seer-style observation and reveals it to the observer at once. */
export function inspect(match: Match, id: string, target: string) {
  match.night[id] = target;
  if (!target) return;
  match.seats[id].spent = true;
  match.seats[id].intel.push(`${match.cycle}|${target}|${camp(match, target)}`);
}

export function nightAbility(match: Match, id: string) {
  const seat = match.seats[id];
  if (!seat.alive) return;
  if (seat.role === "wolf")
    return {
      action: "wolf",
      targets: alive(match).filter((other) => camp(match, other) !== "pack"),
    } as const;
  if (seat.role === "seer")
    return {
      action: "inspect",
      targets: alive(match).filter((other) => other !== id),
    } as const;
  if (seat.role === "guard")
    return {
      action: "protect",
      targets: alive(match).filter((other) => other !== seat.guard),
    } as const;
  if (!seat.role.startsWith("custom:")) return;
  const card = match.settings.custom[Number(seat.role.slice(7))];
  if (
    (card.uses === "first" && match.cycle !== 1) ||
    (card.uses === "once" && seat.spent)
  )
    return;
  const targets = alive(match).filter(
    (other) =>
      (card.target === "any" ||
        (card.target === "self" ? other === id : other !== id)) &&
      (!card.avoidRepeat || other !== seat.guard),
  );
  return {
    action: card.effect === "camp" ? "inspect" : card.effect,
    targets,
  } as const;
}
export function firstWindow(match: Match) {
  const ballots: Record<string, string> = {};
  const protectedIds = new Set<string>();
  for (const id of alive(match)) {
    const ability = nightAbility(match, id);
    const target = match.night[id];
    if (!ability) continue;
    if (ability.action === "protect") match.seats[id].guard = target || skip;
    if (!target) continue;
    match.seats[id].spent = true;
    if (ability.action === "wolf") ballots[id] = target;
    if (ability.action === "protect") protectedIds.add(target);
    // Inspections are revealed during their own turn by `inspect`.
    if (ability.action === "activity") {
      const result = match.night[target] ? "active" : "idle";
      match.seats[id].intel.push(`${match.cycle}|${target}|${result}`);
    }
  }
  const targets = plurality(ballots);
  match.attack =
    targets.length === 1 && !protectedIds.has(targets[0]) ? targets[0] : skip;
  match.audit.push({
    cycle: match.cycle,
    label: "Actions de la nuit",
    votes: { ...match.night },
  });
}

/**
 * Closes the current night slot and returns the next phase. Action turns run
 * in `nightOrder`, then the witch (`potions`). The hunter's `nightShot` only
 * runs when a hunter died during the night (`match.hunter`), like `dayShot`.
 */
export function advanceNight(match: Match): Phase {
  if (match.phase === "night" || match.phase === "potions") {
    const order = nightOrder(match);
    const next = order[order.indexOf(match.turn ?? "pack") + 1];
    if (match.phase === "night" && next && next !== "witch") {
      match.turn = next;
      return "night";
    }
    if (match.phase === "night") firstWindow(match);
    if (match.phase === "night" && next === "witch") {
      match.turn = "witch";
      return "potions";
    }
    resolvePotions(match);
    if (match.hunter) {
      match.turn = "hunter";
      return "nightShot";
    }
  }
  finishDeaths(match, "À l’aube");
  match.turn = undefined;
  return "dawn";
}
export function kill(match: Match, targets: string[]) {
  for (const id of new Set(targets)) {
    if (!id || !match.seats[id]?.alive) continue;
    match.seats[id].alive = false;
    match.deaths.push(id);
    if (match.seats[id].role === "hunter") match.hunter = id;
  }
}
export function resolvePotions(match: Match) {
  const witch = Object.keys(match.seats).find(
    (id) => match.seats[id].role === "witch",
  );
  if (witch && match.heal) match.seats[witch].heal = false;
  if (witch && match.poison) match.seats[witch].poison = false;
  const potionChoices: Record<string, string> = {};
  if (match.heal) potionChoices.Remede = match.attack;
  if (match.poison) potionChoices.Poison = match.poison;
  match.audit.push({
    cycle: match.cycle,
    label: "Potions",
    votes: potionChoices,
  });
  kill(match, [match.heal ? skip : match.attack, match.poison]);
}
export function finishDeaths(match: Match, label: string) {
  if (match.shot)
    match.audit.push({
      cycle: match.cycle,
      label: "Tir du Chasseur",
      deaths: [match.shot],
    });
  kill(match, [match.shot]);
  match.events.push({ cycle: match.cycle, label, deaths: [...match.deaths] });
  match.deaths = [];
  match.hunter = skip;
  match.shot = skip;
  match.outcome ??= victory(alive(match).map((id) => camp(match, id)));
}
export function nextNight(match: Match) {
  if (match.cycle >= maxCycles) {
    match.outcome ??= "draw";
    return "ended";
  }
  match.cycle += 1;
  match.night = {};
  match.votes = {};
  match.runoff = [];
  match.attack = skip;
  match.heal = false;
  match.poison = skip;
  // The pack always acts first and is alive while the match runs.
  match.turn = nightOrder(match)[0];
  return "night";
}
