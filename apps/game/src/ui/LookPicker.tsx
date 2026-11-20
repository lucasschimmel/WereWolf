import { ChevronLeft, ChevronRight } from "lucide-react";
import { characters } from "../../shared/rules";

const count = characters.length;
const wrap = (index: number) => ((index % count) + count) % count;

/**
 * Previous / next profession, plus one swatch per profession. Professions
 * worn by someone else at the table are greyed out and skipped.
 */
export function LookPicker({
  look,
  taken,
  onPick,
}: {
  look: number;
  /** Profession index → name of the player who already wears it. */
  taken?: ReadonlyMap<number, string>;
  onPick: (index: number) => void;
}) {
  const current = characters[look] ?? characters[0];
  const step = (direction: 1 | -1) => {
    for (let offset = 1; offset < count; offset++) {
      const next = wrap(look + direction * offset);
      if (!taken?.has(next)) return onPick(next);
    }
  };
  return (
    <div className="look">
      <span className="field-label">Métier</span>
      <div className="look-row">
        <button
          type="button"
          className="icon-button"
          aria-label="Métier précédent"
          onClick={() => step(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="look-name">
          <strong>{current.name}</strong>
          <small>{current.craft}</small>
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Métier suivant"
          onClick={() => step(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="swatches">
        {characters.map((character, index) => {
          const wearer = index === look ? undefined : taken?.get(index);
          const label = wearer
            ? `${character.name}, déjà pris par ${wearer}`
            : character.name;
          return (
            <button
              type="button"
              key={character.id}
              aria-label={label}
              title={label}
              aria-pressed={index === look}
              disabled={wearer !== undefined}
              style={{
                background: character.color,
                borderColor: character.trim,
              }}
              onClick={() => onPick(index)}
            />
          );
        })}
      </div>
    </div>
  );
}
