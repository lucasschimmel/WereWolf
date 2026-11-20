import { cards } from "../../shared/rules";
import { roleTips } from "../ui/guideData";
import type { Action } from "./hud";
import type { MatchView } from "./model";

/** What each action means and why you would take it, for the solo coach. */
const actionTips: Record<Action, string> = {
  wolf: "Toute la Meute doit viser la même proie : en cas d’égalité, ou si l’un de vous s’abstient, il n’y a pas d’attaque.",
  inspect:
    "Tu découvres le camp d’une personne, pas sa carte. Note ce que tu apprends : c’est ton arme au débat.",
  peek: "Tu apprends si un loup a voté contre ta cible cette nuit. Ça ne dit pas si elle est loup.",
  protect:
    "Si la Meute attaque la personne que tu protèges, elle survit. Tu ne peux pas protéger la même personne deux nuits de suite.",
  activity:
    "Tu apprends si ta cible a agi cette nuit. Un villageois sans pouvoir reste « inactif ».",
  model:
    "S’il meurt, tu rejoindras la Meute. Choisis quelqu’un qui a l’air solide.",
  link: "Les deux personnes liées se reconnaissent en privé. Si l’une meurt, l’autre meurt aussi.",
  douse:
    "Asperge jusqu’à deux personnes, puis « Embraser » une nuit suivante pour toutes les éliminer d’un coup.",
  betray:
    "Tu peux éliminer un autre loup, une seule fois dans la partie. Tu gagnes seul.",
  infect:
    "La victime de la Meute survit et devient loup, sauf si la Sorcière sauve ou si l’attaque échoue. Une seule fois.",
  electMayor:
    "Le Maire tranche les égalités lors des verdicts. Vote pour quelqu’un de fiable.",
  vote: "Tu peux changer de vote jusqu’à la fin du temps : le village voit les bulletins. Une égalité mène à un départage.",
  decideTie:
    "Les votes sont à égalité : tu es le Maire, c’est à toi de départager (ou de ne tuer personne).",
  shot: "Tu étais le Chasseur : emporte avec toi la personne que tu soupçonnes le plus.",
  poison:
    "Le poison élimine la personne visée à l’aube. Il ne sert qu’une fois dans la partie.",
};

/**
 * One short piece of advice for the solo player, from what they can do now
 * (their action) or, failing that, from the phase. Undefined when there is
 * nothing useful to add.
 */
export function coachTip(
  match: MatchView,
  alive: boolean,
  action: Action | undefined,
  witchTurn: boolean,
): string | undefined {
  if (match.phase === "ended") return undefined;
  if (match.potions?.done || match.shotDone) return undefined;
  if (!alive)
    return "Tu es éliminé : tu observes la partie. Les morts peuvent parler entre eux dans le chat.";
  if (witchTurn)
    return "Tu vois la victime de la Meute : « Remède » pour la sauver, « Poison » pour éliminer quelqu’un. Chaque potion ne sert qu’une fois. Clique sur « Valider le tour » quand ton choix est fait.";
  if (action) return actionTips[action];
  switch (match.phase) {
    case "intro":
      return `Tu es ${cards[match.role as keyof typeof cards]?.name ?? "…"}. ${
        roleTips[match.role as keyof typeof roleTips] ?? ""
      } Touche ta carte, en bas à gauche, pour la relire.`;
    case "night":
      return "La nuit, chaque pouvoir joue à son tour (l’ordre est affiché en haut). Quand ce n’est pas ton tour, tu dors : attends la suite.";
    case "dawn":
      return "Les morts de la nuit sont annoncés. Regarde le journal du village pour relire ce qui s’est passé.";
    case "debate":
      return "Débat : accuse, défends-toi et lis le chat. Rien ne presse : passe à l’étape suivante quand tu es prêt.";
    case "dawnShot":
    case "dayShot":
      return "Le Chasseur riposte avant de mourir tout à fait.";
    case "vote":
    case "runoff":
    case "mayorElection":
    case "mayorVerdict":
      return "C’est un vote : pointe quelqu’un, ou abstiens-toi.";
    default:
      return undefined;
  }
}
