import {
  cardFor,
  deckFor,
  type NightTurn,
  nightTurns,
  revealsOnDeath,
  type Settings,
  turnName,
} from "../../shared/rules";
import type { Step, Tone } from "../ui/PhaseClock";
import type { MatchView, View } from "./model";

export type Action = NonNullable<MatchView["action"]> | "poison";

/** What pointing does for each action, said in a few words. */
export const instructions: Record<Action, string> = {
  vote: "Pointe quelqu’un et clique · clic droit pour t’abstenir",
  shot: "Ta dernière flèche · pointe un vivant",
  wolf: "Pointez votre proie ensemble · égalité : pas d’attaque",
  inspect: "Pointe quelqu’un pour découvrir son camp",
  protect: "Pointe la personne à protéger de la meute",
  activity: "Pointe quelqu’un pour savoir s’il a agi cette nuit",
  poison: "Poison · pointe ta cible · clic droit pour annuler",
};

export const passLabels: Record<Action, string> = {
  vote: "S’abstenir",
  shot: "Ne pas tirer",
  wolf: "S’abstenir",
  inspect: "Passer",
  protect: "Passer",
  activity: "Passer",
  poison: "Annuler",
};

const turnTones: Partial<Record<NightTurn, Tone>> = {
  pack: "pack",
  seer: "seer",
  witch: "witch",
};

const shortName = (turn: NightTurn, settings: Settings) =>
  turn === "pack" ? "Meute" : turnName(turn, settings);

/**
 * The night's slots in play order, from the publicly dealt deck. When roles
 * are revealed on death, slots whose holder is known dead are left out. The
 * hunter has no night slot: his shot happens at dawn, once the deaths are known.
 */
export function nightSteps(room: View, match: MatchView): Step[] {
  let deck: ReturnType<typeof deckFor>;
  try {
    deck = deckFor(room.members.length, room.settings);
  } catch (cause) {
    console.warn("Night order unavailable for this deck", cause);
    return [];
  }
  const turns: NightTurn[] = [...nightTurns(deck)];
  if (deck.includes("witch")) turns.push("witch");
  const known = revealsOnDeath(room.settings)
    ? new Set(
        room.members
          .filter((member) => !member.alive && member.role)
          .map((member) => member.role),
      )
    : new Set<string>();
  const visible = turns.filter((turn) => {
    if (turn === match.turn) return true;
    const role = turn === "pack" ? "wolf" : turn;
    return turn === "pack" || !known.has(role);
  });
  const current = match.turn ? visible.indexOf(match.turn) : -1;
  return visible.map((turn, index) => ({
    label: shortName(turn, room.settings),
    state: index < current ? "done" : index === current ? "now" : "next",
  }));
}

type Situation = {
  room: View;
  match: MatchView;
  alive: boolean;
  aiming: Action | undefined;
  witchTurn: boolean;
};

/** The status line: a title, what to do now, and the colour of the moment. */
export function statusFor({
  room,
  match,
  alive,
  aiming,
  witchTurn,
}: Situation) {
  const name = (id?: string) =>
    room.members.find((member) => member.id === id)?.name;
  const choice = match.selected ? name(match.selected) : undefined;
  const echo = choice ? ` · ton choix : ${choice}` : "";
  const watching = alive ? undefined : "Tu observes en silence";
  switch (match.phase) {
    case "intro":
      return { title: "Distribution", detail: "Découvre ta carte, en secret" };
    case "night": {
      const turn = match.turn;
      const title = `Nuit ${match.cycle}${turn ? ` · ${shortName(turn, room.settings)}` : ""}`;
      const tone = (turn && turnTones[turn]) ?? "night";
      if (aiming)
        return { title, tone, detail: `${instructions[aiming]}${echo}` };
      if (witchTurn) return { title, tone, detail: "C’est ton tour" };
      if (match.action === "inspect" && match.selected)
        return { title, tone, detail: `Ta vision est faite · ${choice}` };
      return { title, tone, detail: watching ?? "Tu dors chez toi…" };
    }
    case "dawn":
      return { title: "Aube", detail: "Le village découvre la nuit" };
    case "debate":
      return {
        title: "Débat",
        detail: watching ?? "Parlez sur Discord · promène-toi sur la place",
      };
    case "vote":
      return {
        title: "Le village vote",
        detail: aiming ? `${instructions.vote}${echo}` : watching,
      };
    case "runoff":
      return {
        title: "Départage",
        detail: aiming
          ? `Seulement entre les ex æquo${echo}`
          : (watching ?? "Seulement entre les ex æquo"),
      };
    case "dawnShot":
    case "dayShot":
      return {
        title: "Le Chasseur riposte",
        tone: "hunter" as Tone,
        detail: aiming ? `${instructions.shot}${echo}` : "Il choisit sa cible…",
      };
    default:
      return { title: "Fin de partie" };
  }
}

/** Reads an intel entry ("cycle|target|result") as a short sentence. */
export function readIntel(room: View, entry: string) {
  const [cycle, target, result] = entry.split("|");
  const who = room.members.find((member) => member.id === target)?.name ?? "?";
  const camp =
    result === "pack"
      ? "la Meute"
      : result === "solo"
        ? "les Solitaires"
        : "le Village";
  return {
    cycle: Number(cycle),
    target,
    who,
    result,
    text:
      result === "active"
        ? `${who} a agi cette nuit`
        : result === "idle"
          ? `${who} n’a rien fait cette nuit`
          : `${who} appartient à ${camp}`,
  };
}

export const roleName = (room: View, role: Parameters<typeof cardFor>[0]) =>
  cardFor(role, room.settings).name;
