export const modes = {
  classic: "Classique",
  express: "Express",
  mystery: "Mystère",
  chaos: "Chaos",
  workshop: "Atelier",
} as const;
export type Mode = keyof typeof modes;
export const characters = [
  { name: "La Forestière", color: "#668859", trim: "#c4a86d" },
  { name: "Le Lanternier", color: "#b48349", trim: "#483344" },
  { name: "La Guérisseuse", color: "#925e84", trim: "#d3aa91" },
  { name: "Le Pêcheur", color: "#4b8492", trim: "#cbc09d" },
  { name: "La Bergère", color: "#ad5c54", trim: "#d9ccb2" },
  { name: "Le Veilleur", color: "#6575a4", trim: "#d2a458" },
  { name: "La Forgeronne", color: "#594b46", trim: "#c98059" },
  { name: "Le Meunier", color: "#a09560", trim: "#544332" },
] as const;
export type Camp = "village" | "pack" | "solo";
export const campNames: Record<Camp, string> = {
  village: "Village",
  pack: "Meute",
  solo: "Solitaire",
};
export const cards = {
  villager: {
    name: "Villageois",
    camp: "village",
    text: "Débats et vote pour découvrir les loups.",
  },
  wolf: {
    name: "Loup-garou",
    camp: "pack",
    text: "Vote avec la meute pour désigner une victime chaque nuit.",
  },
  seer: {
    name: "Voyante",
    camp: "village",
    text: "Découvre le camp d’un autre vivant chaque nuit.",
  },
  littleGirl: {
    name: "Petite Fille",
    camp: "village",
    text: "Chaque nuit, découvre si au moins un loup a voté contre un autre vivant de ton choix.",
  },
  guard: {
    name: "Veilleur",
    camp: "village",
    text: "Protège un vivant de la meute. Change de cible chaque nuit consécutive.",
  },
  hunter: {
    name: "Chasseur",
    camp: "village",
    text: "À ta mort, tu peux emporter un vivant avec toi.",
  },
  witch: {
    name: "Sorcière",
    camp: "village",
    text: "Un remède contre la meute et un poison à usage unique.",
  },
  jester: {
    name: "Bouffon",
    camp: "solo",
    text: "Remporte la partie si le verdict d’un vote de jour t’élimine.",
  },
} as const;
export type Role = keyof typeof cards | "custom:0" | "custom:1";
export type CustomCard = {
  name: string;
  flavor: string;
  effect: "camp" | "protect" | "activity";
  target: "self" | "other" | "any";
  uses: "first" | "once" | "repeat";
  avoidRepeat: boolean;
};
export type Settings = {
  mode: Mode;
  reveal: boolean;
  custom: CustomCard[];
  replaced: Role[];
};
export const defaultSettings: Settings = {
  mode: "classic",
  reveal: true,
  custom: [],
  replaced: [],
};
export const defaultCustom: CustomCard = {
  name: "",
  flavor: "",
  effect: "activity",
  target: "other",
  uses: "once",
  avoidRepeat: false,
};
export const minPlayers = 8;
export const maxPlayers = 15;
export const maxCycles = 7;
export function minForMode(mode: Mode) {
  return mode === "chaos" ? 12 : mode === "mystery" ? 10 : minPlayers;
}
export function cardFor(role: Role, settings: Settings) {
  if (!role.startsWith("custom:")) return cards[role as keyof typeof cards];
  const card = settings.custom[Number(role.slice(7))];
  const targets = {
    self: "toi-même",
    other: "un autre vivant",
    any: "un vivant",
  };
  const times = {
    first: "Première nuit",
    once: "Une fois par partie",
    repeat: "Chaque nuit",
  };
  const effects = {
    camp: "découvre son camp",
    protect: "protège la cible de la meute",
    activity: "découvre si la cible a agi cette nuit, hors potions et ripostes",
  };
  const repeat = card.avoidRepeat
    ? " Change de cible chaque nuit consécutive."
    : "";
  return {
    ...card,
    camp: "village" as const,
    text: `${times[card.uses]}, sélectionne ${targets[card.target]} et ${effects[card.effect]}.${repeat}`,
  };
}
export function deckFor(count: number, settings: Settings): Role[] {
  if (
    !Number.isInteger(count) ||
    count < minForMode(settings.mode) ||
    count > maxPlayers
  )
    throw new Error("Effectif incompatible avec ce mode.");
  const wolves = count < 10 ? 2 : count < 14 ? 3 : 4;
  const deck: Role[] = Array.from({ length: wolves }, () => "wolf");
  deck.push("seer", count < 10 ? "guard" : "witch");
  if (count >= 9) deck.push("hunter");
  if (count === 10 || count === 11) deck.push("littleGirl");
  if (settings.mode === "chaos") deck.push("jester");
  while (deck.length < count) deck.push("villager");
  if (settings.mode !== "workshop") return deck;
  if (
    settings.custom.length > 2 ||
    settings.custom.length !== settings.replaced.length
  )
    throw new Error("L’Atelier accepte deux remplacements au maximum.");
  const names = new Set<string>();
  for (const [index, card] of settings.custom.entries()) {
    const name = card.name.trim().toLowerCase();
    if (
      !name ||
      name.length > 32 ||
      card.flavor.length > 140 ||
      names.has(name)
    )
      throw new Error("Donne à chaque carte un nom distinct et valide.");
    names.add(name);
    const replaced = settings.replaced[index];
    const slot = deck.indexOf(replaced);
    if (slot < 0 || replaced === "wolf" || replaced.startsWith("custom:"))
      throw new Error("Cette carte ne peut pas être remplacée dans ce paquet.");
    if (
      card.avoidRepeat &&
      (card.effect !== "protect" || card.uses !== "repeat")
    )
      throw new Error(
        "La restriction de cible est réservée aux protections récurrentes.",
      );
    deck[slot] = index === 0 ? "custom:0" : "custom:1";
  }
  const protection = settings.custom.filter(
    (card) => card.effect === "protect",
  ).length;
  const inspection = settings.custom.filter(
    (card) => card.effect !== "protect" && card.uses === "repeat",
  ).length;
  if (
    deck.filter((role) => role === "villager" || role === "littleGirl").length <
    2
  )
    throw new Error("Garde au moins deux cartes Villageois ou Petite Fille.");
  if (protection + Number(deck.includes("guard") || deck.includes("witch")) > 1)
    throw new Error(
      "Le paquet accepte une seule carte de protection ou de soin.",
    );
  if (inspection + Number(deck.includes("seer")) > 1)
    throw new Error("Le paquet accepte une seule observation récurrente.");
  return deck;
}
export type Phase =
  | "intro"
  | "night"
  | "potions"
  | "dawn"
  | "dawnShot"
  | "debate"
  | "vote"
  | "runoff"
  | "dayShot"
  | "ended";
