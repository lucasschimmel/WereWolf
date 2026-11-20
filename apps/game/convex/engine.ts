import {
  cardFor,
  deckFor,
  isDayBallot,
  maxCycles,
  type NightTurn,
  nightTurns,
  type Phase,
  plurality,
  revealsOnDeath,
  roleChance,
  turnOf,
} from "../shared/rules";
import type { Doc } from "./_generated/dataModel";
import {
  convertWildChild,
  finishPackAttack,
  fireTargets,
  huntsWithPack,
  igniteChoice,
  packMembers,
  partnerOf,
  roleOf,
  setOutcome,
  specialNightAbility,
} from "./special";

export type Match = Omit<Doc<"matches">, "_id" | "_creationTime">;
export const skip = "";
export const alive = (match: Match) =>
  Object.keys(match.seats).filter((id) => match.seats[id].alive);
export const camp = (match: Match, id: string) =>
  cardFor(roleOf(match, id), match.settings).camp;
const dealt = (match: Match, role: string) =>
  Object.values(match.seats).some((seat) => seat.role === role);
export const hasWitch = (match: Match) => dealt(match, "witch");
const masksHunter = (match: Match) =>
  !match.solo &&
  !revealsOnDeath(match.settings) &&
  !match.settings.replaced.includes("hunter") &&
  roleChance("hunter", Object.keys(match.seats).length, match.settings) > 0;

export function dawnRequiresResolution(match: Match) {
  return (
    !!match.hunter ||
    (masksHunter(match) && !!match.events.at(-1)?.deaths?.length)
  );
}
export const deckTurns = (match: Match) =>
  nightTurns(Object.values(match.seats).map((seat) => seat.role));

/** Living seats whose card owns `turn`. */
export function turnHolders(match: Match, turn: NightTurn) {
  return alive(match).filter((id) => {
    const role = roleOf(match, id);
    if (turn === "pack") return huntsWithPack(role);
    return turnOf(role) === turn || role === turn;
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
  const possible =
    !match.solo &&
    match.settings.mode === "custom" &&
    match.settings.options?.chances
      ? deckFor(Object.keys(match.seats).length, match.settings, () => true)
      : undefined;
  const turns: NightTurn[] = (
    possible ? nightTurns(possible) : deckTurns(match)
  ).filter((turn) => turn !== "cupid" || match.cycle === 1);
  if (possible ? possible.includes("witch") : hasWitch(match))
    turns.push("witch");
  if (!revealsOnDeath(match.settings)) return turns;
  if (possible) {
    const announced = match.events.flatMap((event) => event.deaths ?? []);
    const expiredTurns = new Set(
      announced.map((id) => {
        const role = roleOf(match, id);
        return role === "witch" ? role : turnOf(role);
      }),
    );
    return turns.filter((turn) => turn === "pack" || !expiredTurns.has(turn));
  }
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
        return nightSelection(match, id) !== undefined;
      });
    }
    case "potions":
      return holderAlive(match, "witch") && match.done === true;
    case "dawnShot":
    case "dayShot":
      return !!match.hunter && match.done === true;
    case "vote":
    case "mayorElection":
    case "runoff": {
      const living = alive(match);
      return living.length > 0 && living.every((id) => id in match.votes);
    }
    case "mayorVerdict":
      return !!match.mayor && match.mayor in match.votes;
    default:
      return false;
  }
}

/** The night ability of `id`, only while its turn is the current one. */
export function turnAbility(match: Match, id: string) {
  const role = roleOf(match, id);
  if (match.phase === "intro" && role === "wildChild")
    return {
      action: "model",
      targets: alive(match).filter((other) => other !== id),
    } as const;
  if (
    match.phase !== "night" ||
    (match.turn === "pack" ? !huntsWithPack(role) : turnOf(role) !== match.turn)
  )
    return;
  return nightAbility(match, id);
}

export function nightSelection(match: Match, id: string) {
  if (match.phase === "intro") return match.model;
  return match.turn === "blackWolf" || match.turn === "whiteWolf"
    ? match.wolfPowers?.[id]
    : match.night[id];
}

