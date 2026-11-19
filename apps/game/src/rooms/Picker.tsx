import { Maximize, RotateCw } from "lucide-react";
import { characters } from "../../shared/rules";
import { canLockLandscape, enterLandscape } from "../ui/device";
import type { View } from "./model";

/**
 * Touch targeting: every valid target as a large button, plus the pass
 * action. Tapping a 3D puppet still works; this list is the reliable path on
 * a small screen. During a vote, each name shows its live public ballots.
 */
export function TargetPicker({
  room,
  targets,
  selected,
  ballots,
  passLabel,
  onSelect,
  onPass,
}: {
  room: View;
  targets: string[];
  selected?: string;
  ballots?: Record<string, string>;
  passLabel: string;
  onSelect: (id: string) => void;
  onPass: () => void;
}) {
  const counts = new Map<string, number>();
  for (const target of Object.values(ballots ?? {}))
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  const people = room.members.filter((member) => targets.includes(member.id));
  return (
    <section className="picker" aria-label="Choisir une cible">
      <ul>
        {people.map((member) => {
          const look = characters[member.character] ?? characters[0];
          const votes = counts.get(member.id) ?? 0;
          return (
            <li key={member.id}>
              <button
                type="button"
                aria-pressed={selected === member.id}
                onClick={() => onSelect(member.id)}
              >
                <span
                  className="person-dot"
                  style={{ background: look.color, borderColor: look.trim }}
                  aria-hidden="true"
                />
                <span className="picker-name">{member.name}</span>
                {votes > 0 && (
                  <span
                    className="picker-votes"
                    role="img"
                    aria-label={`${votes} voix`}
                  >
                    {votes}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="picker-pass" onClick={onPass}>
        {passLabel}
      </button>
    </section>
  );
}

/**
 * Shown over the room on a touch device held upright: the village is played
 * in landscape. Where the browser allows it, one tap goes full screen and
 * locks the orientation.
 */
export function RotatePrompt() {
  return (
    <div className="rotate" role="dialog" aria-label="Tourne ton téléphone">
      <RotateCw size={44} aria-hidden="true" />
      <h2>Tourne ton téléphone</h2>
      <p>Le village se joue à l’horizontale.</p>
      {canLockLandscape() && (
        <button
          type="button"
          className="primary"
          onClick={() => void enterLandscape()}
        >
          <Maximize size={16} /> Plein écran
        </button>
      )}
    </div>
  );
}
