import {
  type CardCopies,
  type ConfigurableRole,
  type MatchOptions,
  minVillagers,
  packSize,
  percent,
  type Timer,
} from "./match-options.ts";

export const modes = {
  classic: "Classique",
  express: "Express",
  mystery: "Mystère",
  chaos: "Chaos",
  workshop: "Atelier",
  custom: "Personnalisé",
} as const;
export type Mode = keyof typeof modes;
/**
 * The professions players pick in the lobby, one per seat. A profession is a
 * look, a home sign and (later) a night pastime: it never relates to the role
 * card, and no profession name may collide with a card name.
 */
export const characters = [
  {
    id: "forester",
    name: "La Forestière",
    craft: "Bûches et cueillette",
    color: "#3f6b45",
    trim: "#c4a86d",
  },
  {
    id: "lanterner",
    name: "Le Lanternier",
    craft: "Lanternes de toutes les couleurs",
    color: "#9c7a3c",
    trim: "#4a3344",
  },
  {
    id: "herbalist",
    name: "L’Herboriste",
    craft: "Simples séchés et décoctions",
    color: "#7fa36a",
    trim: "#3d2f4a",
  },
  {
    id: "fisher",
    name: "Le Pêcheur",
    craft: "Filets, nasses et barque",
    color: "#3f8a8f",
    trim: "#cbc09d",
  },
  {
    id: "shepherd",
    name: "La Bergère",
    craft: "Moutons et laine filée",
    color: "#b0524a",
    trim: "#e2d4b8",
  },
  {
    id: "ringer",
    name: "Le Sonneur",
    craft: "Cloches et carillons",
    color: "#5a6fa8",
    trim: "#d2a458",
  },
  {
    id: "smith",
    name: "La Forgeronne",
    craft: "Fer battu sur l’enclume",
    color: "#4d4440",
    trim: "#d9783a",
  },
  {
    id: "miller",
    name: "Le Meunier",
    craft: "Farine du moulin",
    color: "#d8cfa0",
    trim: "#6b5536",
  },
  {
    id: "baker",
    name: "Le Boulanger",
    craft: "Miches et brioches au four",
    color: "#c97b35",
    trim: "#f0dcb0",
  },
  {
    id: "carpenter",
    name: "Le Menuisier",
    craft: "Planches et figurines sculptées",
    color: "#7a5232",
    trim: "#d9b98a",
  },
  {
    id: "seamstress",
    name: "La Couturière",
    craft: "Broderies et linge coloré",
    color: "#8e4f86",
    trim: "#e6c3a0",
  },
  {
    id: "potter",
    name: "La Potière",
    craft: "Jarres montées au tour",
    color: "#8f8a80",
    trim: "#b8705a",
  },
  {
    id: "beekeeper",
    name: "L’Apicultrice",
    craft: "Ruches de paille et miel",
    color: "#e3a52b",
    trim: "#3a2a1c",
  },
  {
    id: "scribe",
    name: "Le Copiste",
    craft: "Plumes, encres et enluminures",
    color: "#3d3f7a",
    trim: "#e8dcc0",
  },
  {
    id: "cheesemaker",
    name: "Le Fromager",
    craft: "Meules affinées",
    color: "#9fb8c8",
    trim: "#5a4632",
  },
] as const;
export type Profession = (typeof characters)[number]["id"];

/**
 * The first profession nobody at the table wears yet, starting from the
 * preferred one. There are as many professions as seats, so one is always free.
 */
export function freeCharacter(taken: Iterable<number>, preferred = 0) {
  const used = new Set(taken);
  const start = Number.isInteger(preferred) ? preferred : 0;
  for (let step = 0; step < characters.length; step++) {
    const index =
      (((start + step) % characters.length) + characters.length) %
      characters.length;
    if (!used.has(index)) return index;
  }
  return 0;
}
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
  necromancer: {
    name: "Nécromancien",
    camp: "village",
    text: "Vois les fantômes des morts. Chaque nuit, échange avec eux dans le chat des esprits.",
  },
  arsonist: {
    name: "Pyromane",
    camp: "solo",
    text: "Asperge jusqu’à deux autres vivants d’essence. Une nuit suivante, embrase tes cibles une seule fois. Gagne si tu survis seul.",
  },
  wildChild: {
    name: "Enfant Sauvage",
    camp: "village",
    text: "Choisis un modèle à la distribution. S’il meurt, rejoins la Meute au début de la nuit suivante.",
  },
  cupid: {
    name: "Cupidon",
    camp: "village",
    text: "La première nuit, lie deux autres vivants. Ils se reconnaissent en privé et gardent leurs conditions de victoire. Si l’un meurt, l’autre meurt aussi.",
  },
  whiteWolf: {
    name: "Loup Blanc",
    camp: "solo",
    text: "Chasse avec la Meute. Une fois, tu peux éliminer un autre loup pendant la nuit. Gagne si tu survis seul.",
  },
  blackWolf: {
    name: "Loup Noir",
    camp: "pack",
    text: "Chasse avec la Meute. Une fois, tu peux infecter sa cible. Elle survit et devient loup si la Sorcière n’annule pas l’attaque.",
  },
} as const;
export type Role = keyof typeof cards | "custom:0" | "custom:1";
export const optionalRoles = [
  "seer",
  "guard",
  "witch",
  "hunter",
  "littleGirl",
  "jester",
  "necromancer",
  "arsonist",
  "wildChild",
  "cupid",
  "whiteWolf",
  "blackWolf",
] as const;
export type OptionalRole = (typeof optionalRoles)[number];
export const configurableRoles = ["wolf", ...optionalRoles] as const;
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
  roleOverrides?: Partial<Record<OptionalRole, boolean>>;
  copies?: CardCopies;
  options?: MatchOptions;
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

