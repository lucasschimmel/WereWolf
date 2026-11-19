import { ChevronLeft, ChevronRight } from "lucide-react";
import { characters } from "../../shared/rules";

/** Previous / next look, plus one swatch per puppet. */
export function LookPicker({
  look,
  onPick,
}: {
  look: number;
  onPick: (index: number) => void;
}) {
  const current = characters[look] ?? characters[0];
  return (
    <div className="look">
      <span className="field-label">Apparence</span>
      <div className="look-row">
        <button
          type="button"
          className="icon-button"
          aria-label="Apparence précédente"
          onClick={() => onPick(look - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{current.name}</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Apparence suivante"
          onClick={() => onPick(look + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="swatches">
        {characters.map((character, index) => (
          <button
            type="button"
            key={character.name}
            aria-label={character.name}
            aria-pressed={index === look}
            style={{ background: character.color, borderColor: character.trim }}
            onClick={() => onPick(index)}
          />
        ))}
      </div>
    </div>
  );
}
