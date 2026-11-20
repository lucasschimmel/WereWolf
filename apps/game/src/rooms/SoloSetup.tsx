import {
  cardFor,
  type Mode,
  maxPlayers,
  minForMode,
  type Role,
  type Settings,
} from "../../shared/rules";

/** Practice table: how many seats, and which card to play. */
export function SoloSetup({
  count,
  mode,
  deck,
  settings,
  role,
  onCount,
  onRole,
}: {
  count: number;
  mode: Mode;
  deck: Role[];
  settings: Settings;
  role?: string;
  onCount: (players: number) => void;
  onRole: (role: string) => void;
}) {
  const roles = [...new Set(deck)];
  const sizes = Array.from(
    { length: maxPlayers - minForMode(mode) + 1 },
    (_, index) => minForMode(mode) + index,
  );
  return (
    <div className="solo-setup">
      <label className="field">
        <span>Joueurs à table · toi + bots</span>
        <select
          value={count}
          onChange={(event) => onCount(Number(event.target.value))}
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size} joueurs · {size - 1} bots
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Ta carte</span>
        <select
          value={role && roles.includes(role as Role) ? role : ""}
          onChange={(event) => onRole(event.target.value)}
        >
          <option value="">Au hasard</option>
          {roles.map((entry) => (
            <option key={entry} value={entry}>
              {cardFor(entry, settings).name}
            </option>
          ))}
        </select>
        <small>Entraîne-toi sur le rôle de ton choix.</small>
      </label>
    </div>
  );
}