/** Records a private observation and reveals it to the observer at once. */
export function inspect(match: Match, id: string, target: string) {
  match.night[id] = target;
  if (!target) return;
  match.seats[id].spent = true;
  const result =
    match.seats[id].role === "littleGirl"
      ? turnHolders(match, "pack").some((wolf) => match.night[wolf] === target)
        ? "packVoted"
        : "packDidNotVote"
      : camp(match, target);
  match.seats[id].intel.push(`${match.cycle}|${target}|${result}`);
}

export function nightAbility(match: Match, id: string) {
  const seat = match.seats[id];
  if (!seat.alive) return;
  const role = roleOf(match, id);
  const living = alive(match);
  if (role === "wolf" || (match.turn === "pack" && huntsWithPack(role)))
    return {
      action: "wolf",
      targets: living.filter((other) => !huntsWithPack(roleOf(match, other))),
    } as const;
  if (role === "seer")
    return {
      action: "inspect",
      targets: alive(match).filter((other) => other !== id),
    } as const;
  if (role === "littleGirl")
    return {
      action: "peek",
      targets: alive(match).filter((other) => other !== id),
    } as const;
  if (role === "guard")
    return {
      action: "protect",
      targets: alive(match).filter((other) => other !== seat.guard),
    } as const;
  if (!role.startsWith("custom:"))
    return specialNightAbility(match, id, living);
  const card = match.settings.custom[Number(role.slice(7))];
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
    const target = match.night[id];
    if (huntsWithPack(roleOf(match, id))) {
      if (target) ballots[id] = target;
      continue;
    }
    const ability = nightAbility(match, id);
    if (!ability) continue;
    if (ability.action === "protect") match.seats[id].guard = target || skip;
    if (!target) continue;
    match.seats[id].spent = true;
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
    votes: Object.fromEntries(
      Object.entries(match.night).filter(
        ([, target]) => target !== igniteChoice,
      ),
    ),
  });
}

/**
 * Closes the current night slot and returns the next phase. Action turns run
 * in `nightOrder`, then the witch (`potions`). The night's deaths are announced
 * at dawn; if a hunter is among them, his shot (`dawnShot`) follows the dawn.
 */