export type Outcome = Camp | "draw";
export const phaseNames: Record<Phase, string> = {
  intro: "Distribution",
  night: "Nuit",
  potions: "Nuit",
  dawn: "Aube",
  dawnShot: "Riposte",
  debate: "Débat",
  vote: "Vote",
  runoff: "Départage",
  dayShot: "Riposte",
  ended: "Fin de partie",
};
export const isNight = (phase: Phase) =>
  phase === "night" || phase === "potions";

/** Whether a dead player's role is shown to everyone (same rule as `game.view`). */
export const revealsOnDeath = (settings: Settings) =>
  settings.mode !== "mystery" &&
  (settings.mode !== "workshop" || settings.reveal);

/**
 * Night turns, in play order. When roles are revealed on death, a turn whose
 * holder is dead is skipped. In hidden modes (Mystery, Workshop without
 * reveal) the slot is kept so the deck stays public, but a dead holder only
 * gets a short random masked window (`maskedSeconds`), and a live holder's
 * turn never ends before `hiddenFloorSeconds`, so timing cannot single out a
 * role. A turn also ends early (`graceSeconds`) once its actors are done.
 * `witch` maps to the `potions` phase. The hunter has no night slot: if he died
 * during the night, his shot is the `dawnShot` phase right after the dawn
 * announcement.
 */
export const turnOrder = [
  "pack",
  "littleGirl",
  "seer",
  "guard",
  "custom:0",
  "custom:1",
] as const;
export type ActionTurn = (typeof turnOrder)[number];
export type NightTurn = ActionTurn | "witch";
export function turnOf(role: Role): ActionTurn | undefined {
  if (role === "wolf") return "pack";
  return (turnOrder as readonly string[]).includes(role)
    ? (role as ActionTurn)
    : undefined;
}
export function nightTurns(roles: Iterable<Role>): ActionTurn[] {
  const present = new Set<string>();
  for (const role of roles) {
    const turn = turnOf(role);
    if (turn) present.add(turn);
  }
  return turnOrder.filter((turn) => present.has(turn));
}
export function turnSeconds(turn: NightTurn) {
  return turn === "pack" ? 30 : 20;
}
/** Masked window bounds for a dead holder's slot in hidden modes (seconds). */
export const maskedRange = { min: 4, max: 8 } as const;
/** Minimum total length of a night slot in hidden modes (seconds). */
export const hiddenFloorSeconds = 4;
/** Pause between "everyone is done" and the end of the slot (seconds). */
export function graceSeconds(turn: NightTurn | undefined) {
  return turn === "seer" ? 2 : 3;
}
/** A whole number of seconds in `maskedRange`; `random` returns [0, 1). */
export function maskedSeconds(random: () => number = Math.random) {
  const { min, max } = maskedRange;
  return min + Math.floor(random() * (max - min + 1));
}
/**
 * When a slot whose actors are done should end (epoch ms): after the grace,
 * not before `floorSeconds` since it started, never later than its original
 * deadline.
 */
export function earlyEndAt(slot: {
  now: number;
  started: number;
  deadline: number;
  graceSeconds: number;
  floorSeconds: number;
}) {
  const wanted = Math.max(
    slot.now + slot.graceSeconds * 1000,
    slot.started + slot.floorSeconds * 1000,
  );
  return Math.min(slot.deadline, wanted);
}
export function turnName(turn: NightTurn, settings: Settings) {
  if (turn === "pack") return "La Meute";
  return cardFor(turn, settings).name;
}
export function secondsFor(phase: Phase, count: number, mode: Mode) {
  const express = mode === "express";
  const small = count <= 10;
  return {
    intro: 45,
    night: turnSeconds("seer"),
    potions: turnSeconds("witch"),
    dawn: 10,
    dawnShot: 15,
    debate: express ? (small ? 75 : 100) : small ? 150 : 180,
    vote: express ? 20 : 30,
    runoff: express ? 15 : 20,
    dayShot: 15,
    ended: 0,
  }[phase];
}
export function plurality(votes: Record<string, string>) {
  const totals = new Map<string, number>();
  for (const target of Object.values(votes)) {
    if (target) totals.set(target, (totals.get(target) ?? 0) + 1);
  }
  const max = Math.max(0, ...totals.values());
  return [...totals].filter(([, count]) => count === max).map(([id]) => id);
}
export function victory(alive: Camp[]): Outcome | undefined {
  if (alive.length === 0) return "draw";
  const wolves = alive.filter((camp) => camp === "pack").length;
  if (wolves === 0 && alive.includes("village")) return "village";
  if (wolves > 0 && wolves * 2 >= alive.length) return "pack";
  if (wolves === 0) return "draw";
}
