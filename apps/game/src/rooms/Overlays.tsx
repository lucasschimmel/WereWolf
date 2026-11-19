import { useEffect } from "react";
import { cardFor, type Role, type Settings } from "../../shared/rules";
import { RoleArt, RoleCard } from "../ui/cards";
import type { MatchView, View } from "./model";

const campGems: Record<string, string> = {
  village: "#5fbf6a",
  pack: "#e5483b",
  solo: "#b78cf2",
};

/**
 * The witch's turn, at home: her card, who the pack struck, the remedy as a
 * single click, and the poison which sends her out to point at someone.
 */
export function WitchTurn({
  room,
  potions,
  onHeal,
  onPoison,
  onClearPoison,
  onDone,
}: {
  room: View;
  potions: NonNullable<MatchView["potions"]>;
  onHeal: (on: boolean) => void;
  onPoison: () => void;
  onClearPoison: () => void;
  onDone: () => void;
}) {
  const name = (id: string) =>
    room.members.find((member) => member.id === id)?.name ?? "?";
  const { attack, targets, heal, poison } = potions;
  return (
    <section className="turn witch" aria-labelledby="witch-title">
      <RoleCard kind="witch" settings={room.settings} className="turn-card" />
      <div className="turn-body">
        <p className="kicker">Ton tour</p>
        <h2 id="witch-title">
          {attack ? `La meute a frappé ${name(attack)}.` : "Personne à sauver."}
        </h2>
        <p className="lead">
          {attack
            ? "Tu peux le sauver, empoisonner quelqu’un, ou les deux."
            : "Ta fiole de remède est vide, ou la meute n’a frappé personne."}
        </p>
        <div className="choices">
          {attack && (
            <button
              type="button"
              className="choice heal"
              aria-pressed={heal}
              onClick={() => onHeal(!heal)}
            >
              <b>{heal ? "Remède versé" : `Remède · sauver ${name(attack)}`}</b>
              <small>
                {heal
                  ? "Appuie encore pour reprendre ta fiole"
                  : "Ta seule fiole de remède"}
              </small>
            </button>
          )}
          {poison ? (
            <button
              type="button"
              className="choice poison"
              aria-pressed
              onClick={onClearPoison}
            >
              <b>Poison · {name(poison)}</b>
              <small>Appuie encore pour reprendre ta fiole</small>
            </button>
          ) : (
            targets.length > 0 && (
              <button
                type="button"
                className="choice poison"
                onClick={onPoison}
              >
                <b>Poison · aller sur la place</b>
                <small>Tu sors et tu pointes ta cible</small>
              </button>
            )
          )}
          {!attack && targets.length === 0 && (
            <p className="lead">Tes fioles sont vides.</p>
          )}
          <button
            type="button"
            className="choice done"
            disabled={potions.done}
            onClick={onDone}
          >
            <b>{potions.done ? "Validé" : "Valider"}</b>
            <small>
              {potions.done
                ? "La nuit avance dans un instant"
                : "Termine ton tour sans attendre"}
            </small>
          </button>
        </div>
      </div>
    </section>
  );
}

/** A seer-style result: a small card about the observed player. */
export function Vision({
  room,
  target,
  result,
  packVote,
  text,
  onDone,
}: {
  room: View;
  target: string;
  result: string;
  packVote: boolean;
  text: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 6500);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  const member = room.members.find((entry) => entry.id === target);
  const camp =
    packVote || result === "active" || result === "idle" ? undefined : result;
  return (
    <div className="vision" role="status" aria-live="polite">
      <div className="vision-card">
        <span className="vision-head">
          <strong>{member?.name ?? "?"}</strong>
          {camp && (
            <svg viewBox="0 0 28 28" aria-hidden="true">
              <path
                d="M14 2 L25 14 L14 26 L3 14 Z"
                fill={campGems[camp] ?? "#efe6d3"}
                stroke="#f5eedd"
                strokeWidth="2"
              />
            </svg>
          )}
        </span>
        <span className="vision-art">
          <RoleArt kind={packVote ? "littleGirl" : "seer"} />
        </span>
        <span className="vision-text">{text}</span>
      </div>
    </div>
  );
}

/** Final board: every card face up, the dead greyed out. */
export function EndScreen({
  room,
  match,
  onRematch,
  onAudit,
}: {
  room: View;
  match: MatchView;
  onRematch: () => void;
  onAudit: () => void;
}) {
  const outcome = match.outcome ?? "draw";
  const me = room.members.find((member) => member.id === room.me);
  const verdicts = {
    village: ["Le Village l’emporte", "La dernière griffe est tombée."],
    pack: ["La Meute l’emporte", "Le village ne verra pas l’aube."],
    solo: [
      "Le Bouffon l’emporte",
      "Vous l’avez pendu. C’est ce qu’il voulait.",
    ],
    draw: ["Partie nulle", "Personne ne triomphe."],
  } as const;
  const [title, detail] = verdicts[outcome];
  const myRole = me?.role as Role | undefined;
  const settings: Settings = room.settings;
  const won =
    outcome !== "draw" &&
    myRole !== undefined &&
    cardFor(myRole, settings).camp === outcome;
  return (
    <section
      className={`finale outcome-${outcome}`}
      aria-labelledby="finale-title"
    >
      <p className="kicker">
        {outcome === "draw" ? "Égalité" : won ? "Victoire" : "Défaite"} · nuit{" "}
        {match.cycle}
      </p>
      <h1 id="finale-title">{title}</h1>
      <p className="lead">{detail}</p>
      <ul className="finale-cast">
        {room.members.map((member) =>
          member.role ? (
            <li key={member.id} className={member.alive ? "" : "fallen"}>
              <RoleCard kind={member.role} settings={settings} size="hand" />
              <span>{member.name}</span>
            </li>
          ) : null,
        )}
      </ul>
      <div className="finale-actions">
        {room.isHost ? (
          <button type="button" className="primary" onClick={onRematch}>
            Rejouer avec le même paquet
          </button>
        ) : (
          <p className="hint">L’hôte va bientôt rouvrir le salon…</p>
        )}
        <button type="button" className="secondary" onClick={onAudit}>
          Les coulisses de la partie
        </button>
      </div>
    </section>
  );
}
