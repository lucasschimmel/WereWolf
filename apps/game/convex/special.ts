import { cardFor, type Role, victory } from "../shared/rules";
import type { Match } from "./engine";

export const roleOf = (match: Match, id: string): Role =>
  match.seats[id].converted ? "wolf" : match.seats[id].role;

export function huntsWithPack(role: Role) {
  return role === "wolf" || role === "whiteWolf" || role === "blackWolf";
}

export const packMembers = (match: Match) =>
  Object.keys(match.seats).filter((id) => huntsWithPack(roleOf(match, id)));

export function partnerOf(match: Match, id: string) {
  const pair = match.lovers;
  if (pair?.length === 2 && pair.includes(id))
    return pair.find((other) => other !== id);
}

export function specialNightAbility(
  match: Match,
  id: string,
  living: string[],
) {
  const role = roleOf(match, id);
  const others = living.filter((other) => other !== id);
  switch (role) {
    case "cupid":
      if (match.cycle === 1)
        return {
          action: "link",
          targets: others.filter((other) => !match.lovers?.includes(other)),
        } as const;
      return;
    case "whiteWolf":
      if (!match.seats[id].spent)
        return {
          action: "betray",
          targets: others.filter((other) =>
            huntsWithPack(roleOf(match, other)),
          ),
        } as const;
      return;
    case "blackWolf":
      if (!match.infected)
        return {
          action: "infect",
          targets: match.attack ? [match.attack] : [],
        } as const;
      return;
    case "arsonist":
      if (!match.ignited)
        return {
          action: "douse",
          targets:
            (match.marks?.length ?? 0) < 2
              ? others.filter((other) => !match.marks?.includes(other))
              : [],
        } as const;
  }
}

export const igniteChoice = "ignite";

export function fireTargets(match: Match, living: string[]) {
  const pyromane = living.find((id) => roleOf(match, id) === "arsonist");
  if (!pyromane || match.ignited) return [];
  const target = match.night[pyromane];
  if (!target) return [];
  if (target === igniteChoice) {
    match.ignited = true;
    return match.marks ?? [];
  }
  match.marks = [...(match.marks ?? []), target];
  return [];
}

export function finishPackAttack(
  match: Match,
  living: string[],
  otherDeaths: string[],
) {
  if (match.heal || !match.attack) return "";
  const black = living.find((id) => roleOf(match, id) === "blackWolf");
  if (!match.infected && black && match.wolfPowers?.[black] === match.attack) {
    match.infected = true;
    if (!otherDeaths.includes(match.attack)) {
      match.seats[match.attack].converted = true;
      match.audit.push({
        cycle: match.cycle,
        label: "Infection du Loup Noir",
        votes: { [black]: match.attack },
      });
    }
    return "";
  }
  return match.attack;
}

export function convertWildChild(match: Match, living: string[]) {
  if (!match.model || match.seats[match.model]?.alive) return false;
  const child = living.find((id) => roleOf(match, id) === "wildChild");
  if (!child) return false;
  match.seats[child].converted = true;
  return true;
}

export function setOutcome(match: Match, living: string[]) {
  if (match.outcome) return;
  const lone = living[0];
  if (
    living.length === 1 &&
    ["whiteWolf", "arsonist"].includes(roleOf(match, lone))
  ) {
    match.outcome = "solo";
    match.winner = lone;
    return;
  }
  const camps = living.map(
    (id) => cardFor(roleOf(match, id), match.settings).camp,
  );
  // An antagonist can continue the match after the last ordinary wolf dies.
  const contender = living.some((id) =>
    ["whiteWolf", "arsonist"].includes(roleOf(match, id)),
  );
  if (contender && !camps.includes("pack")) return;
  match.outcome = victory(camps);
}
