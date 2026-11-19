import {
  cardFor,
  type NightTurn,
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

/** The same instructions for a finger: tap a puppet or use the list. */
export const touchInstructions: Record<Action, string> = {
  vote: "Touche quelqu’un ou choisis dans la liste",
  shot: "Ta dernière flèche · choisis un vivant",
  wolf: "Choisissez votre proie ensemble · égalité : pas d’attaque",
  inspect: "Choisis quelqu’un pour découvrir son camp",
  protect: "Choisis la personne à protéger de la meute",
  activity: "Choisis quelqu’un pour savoir s’il a agi cette nuit",
  poison: "Poison · choisis ta cible",
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

export function nightSteps(room: View, match: MatchView): Step[] {
  const turns = match.nightOrder ?? [];
  const current = match.turn ? turns.indexOf(match.turn) : -1;
  return turns.map((turn, index) => ({
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
  /** Touch device: instructions talk about tapping, not clicking. */
  touch?: boolean;
};

/** The status line: a title, what to do now, and the colour of the moment. */
export function statusFor({
  room,
  match,
  alive,
  aiming,
  witchTurn,
  touch = false,
}: Situation) {
  const name = (id?: string) =>
    room.members.find((member) => member.id === id)?.name;
  const choice = match.selected ? name(match.selected) : undefined;
  const said = touch ? touchInstructions : instructions;
  const echo = choice ? ` · ton choix : ${choice}` : "";
  const watching = alive ? undefined : "Tu observes en silence";
  switch (match.phase) {
    case "intro":
      return { title: "Distribution", detail: "Découvre ta carte, en secret" };
    case "night": {
      const turn = match.turn;
      const title = `Nuit ${match.cycle}${turn ? ` · ${shortName(turn, room.settings)}` : ""}`;
      const tone = (turn && turnTones[turn]) ?? "night";
      if (aiming) return { title, tone, detail: `${said[aiming]}${echo}` };
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
        detail: aiming ? `${said.vote}${echo}` : watching,
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
        detail: aiming ? `${said.shot}${echo}` : "Il choisit sa cible…",
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
