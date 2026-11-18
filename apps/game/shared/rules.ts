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
    activity:
      "découvre si la cible a agi pendant la première fenêtre de la nuit",
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
  if (deck.filter((role) => role === "villager").length < 2)
    throw new Error("Garde au moins deux Villageois simples.");
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
  | "nightShot"
  | "dawn"
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
  nightShot: "Nuit",
  dawn: "Aube",
  debate: "Débat",
  vote: "Vote",
  runoff: "Départage",
  dayShot: "Riposte",
  ended: "Fin de partie",
};
export const isNight = (phase: Phase) =>
  phase === "night" || phase === "potions" || phase === "nightShot";
export function secondsFor(phase: Phase, count: number, mode: Mode) {
  const express = mode === "express";
  const small = count <= 10;
  return {
    intro: 45,
    night: 35,
    potions: 25,
    nightShot: 15,
    dawn: 10,
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
