import {
  Crosshair,
  Eye,
  FlaskConical,
  Ghost,
  Moon,
  PawPrint,
  Shield,
  Skull,
  Vote,
} from "lucide-react";
import { characters } from "../../shared/rules";
import type { MatchView, View } from "./model";

type Action = NonNullable<MatchView["action"]>;
const verbs: Record<
  Action,
  { title: string; hint: string; pass: string; Icon: typeof Vote }
> = {
  vote: {
    title: "Ton vote",
    hint: "Touche un villageois sur la place ou choisis ci-dessous.",
    pass: "S’abstenir",
    Icon: Vote,
  },
  shot: {
    title: "Ta dernière flèche",
    hint: "Emporte quelqu’un avec toi, ou épargne-les.",
    pass: "Ne pas tirer",
    Icon: Crosshair,
  },
  wolf: {
    title: "La proie de la meute",
    hint: "Les choix de la meute s’affichent en direct.",
    pass: "S’abstenir",
    Icon: PawPrint,
  },
  inspect: {
    title: "Sonder une âme",
    hint: "Tu découvriras son camp à l’aube.",
    pass: "Passer",
    Icon: Eye,
  },
  protect: {
    title: "Veiller sur quelqu’un",
    hint: "Protège une personne de la meute cette nuit.",
    pass: "Passer",
    Icon: Shield,
  },
  activity: {
    title: "Guetter une maison",
    hint: "Tu sauras si la personne a agi cette nuit.",
    pass: "Passer",
    Icon: Eye,
  },
};

function Person({ room, id }: { room: View; id: string }) {
  const member = room.members.find((entry) => entry.id === id);
  const look = characters[member?.character ?? 0] ?? characters[0];
  return (
    <>
      <span
        className="person-dot"
        style={{ background: look.color, borderColor: look.trim }}
        aria-hidden="true"
      />
      <span className="person-name">{member?.name ?? "?"}</span>
    </>
  );
}

export function ActionDock({
  room,
  match,
  choose,
}: {
  room: View;
  match: MatchView;
  choose: (action: Action | "heal" | "poison", target: string) => void;
}) {
  const me = room.members.find((member) => member.id === room.me);
  const action = match.action;
  if (match.phase === "ended") return null;
  if (!me?.alive && !action)
    return (
      <section className="dock dock-quiet" aria-label="Observation">
        <Ghost size={18} />
        <p>Ta lanterne s’est éteinte. Tu observes le village, en silence.</p>
      </section>
    );
  if (match.potions) {
    const { attack, targets, heal, poison } = match.potions;
    return (
      <section className="dock dock-witch" aria-label="Potions">
        <header>
          <FlaskConical size={18} />
          <div>
            <h3>Tes potions</h3>
            <p>
              {attack
                ? "La meute a frappé. Tu peux intervenir."
                : "Personne n’est visé, ou ton remède est épuisé."}
            </p>
          </div>
        </header>
        {attack && (
          <button
            type="button"
            className={`potion heal${heal ? " on" : ""}`}
            aria-pressed={heal}
            onClick={() => choose("heal", heal ? "" : attack)}
          >
            <span>Remède</span>
            <strong>
              Sauver <Person room={room} id={attack} />
            </strong>
          </button>
        )}
        {targets.length > 0 && (
          <div className="poison">
            <span className="dock-label">
              <Skull size={14} /> Poison
            </span>
            <div className="targets">
              {targets.map((id) => (
                <button
                  type="button"
                  key={id}
                  className="target danger"
                  aria-pressed={poison === id}
                  onClick={() => choose("poison", poison === id ? "" : id)}
                >
                  <Person room={room} id={id} />
                </button>
              ))}
            </div>
          </div>
        )}
        {!attack && targets.length === 0 && (
          <p className="dim">Tes fioles sont vides.</p>
        )}
      </section>
    );
  }
  if (!action) {
    if (match.phase !== "night") return null;
    return (
      <section className="dock dock-quiet" aria-label="Nuit">
        <Moon size={18} />
        <p>Tu dors à poings fermés. Rien à faire cette nuit… en apparence.</p>
      </section>
    );
  }
  const verb = verbs[action];
  const pack = new Map<string, string[]>();
  for (const [wolf, target] of Object.entries(match.wolves ?? {}))
    if (target) pack.set(target, [...(pack.get(target) ?? []), wolf]);
  const chosen = match.selected;
  return (
    <section className={`dock dock-${action}`} aria-label={verb.title}>
      <header>
        <verb.Icon size={18} />
        <div>
          <h3>{verb.title}</h3>
          <p>
            {chosen ? (
              <>
                Choix :{" "}
                <b>
                  {room.members.find((member) => member.id === chosen)?.name}
                </b>{" "}
                · modifiable jusqu’à la fin
              </>
            ) : (
              verb.hint
            )}
          </p>
        </div>
      </header>
      <div className="targets">
        {match.targets?.map((id) => (
          <button
            type="button"
            key={id}
            className={`target${action === "wolf" || action === "shot" ? " danger" : ""}`}
            aria-pressed={chosen === id}
            onClick={() => choose(action, id)}
          >
            <Person room={room} id={id} />
            {pack.has(id) && (
              <span
                className="pack-votes"
                title={pack
                  .get(id)
                  ?.map(
                    (wolf) =>
                      room.members.find((member) => member.id === wolf)?.name,
                  )
                  .join(", ")}
              >
                <PawPrint size={11} /> {pack.get(id)?.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ghost small"
        aria-pressed={chosen === ""}
        onClick={() => choose(action, "")}
      >
        {verb.pass}
      </button>
    </section>
  );
}
