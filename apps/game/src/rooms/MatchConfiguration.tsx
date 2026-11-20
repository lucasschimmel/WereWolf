import { useState } from "react";
import type { ConfigurableRole } from "../../shared/match-options";
import {
  cardFor,
  configurableRoles,
  customCardCopies,
  customSettings,
  deckFor,
  maxCardCopies,
  modes,
  type Role,
  roleAvailable,
  type Settings,
} from "../../shared/rules";

function available(role: ConfigurableRole, count: number) {
  return role === "wolf" || roleAvailable(role, count, "custom");
}

export function MatchConfiguration({
  settings,
  count,
  deck,
  save,
}: {
  settings: Settings;
  count: number;
  deck: Role[];
  save?: (settings: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => customCardCopies(count, settings));
  const [saving, setSaving] = useState(false);
  const copies = save ? draft : customCardCopies(count, settings);
  const custom = settings.mode === "custom";
  const roles: readonly Role[] = save
    ? [...configurableRoles, "villager"]
    : custom
      ? [...configurableRoles.filter((role) => copies[role]), "villager"]
      : [...new Set(deck)];
  const villagers =
    count - Object.values(copies).reduce((sum, amount) => sum + amount, 0);
  const next = customSettings(settings.reveal, copies);
  let error = "";
  if (custom) {
    try {
      deckFor(count, next);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Paquet invalide.";
    }
  }

  return (
    <form
      className="match-configuration"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!save || saving || error) return;
        setSaving(true);
        try {
          await save(next);
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset disabled={saving}>
        <legend>
          {modes[settings.mode]} · {count} cartes
        </legend>
        {save && <p>Les places libres sont complétées par des Villageois.</p>}
        {roles.map((role) => {
          const name = cardFor(role, settings).name;
          const amount = !custom
            ? deck.filter((card) => card === role).length
            : role === "villager"
              ? Math.max(0, villagers)
              : (copies[role as ConfigurableRole] ?? 0);
          if (!save || role === "villager" || role.startsWith("custom:"))
            return (
              <div key={role} className="match-setting">
                <span>{name}</span>
                <strong>{amount}</strong>
              </div>
            );
          const editableRole = role as ConfigurableRole;
          const limit = available(editableRole, count)
            ? maxCardCopies(editableRole, count)
            : 0;
          const quantities = Array.from(
            { length: limit + 1 },
            (_, index) => index,
          );
          if (amount > limit) quantities.push(amount);
          return (
            <label key={role} className="match-setting">
              <span>
                {name}
                {limit === 0 && <small>Indisponible à cet effectif</small>}
              </span>
              <select
                aria-label={name}
                value={amount}
                disabled={limit === 0 && amount === 0}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [editableRole]: Number(event.target.value),
                  })
                }
              >
                {quantities.map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {error && (
          <p className="error" role="status">
            {error}
          </p>
        )}
      </fieldset>
      {save && (
        <button type="submit" className="primary" disabled={saving || !!error}>
          {saving ? "Enregistrement…" : "Appliquer au salon"}
        </button>
      )}
    </form>
  );
}