export function advanceNight(match: Match): Phase {
  if (match.phase === "night" || match.phase === "potions") {
    const order = nightOrder(match);
    const next = order[order.indexOf(match.turn ?? "pack") + 1];
    if (
      match.phase === "night" &&
      match.turn !== "blackWolf" &&
      (!next || next === "blackWolf" || next === "witch")
    )
      firstWindow(match);
    if (match.phase === "night" && next && next !== "witch") {
      match.turn = next;
      return "night";
    }
    if (match.phase === "night" && next === "witch") {
      match.turn = "witch";
      return "potions";
    }
    resolvePotions(match);
  }
  announceDeaths(match, "À l’aube");
  match.turn = undefined;
  return "dawn";
}
export function kill(match: Match, targets: string[]) {
  const victims = new Set(targets);
  for (const id of victims) {
    if (!id || !match.seats[id]?.alive) continue;
    match.seats[id].alive = false;
    if (huntsWithPack(roleOf(match, id)))
      match.seats[id].knownPack = packMembers(match);
    match.deaths.push(id);
    if (roleOf(match, id) === "hunter") match.hunter = id;
    const partner = partnerOf(match, id);
    if (partner) victims.add(partner);
  }
}
export function resolvePotions(match: Match) {
  const witch = Object.keys(match.seats).find(
    (id) => roleOf(match, id) === "witch",
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
  const living = alive(match);
  const fires = fireTargets(match, living);
  const white = living.find((id) => roleOf(match, id) === "whiteWolf");
  const betrayal = white ? match.wolfPowers?.[white] : undefined;
  if (white && betrayal) match.seats[white].spent = true;
  const otherDeaths = [match.poison, betrayal ?? skip, ...fires];
  const attack = finishPackAttack(match, living, otherDeaths);
  if (fires.length)
    match.audit.push({
      cycle: match.cycle,
      label: "Embrasement",
      deaths: fires,
    });
  if (betrayal)
    match.audit.push({
      cycle: match.cycle,
      label: "Trahison du Loup Blanc",
      deaths: [betrayal],
    });
  kill(match, [attack, ...otherDeaths]);
}
/**
 * Publishes the pending deaths. When a hunter is among them his shot is still
 * to come, so `match.hunter` is kept and the outcome is left to `finishDeaths`.
 */
export function announceDeaths(match: Match, label: string) {
  if (!match.hunter && !(masksHunter(match) && match.deaths.length))
    return finishDeaths(match, label);
  match.events.push({ cycle: match.cycle, label, deaths: [...match.deaths] });
  match.deaths = [];
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
  setOutcome(match, alive(match));
}

export function livingMayor(match: Match) {
  return match.mayor && match.seats[match.mayor]?.alive
    ? match.mayor
    : undefined;
}

export function dayAbility(match: Match, id: string) {
  if (!match.seats[id]?.alive) return;
  if (match.phase === "mayorVerdict") {
    if (livingMayor(match) === id)
      return {
        action: "decideTie",
        targets: match.runoff.filter((target) => match.seats[target]?.alive),
      } as const;
    return;
  }
  if (!isDayBallot(match.phase)) return;
  if (match.phase === "mayorElection")
    return { action: "electMayor", targets: alive(match) } as const;
  const candidates = match.phase === "runoff" ? match.runoff : alive(match);
  return {
    action: "vote",
    targets: candidates.filter((target) => target !== id),
  } as const;
}

export function beginDebate(match: Match): Phase {
  if (livingMayor(match)) return "debate";
  match.mayor = undefined;
  return "mayorElection";
}

export function finishElection(match: Match, random = Math.random): Phase {
  const leaders = plurality(match.votes);
  const mayor = leaders[Math.floor(random() * leaders.length)];
  match.mayor = mayor;
  match.events.push({
    cycle: match.cycle,
    label: "Élection du Maire",
    ...(mayor ? { mayor } : {}),
    votes: match.votes,
  });
  match.votes = {};
  return "debate";
}

function finishVerdict(match: Match, target?: string): Phase {
  if (target) {
    kill(match, [target]);
    if (roleOf(match, target) === "jester") {
      match.outcome = "solo";
      match.winner = target;
    }
  }
  if (target && masksHunter(match) && !match.outcome) {
    announceDeaths(match, "Verdict");
    return "dayShot";
  }
  if (match.hunter) return "dayShot";
  finishDeaths(match, "Verdict");
  return match.outcome ? "ended" : nextNight(match);
}

export function advanceDayBallot(match: Match): Phase {
  if (match.phase === "mayorVerdict") {
    const mayor = livingMayor(match);
    const target = mayor ? match.votes[mayor] : undefined;
    const validTarget =
      mayor && target && dayAbility(match, mayor)?.targets.includes(target)
        ? target
        : undefined;
    match.events.push({
      cycle: match.cycle,
      label: "Décision du Maire",
      votes: match.votes,
    });
    match.votes = {};
    return finishVerdict(match, validTarget);
  }

  const leaders = plurality(match.votes);
  match.events.push({
    cycle: match.cycle,
    label: match.phase === "vote" ? "Vote du village" : "Départage",
    votes: match.votes,
  });
  match.votes = {};
  if (leaders.length > 1) {
    match.runoff = leaders;
    if (match.phase === "vote") return "runoff";
    if (livingMayor(match)) return "mayorVerdict";
  }
  return finishVerdict(match, leaders.length === 1 ? leaders[0] : undefined);
}

export function nextNight(match: Match) {
  if (match.cycle >= maxCycles) {
    match.outcome ??= "draw";
    return "ended";
  }
  const living = alive(match);
  if (convertWildChild(match, living)) {
    setOutcome(match, living);
    if (match.outcome) return "ended";
  }
  match.cycle += 1;
  match.night = {};
  match.wolfPowers = undefined;
  if (match.marks)
    match.marks = match.marks.filter((id) => match.seats[id]?.alive);
  match.votes = {};
  match.runoff = [];
  match.attack = skip;
  match.heal = false;
  match.poison = skip;
  match.turn = nightOrder(match)[0];
  if (match.turn === "witch") return "potions";
  if (!match.turn) {
    announceDeaths(match, "À l’aube");
    return "dawn";
  }
  return "night";
}