export function roleAvailable(role: OptionalRole, count: number, mode: Mode) {
  if (role === "seer" || role === "guard") return true;
  if (role === "hunter") return count >= 9;
  if (role === "witch") return count >= 10;
  if (role === "littleGirl") return count === 10 || count === 11;
  if (role === "necromancer") return count >= 12 && mode !== "express";
  if (role === "cupid") return count >= 10 && mode !== "express";
  if (role === "wildChild") return count >= 12 && mode !== "express";
  return (
    count >= 12 &&
    (mode === "chaos" || mode === "workshop" || mode === "custom")
  );
}

export function roleChance(
  role: OptionalRole,
  count: number,
  settings: Settings,
) {
  if (!roleAvailable(role, count, settings.mode)) return percent.min;
  if (settings.mode === "custom" && settings.copies)
    return settings.copies[role] ? percent.max : percent.min;
  const chance =
    settings.mode === "custom" ? settings.options?.chances?.[role] : undefined;
  if (chance !== undefined) return chance;
  const presets =
    role === "seer" ||
    role === "hunter" ||
    (role === "guard" && count < 10) ||
    (role === "witch" && count >= 10) ||
    role === "littleGirl" ||
    (settings.mode === "mystery" && role === "necromancer") ||
    (settings.mode === "chaos" &&
      (role === "jester" ||
        role === "cupid" ||
        (role === "arsonist" && count >= 13)));
  return (settings.roleOverrides?.[role] ?? presets)
    ? percent.max
    : percent.min;
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
function wolfCount(count: number, settings: Settings) {
  const custom =
    settings.mode === "custom" ? settings.options?.wolves : undefined;
  return custom ?? (count < 10 ? 2 : count < 14 ? 3 : 4);
}

export function customCardCopies(
  count: number,
  settings: Settings,
): CardCopies {
  if (settings.copies) return settings.copies;
  const copies: CardCopies = {};
  for (const role of optionalRoles) {
    if (roleChance(role, count, settings) === percent.max) copies[role] = 1;
  }
  copies.wolf =
    wolfCount(count, settings) - (copies.blackWolf || copies.whiteWolf || 0);
  return copies;
}

export function customSettings(reveal: boolean, copies?: CardCopies): Settings {
  return {
    ...defaultSettings,
    mode: "custom",
    reveal,
    ...(copies ? { copies } : {}),
  };
}

export function maxCardCopies(role: ConfigurableRole, count: number) {
  switch (role) {
    case "wolf":
      return Math.min(packSize.max, Math.floor((count - 1) / 2));
    case "seer":
    case "guard":
    case "littleGirl":
    case "jester":
      return count - minVillagers - packSize.min;
    default:
      return 1;
  }
}

function customDeck(count: number, copies: CardCopies): Role[] {
  const deck: Role[] = [];
  for (const role of configurableRoles) {
    const amount = copies[role] ?? 0;
    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > maxCardCopies(role, count)
    )
      throw new Error(
        `Quantité invalide pour la carte « ${cards[role].name} ».`,
      );
    if (amount && role !== "wolf" && !roleAvailable(role, count, "custom"))
      throw new Error(
        `La carte « ${cards[role].name} » est indisponible à ${count} joueurs.`,
      );
    for (let index = 0; index < amount; index++) deck.push(role);
  }
  const variants = (copies.blackWolf ?? 0) + (copies.whiteWolf ?? 0);
  if (variants + (copies.wildChild ?? 0) > 1)
    throw new Error(
      "Choisis une seule variante parmi l’Enfant Sauvage, le Loup Blanc et le Loup Noir.",
    );
  const wolves = (copies.wolf ?? 0) + variants;
  if (wolves < packSize.min)
    throw new Error(
      "Ajoute au moins une carte de Loup-garou, Loup Noir ou Loup Blanc.",
    );
  if (wolves > packSize.max || wolves * 2 >= count)
    throw new Error(
      "La Meute doit être minoritaire et compter au plus quatre cartes.",
    );
  if (count - deck.length < minVillagers)
    throw new Error("Garde au moins deux places pour les Villageois.");
  return deck.concat(Array<Role>(count - deck.length).fill("villager"));
}

