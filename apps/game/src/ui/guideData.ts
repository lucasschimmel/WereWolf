import {
  type cards,
  maxCycles,
  maxPlayers,
  minPlayers,
} from "../../shared/rules";

/** One piece of advice per card, shared by the guide and the solo coach. */
export const roleTips: Record<keyof typeof cards, string> = {
  villager:
    "Observe qui vote comment et repère les incohérences. Défends-toi calmement : un villageois qui panique ressemble à un loup.",
  wolf: "Mens avec naturel. Accuse un villageois plutôt que de te taire, et ne défends pas trop ouvertement tes complices.",
  seer: "Les loups te chassent en priorité : ne révèle ta carte qu’au bon moment, avec tes résultats comme preuves.",
  littleGirl:
    "Tu apprends si un loup a visé quelqu’un cette nuit. Précieux, mais dangereux à partager.",
  guard:
    "Protège celui que la meute veut sans doute tuer, souvent la Voyante supposée. Jamais deux nuits de suite la même personne.",
  hunter:
    "Ta mort est une arme : les loups hésiteront à t’attaquer. Au moment de tirer, vise ton suspect principal.",
  witch:
    "Garde le remède pour une cible importante et le poison pour un loup quasi certain. Chaque potion ne sert qu’une fois.",
  jester:
    "Fais-toi voter ! Sois suspect sans être évident : si le verdict du jour t’élimine, tu gagnes seul.",
  necromancer:
    "Écoute les esprits la nuit : les morts savent des choses que les vivants ignorent.",
  arsonist:
    "Asperge deux joueurs, puis embrase-les au bon moment. Tu gagnes seul : reste discret jusqu’au bout.",
  wildChild:
    "Choisis un modèle fiable et protège-le : s’il meurt, tu rejoins la Meute.",
  cupid:
    "Les deux liés se reconnaissent en privé : choisis des personnes qui pourront se croire mutuellement.",
  whiteWolf:
    "Tu chasses avec la Meute mais tu gagnes seul. Élimine un autre loup une fois, quand cela ne te trahit pas.",
  blackWolf:
    "Infecte la victime d’une nuit pour recruter un loup. Attention : la Sorcière peut annuler l’attaque.",
};

export const camps = [
  {
    name: "Village",
    tone: "village",
    goal: "Éliminer tous les loups.",
    detail:
      "Les villageois ne se connaissent pas : ils débattent, enquêtent avec leurs pouvoirs et votent chaque jour pour éliminer un suspect.",
  },
  {
    name: "Meute",
    tone: "pack",
    goal: "Être aussi nombreux que les autres vivants.",
    detail: `Les loups se reconnaissent. Chaque nuit ils dévorent un villageois, chaque jour ils se fondent dans la foule. Ils gagnent dès qu’ils sont au moins la moitié des vivants.`,
  },
  {
    name: "Solitaires",
    tone: "solo",
    goal: "Une victoire à part.",
    detail:
      "Le Bouffon gagne si le village l’élimine par son vote. Le Loup Blanc et le Pyromane gagnent seuls, en étant le dernier survivant.",
  },
] as const;

export const timeline = [
  {
    title: "Distribution",
    text: "Tu découvres ta carte en secret. Les loups se reconnaissent entre eux. L’Enfant Sauvage choisit son modèle.",
  },
  {
    title: "La nuit",
    text: "Le village dort. Chaque carte à pouvoir joue à son tour, dans l’ordre affiché en haut : Cupidon (première nuit seulement), la Meute, la Petite Fille, la Voyante, le Veilleur, puis les rôles spéciaux et la Sorcière. En solo, la nuit peut avancer dès que tout le monde a joué. En multijoueur, le minuteur nocturne est commun à tous.",
  },
  {
    title: "L’aube",
    text: "Les morts de la nuit sont annoncés et leur carte est révélée (sauf en mode Mystère). Si le Chasseur est mort, il riposte aussitôt.",
  },
  {
    title: "Le Maire",
    text: "Au premier débat, le village élit un Maire. Chacun peut voter, y compris pour soi. Le Maire tranche les égalités lors des verdicts.",
  },
  {
    title: "Le débat",
    text: "Parlez, accusez, défendez-vous, promenez-vous sur la place. Le chat permet aussi de discuter par écrit. La durée dépend du mode.",
  },
  {
    title: "Le vote",
    text: "Chaque vivant désigne quelqu’un, ou s’abstient. Les bulletins sont publics et modifiables jusqu’à la fin du temps. En cas d’égalité, un départage a lieu entre les ex æquo ; si l’égalité persiste, le Maire tranche, sinon personne ne meurt.",
  },
  {
    title: "Et on recommence",
    text: `Nuit après nuit, jusqu’à une victoire. Sans vainqueur après ${maxCycles} nuits, la partie finit par une égalité.`,
  },
] as const;

export const modeGuide = [
  {
    name: "Classique",
    text: "Les cartes des morts sont révélées, les bulletins sont publics. Le mode de référence pour apprendre.",
  },
  {
    name: "Express",
    text: "Même nuit, mais débats et votes raccourcis. Pour des parties rapides.",
  },
  {
    name: "Mystère",
    text: "À partir de 10 joueurs. La carte des morts reste secrète : on déduit l’identité des disparus.",
  },
  {
    name: "Chaos",
    text: "À partir de 12 joueurs. Un Bouffon, Cupidon et (dès 13) un Pyromane se glissent dans le village.",
  },
  {
    name: "Atelier",
    text: "Invente jusqu’à deux cartes de ton choix, remplace des cartes du paquet et joue avec.",
  },
] as const;

export const controls = {
  desktop: [
    ["Z Q S D", "te promener sur la place"],
    ["Glisser", "regarder autour de toi"],
    ["Survoler", "viser un joueur"],
    ["Clic", "valider ton choix"],
    ["Clic droit", "passer ou s’abstenir"],
    ["Tab · Entrée", "jouer au clavier"],
  ],
  touch: [
    ["Mode paysage", "le village se joue à l’horizontale"],
    ["Joystick", "te déplacer"],
    ["Glisser", "regarder autour de toi"],
    ["Toucher un joueur", "le choisir, ou passer par la liste"],
  ],
} as const;

export const basics = [
  `De ${minPlayers} à ${maxPlayers} joueurs. Le nombre de loups dépend de l’effectif : 2 jusqu’à 9 joueurs, 3 de 10 à 13, 4 au-delà.`,
  "Ta carte (en bas à gauche) peut être relue à tout moment.",
  "Le chat et le journal du village sont dans le menu en haut à droite.",
  "Quand tu es éliminé, tu observes et tu peux parler avec les autres morts.",
] as const;
