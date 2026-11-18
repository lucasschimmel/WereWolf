import { ChevronUp, RotateCcw, Skull } from "lucide-react";
import { useState } from "react";
import { cardFor, characters } from "../../shared/rules";
import { Emblem } from "../ui/cards";
import { Journal } from "./Ledger";
import type { MatchView, View } from "./model";

const verdicts = {
  village: {
    title: "Le Village l’emporte",
    detail: "La dernière griffe est tombée. Les lanternes peuvent se rallumer.",
  },
  pack: {
    title: "La Meute l’emporte",
    detail: "Le village s’est endormi pour de bon.",
  },
  solo: {
    title: "Le Bouffon l’emporte",
    detail: "Vous l’avez pendu. C’est exactement ce qu’il voulait.",
  },
  draw: {
    title: "Partie nulle",
    detail: "Personne ne verra l’aube triompher.",
  },
};

export function EndScreen({
  room,
  match,
  onRematch,
}: {
  room: View;
  match: MatchView;
  onRematch: () => void;
}) {
  const [folded, setFolded] = useState(false);
  const outcome = match.outcome ?? "draw";
  const verdict = verdicts[outcome];
  const me = room.members.find((member) => member.id === room.me);
  const myCamp = me?.role ? cardFor(me.role, room.settings).camp : undefined;
  const won = outcome !== "draw" && myCamp === outcome;
  return (
    <section
      className={`finale outcome-${outcome}${folded ? " folded" : ""}`}
      aria-label="Fin de partie"
    >
      <button
        type="button"
        className="finale-fold"
        aria-expanded={!folded}
        onClick={() => setFolded(!folded)}
      >
        <ChevronUp size={18} />{" "}
        {folded ? "Afficher le bilan" : "Voir le village"}
      </button>
      <header>
        <p className="finale-kicker">
          {won ? "Victoire" : outcome === "draw" ? "Égalité" : "Défaite"}
        </p>
        <h1>{verdict.title}</h1>
        <p>{verdict.detail}</p>
      </header>
      <ul className="finale-cast">
        {room.members.map((member, index) => {
          const card = member.role
            ? cardFor(member.role, room.settings)
            : undefined;
          const look = characters[member.character] ?? characters[0];
          return (
            <li
              key={member.id}
              className={`camp-${card?.camp ?? "village"}${member.alive ? "" : " fallen"}`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span
                className="finale-emblem"
                style={{ borderColor: look.color }}
              >
                {member.role && <Emblem role={member.role} size={20} />}
              </span>
              <strong>{member.name}</strong>
              <small>
                {card?.name}
                {!member.alive && <Skull size={11} />}
              </small>
            </li>
          );
        })}
      </ul>
      {match.audit && (
        <details className="finale-audit">
          <summary>Les coulisses de la nuit</summary>
          <Journal
            events={match.audit}
            members={room.members}
            settings={room.settings}
            audit
          />
        </details>
      )}
      <footer>
        {room.isHost ? (
          <button type="button" className="primary" onClick={onRematch}>
            <RotateCcw size={16} /> Retour au salon
          </button>
        ) : (
          <p className="dim">L’hôte va bientôt rouvrir le salon…</p>
        )}
      </footer>
    </section>
  );
}