/** includeChance supports night slots in matches started with legacy probabilities. */
export function deckFor(
  count: number,
  settings: Settings,
  includeChance?: (chance: number) => boolean,
): Role[] {
  if (
    !Number.isInteger(count) ||
    count < minForMode(settings.mode) ||
    count > maxPlayers
  )
    throw new Error("Effectif incompatible avec ce mode.");
  if (settings.mode === "custom" && (!includeChance || settings.copies))
    return customDeck(count, customCardCopies(count, settings));
  const wolves = wolfCount(count, settings);
  if (wolves * 2 >= count)
    throw new Error("La Meute doit être minoritaire au lancement.");
  const deck: Role[] = Array.from({ length: wolves }, () => "wolf");
  const enabled = optionalRoles.filter((role) => {
    const chance = roleChance(role, count, settings);
    return (
      chance === percent.max ||
      (chance > percent.min && includeChance?.(chance))
    );
  });
  const wolfVariants = enabled.filter(
    (role) => role === "whiteWolf" || role === "blackWolf",
  );
  if (
    wolfVariants.length > 1 ||
    (wolfVariants.length && enabled.includes("wildChild"))
  )
    throw new Error(
      "Active une seule variante de Meute parmi l’Enfant Sauvage, le Loup Blanc et le Loup Noir.",
    );
  if (wolfVariants[0]) deck[0] = wolfVariants[0];
  deck.push(
    ...enabled.filter((role) => role !== "whiteWolf" && role !== "blackWolf"),
  );
  if (count - deck.length < 2)
    throw new Error("Garde au moins deux places pour les Villageois.");
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
    if (
      slot < 0 ||
      replaced.startsWith("custom:") ||
      replaced === "wolf" ||
      replaced === "whiteWolf" ||
      replaced === "blackWolf"
    )
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
  | "mayorElection"
  | "debate"
  | "vote"
  | "runoff"
  | "mayorVerdict"
  | "dayShot"
  | "ended";
export type Outcome = Camp | "draw";
export const phaseNames: Record<Phase, string> = {
  intro: "Distribution",
  night: "Nuit",
  potions: "Nuit",
  dawn: "Aube",
  dawnShot: "Riposte",
  mayorElection: "Élection du Maire",
  debate: "Débat",
  vote: "Vote",
  runoff: "Départage",
  mayorVerdict: "Décision du Maire",
  dayShot: "Riposte",
  ended: "Fin de partie",
};
export const isNight = (phase: Phase) =>
  phase === "night" || phase === "potions";
export const isDayBallot = (phase: Phase) =>
  phase === "mayorElection" || phase === "vote" || phase === "runoff";

/** Whether a dead player's role is shown to everyone (same rule as `game.view`). */
export const revealsOnDeath = (settings: Settings) =>
  settings.mode !== "mystery" &&
  ((settings.mode !== "workshop" && settings.mode !== "custom") ||
    settings.reveal);

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
  "cupid",
  "pack",
  "littleGirl",
  "seer",
  "guard",
  "whiteWolf",
  "arsonist",
  "custom:0",
  "custom:1",
  "blackWolf",
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
    if (role === "whiteWolf" || role === "blackWolf") present.add("pack");
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
    mayorElection: 20,
    debate: express ? (small ? 75 : 100) : small ? 150 : 180,
    vote: express ? 20 : 30,
    runoff: express ? 15 : 20,
    mayorVerdict: 15,
    dayShot: 15,
    ended: 0,
  }[phase];
}

const soloDebateSeconds = 45;

export function matchSeconds(
  timer: Timer,
  count: number,
  settings: Settings,
  solo = false,
) {
  const custom =
    settings.mode === "custom" ? settings.options?.timings?.[timer] : undefined;
  if (custom !== undefined) return custom;
  if (timer === "pack") return turnSeconds("pack");
  const seconds = secondsFor(
    timer === "shot" ? "dayShot" : timer,
    count,
    settings.mode,
  );
  return solo && timer === "debate"
    ? Math.min(seconds, soloDebateSeconds)
    : seconds;
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
