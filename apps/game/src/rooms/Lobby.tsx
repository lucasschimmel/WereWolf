import { useMutation } from "convex/react";
import { Check, Copy, Play, Settings2, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { percent } from "../../shared/match-options";
import {
  cardFor,
  deckFor,
  defaultSettings,
  type Mode,
  maxPlayers,
  minForMode,
  modes,
  optionalRoles,
  type Role,
  roleAvailable,
  roleChance,
  type Settings,
} from "../../shared/rules";
import type { Credentials } from "../session";
import { RoleCard } from "../ui/cards";
import { Drawer } from "../ui/controls";
import { LookPicker } from "../ui/LookPicker";
import { MatchConfiguration } from "./MatchConfiguration";
import type { View } from "./model";
import { SoloSetup } from "./SoloSetup";
import { Workshop } from "./Workshop";

const presetKey = "werewolf.workshop";
const blurbs: Record<Mode, string> = {
  classic: "Cartes révélées à la mort, bulletins publics.",
  express: "Même nuit, débats et votes raccourcis.",
  mystery: "Les cartes des morts restent secrètes.",
  chaos: "Un Bouffon se glisse parmi vous.",
  workshop: "Ton paquet, avec tes cartes inventées.",
  custom: "Choisis les cartes du paquet et leur quantité.",
};

function workshopPreset(): Settings {
  try {
    const stored = localStorage.getItem(presetKey);
    if (stored) return JSON.parse(stored) as Settings;
  } catch (cause) {
    console.warn("Discarding an unreadable Workshop preset", cause);
    localStorage.removeItem(presetKey);
  }
  return { ...defaultSettings, mode: "workshop" };
}

function deckSummary(deck: Role[], settings: Settings) {
  const counts = new Map<Role, number>();
  for (const role of deck) counts.set(role, (counts.get(role) ?? 0) + 1);
  return [...counts]
    .map(([role, count]) => {
      const name = cardFor(role, settings).name;
      return count > 1 ? `${count} × ${name}` : name;
    })
    .join(" · ");
}

/**
 * The room before the match: everyone walks the square, so the interface is
 * only a small "you" panel on the left and the room panel on the right.
 */
export function Lobby({
  room,
  credentials,
  act,
  share,
  onLeave,
}: {
  room: View;
  credentials: Credentials;
  act: (operation: () => Promise<unknown>) => Promise<void>;
  share: () => void;
  onLeave: () => void;
}) {
  const update = useMutation(api.rooms.profile);
  const configure = useMutation(api.rooms.configure);
  const start = useMutation(api.rooms.start);
  const setup = useMutation(api.rooms.soloSetup);
  const leave = useMutation(api.rooms.leave);
  const [workshop, setWorkshop] = useState(false);
  const [configuration, setConfiguration] = useState(false);
  const [preview, setPreview] = useState<Role>();
  const me = room.members.find((member) => member.id === room.me);
  if (!me) return null;
  const mode = room.settings.mode;
  const solo = !!room.solo;
  const count = Math.max(room.members.length, minForMode(mode));
  let deck: Role[] = [];
  let deckError = "";
  try {
    deck = deckFor(count, room.settings);
  } catch (cause) {
    deckError = cause instanceof Error ? cause.message : "Paquet invalide.";
  }
  const readyCount = room.members.filter((member) => member.ready).length;
  const missing = minForMode(mode) - room.members.length;
  const waiting = room.members.filter((member) => !member.ready);
  const blocker = deckError
    ? deckError
    : missing > 0
      ? `Encore ${missing} joueur${missing > 1 ? "s" : ""} à inviter`
      : waiting.length > 0 && !solo
        ? `${waiting.map((member) => member.name).join(", ")} ${waiting.length > 1 ? "ne sont" : "n’est"} pas encore prêt${waiting.length > 1 ? "s" : ""}`
        : "";
  const choose = (value: Mode) =>
    void act(() =>
      configure({
        ...credentials,
        settings:
          value === "workshop"
            ? workshopPreset()
            : { ...defaultSettings, mode: value },
      }),
    );

  return (
    <>
      <section className="panel side left" aria-labelledby="lobby-me">
        <h2 id="lobby-me">{me.name}</h2>
        <LookPicker
          look={me.character}
          taken={
            new Map(
              room.members
                .filter((member) => member.id !== me.id)
                .map((member) => [member.character, member.name]),
            )
          }
          onPick={(index) =>
            void act(() => update({ ...credentials, character: index }))
          }
        />
        {!room.isHost && (
          <button
            type="button"
            className="link"
            onClick={() =>
              void act(async () => {
                await leave(credentials);
                onLeave();
              })
            }
          >
            Libérer ma place
          </button>
        )}
      </section>

      <section className="panel side right" aria-labelledby="lobby-room">
        <div className="room-head">
          <h2 id="lobby-room" className="room-code">
            {room.code}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Copier le lien d’invitation"
            onClick={share}
          >
            <Copy size={18} />
          </button>
        </div>
        <label className="field">
          <span>Préréglage{room.isHost ? "" : " · choisi par l’hôte"}</span>
          <select
            value={mode}
            disabled={!room.isHost}
            onChange={(event) => choose(event.target.value as Mode)}
          >
            {(Object.keys(modes) as Mode[]).map((value) => (
              <option key={value} value={value}>
                {modes[value]}
                {minForMode(value) > minForMode("classic")
                  ? ` · dès ${minForMode(value)}`
                  : ""}
              </option>
            ))}
          </select>
          <small>{blurbs[mode]}</small>
        </label>
        <button
          type="button"
          className="secondary"
          aria-expanded={configuration}
          onClick={() => setConfiguration(true)}
        >
          <Settings2 size={16} />
          {room.isHost && mode === "custom"
            ? "Composer le paquet"
            : "Voir le paquet"}
        </button>
        {solo && (
          <SoloSetup
            count={room.members.length}
            mode={mode}
            deck={deck}
            settings={room.settings}
            role={room.solo?.role}
            onCount={(players) =>
              void act(() => setup({ ...credentials, players }))
            }
            onRole={(role) => void act(() => setup({ ...credentials, role }))}
          />
        )}
        {mode === "workshop" && room.isHost && (
          <button
            type="button"
            className="secondary"
            onClick={() => setWorkshop(true)}
          >
            <Sparkles size={16} /> Atelier de cartes
          </button>
        )}
        {room.isHost &&
          mode === "workshop" &&
          optionalRoles.some((role) =>
            roleAvailable(role, room.members.length, mode),
          ) && (
            <details>
              <summary>Cartes optionnelles</summary>
              {optionalRoles
                .filter((role) =>
                  roleAvailable(role, room.members.length, mode),
                )
                .map((role) => {
                  const count = room.members.length;
                  const on =
                    roleChance(role, count, room.settings) === percent.max;
                  const settings: Settings = {
                    ...room.settings,
                    roleOverrides: {
                      ...room.settings.roleOverrides,
                      [role]: !on,
                    },
                  };
                  return (
                    <label key={role} className="check">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          void act(async () => {
                            deckFor(count, settings);
                            await configure({ ...credentials, settings });
                          })
                        }
                      />{" "}
                      {cardFor(role, room.settings).name}
                    </label>
                  );
                })}
            </details>
          )}
        <div className="deck">
          <span className="field-label">Le paquet</span>
          {deckError ? (
            <p className="error" role="alert">
              {deckError}
            </p>
          ) : (
            <>
              <ul className="deck-row">
                {deck.map((role, index) => (
                  <li key={`${role}-${String(index)}`}>
                    <button
                      type="button"
                      className={`deck-chip deck-${role.replace(":", "-")}`}
                      aria-label={`Voir la carte ${cardFor(role, room.settings).name}`}
                      onClick={() => setPreview(role)}
                    />
                  </li>
                ))}
              </ul>
              <small>{deckSummary(deck, room.settings)}</small>
            </>
          )}
        </div>
        <div className="lobby-actions">
          {!solo && (
            <button
              type="button"
              className={me.ready ? "secondary on" : "secondary"}
              aria-pressed={me.ready}
              onClick={() =>
                void act(() => update({ ...credentials, ready: !me.ready }))
              }
            >
              {me.ready && <Check size={18} />}{" "}
              {me.ready ? "Prêt" : "Je suis prêt"}
            </button>
          )}
          {room.isHost && (
            <button
              type="button"
              className="primary"
              disabled={!!blocker}
              onClick={() => void act(() => start(credentials))}
            >
              <Play size={16} />{" "}
              {solo
                ? "Lancer la partie"
                : `Lancer · ${readyCount}/${room.members.length} prêts`}
            </button>
          )}
        </div>
      </section>

      <p className="footnote">
        {blocker || (solo ? "Table solo prête." : "Tout le monde est prêt.")} ·{" "}
        {room.members.length}/{maxPlayers} sur la place
      </p>

      <Drawer
        open={configuration}
        title="Composition du paquet"
        onClose={() => setConfiguration(false)}
      >
        <MatchConfiguration
          settings={room.settings}
          count={count}
          deck={deck}
          save={
            room.isHost && mode === "custom"
              ? (settings) =>
                  act(async () => {
                    await configure({ ...credentials, settings });
                    setConfiguration(false);
                  })
              : undefined
          }
        />
      </Drawer>

      <Drawer
        open={workshop}
        title="Atelier de cartes"
        onClose={() => setWorkshop(false)}
      >
        <Workshop
          settings={room.settings}
          save={(settings) =>
            void act(async () => {
              deckFor(Math.max(room.members.length, 8), settings);
              await configure({ ...credentials, settings });
              localStorage.setItem(presetKey, JSON.stringify(settings));
              setWorkshop(false);
            })
          }
        />
      </Drawer>

      {preview && (
        <div className="reveal" role="dialog" aria-label="Aperçu de carte">
          <button
            type="button"
            className="reveal-backdrop"
            aria-label="Fermer l’aperçu"
            onClick={() => setPreview(undefined)}
          />
          <RoleCard
            kind={preview}
            settings={room.settings}
            className="reveal-card"
          />
        </div>
      )}
    </>
  );
}
