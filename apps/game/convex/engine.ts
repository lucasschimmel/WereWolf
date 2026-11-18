import { cardFor, maxCycles, plurality, victory } from "../shared/rules";
import type { Doc } from "./_generated/dataModel";

export type Match = Omit<Doc<"matches">, "_id" | "_creationTime">;
export const skip = "";
export const alive = (match: Match) =>
  Object.keys(match.seats).filter((id) => match.seats[id].alive);
export const camp = (match: Match, id: string) =>
  cardFor(match.seats[id].role, match.settings).camp;
export const hasHunter = (match: Match) =>
  Object.values(match.seats).some((seat) => seat.role === "hunter");

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
    if (ability.action === "activity" || ability.action === "inspect") {
      const result =
        ability.action === "activity"
          ? match.night[target]
            ? "active"
            : "idle"
          : camp(match, target);
      match.seats[id].intel.push(`${match.cycle}|${target}|${result}`);
    }
  }
  const targets = plurality(ballots);
  match.attack =
    targets.length === 1 && !protectedIds.has(targets[0]) ? targets[0] : skip;
  match.audit.push({
    cycle: match.cycle,
    label: "Actions de la première fenêtre",
    votes: { ...match.night },
  });
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
  return "night";
}
