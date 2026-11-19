import { useState } from "react";
import {
  type CustomCard,
  cardFor,
  deckFor,
  defaultCustom,
  type Role,
  type Settings,
} from "../../shared/rules";

export function Workshop({
  settings,
  count,
  save,
}: {
  settings: Settings;
  count: number;
  save: (settings: Settings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const roles = [
    ...new Set(deckFor(Math.max(count, 8), { ...settings, mode: "classic" })),
  ].filter((role) => role !== "wolf");
  const change = (index: number, patch: Partial<CustomCard>) =>
    setDraft({
      ...draft,
      custom: draft.custom.map((card, i) =>
        i === index ? { ...card, ...patch } : card,
      ),
    });
  return (
    <div className="workshop">
      <label className="check">
        <input
          type="checkbox"
          checked={draft.reveal}
          onChange={(e) => setDraft({ ...draft, reveal: e.target.checked })}
        />{" "}
        Révéler les rôles à la mort
      </label>
      {draft.custom.map((card, index) => (
        <fieldset key={draft.replaced[index] + String(index)}>
          <legend>Carte {index + 1}</legend>
          <label>
            Remplace
            <select
              value={draft.replaced[index]}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  replaced: draft.replaced.map((role, i) =>
                    i === index ? (e.target.value as Role) : role,
                  ),
                })
              }
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {cardFor(role, draft).name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nom
            <input
              value={card.name}
              maxLength={32}
              onChange={(e) => change(index, { name: e.target.value })}
            />
          </label>
          <label>
            Ambiance
            <input
              value={card.flavor}
              maxLength={140}
              onChange={(e) => change(index, { flavor: e.target.value })}
            />
          </label>
          <label>
            Effet
            <select
              value={card.effect}
              onChange={(e) =>
                change(index, {
                  effect: e.target.value as CustomCard["effect"],
                  avoidRepeat: false,
                })
              }
            >
              <option value="activity">Observer l’activité</option>
              <option value="camp">Observer le camp</option>
              <option value="protect">Protéger de la meute</option>
            </select>
          </label>
          <label>
            Cible
            <select
              value={card.target}
              onChange={(e) =>
                change(index, {
                  target: e.target.value as CustomCard["target"],
                })
              }
            >
              <option value="other">Un autre vivant</option>
              <option value="self">Soi-même</option>
              <option value="any">N’importe quel vivant</option>
            </select>
          </label>
          <label>
            Usages
            <select
              value={card.uses}
              onChange={(e) =>
                change(index, {
                  uses: e.target.value as CustomCard["uses"],
                  avoidRepeat: false,
                })
              }
            >
              <option value="once">Une fois par partie</option>
              <option value="first">Première nuit</option>
              <option value="repeat">Chaque nuit</option>
            </select>
          </label>
          {card.effect === "protect" && card.uses === "repeat" && (
            <label className="check">
              <input
                type="checkbox"
                checked={card.avoidRepeat}
                onChange={(e) =>
                  change(index, { avoidRepeat: e.target.checked })
                }
              />{" "}
              Changer de cible chaque nuit
            </label>
          )}
          <p>{cardFor(index === 0 ? "custom:0" : "custom:1", draft).text}</p>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                custom: draft.custom.filter((_, i) => i !== index),
                replaced: draft.replaced.filter((_, i) => i !== index),
              })
            }
          >
            Retirer la carte
          </button>
        </fieldset>
      ))}
      {draft.custom.length < 2 && (
        <button
          type="button"
          onClick={() =>
            setDraft({
              ...draft,
              custom: [...draft.custom, defaultCustom],
              replaced: [...draft.replaced, "villager"],
            })
          }
        >
          Ajouter une carte
        </button>
      )}
      <button type="button" className="primary" onClick={() => save(draft)}>
        Appliquer au salon
      </button>
    </div>
  );
}
