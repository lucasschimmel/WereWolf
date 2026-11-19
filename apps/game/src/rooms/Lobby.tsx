import { useMutation } from "convex/react";
import { Check, Copy, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  cardFor,
  characters,
  deckFor,
  defaultSettings,
  type Mode,
  maxPlayers,
  minForMode,
  modes,
  type Role,
  type Settings,
} from "../../shared/rules";
import type { Credentials } from "../session";
import { RoleCard } from "../ui/cards";
import { Drawer } from "../ui/controls";
import { LookPicker } from "../ui/LookPicker";
import type { View } from "./model";
import { Workshop } from "./Workshop";

const presetKey = "werewolf.workshop";
const blurbs: Record<Mode, string> = {
  classic: "Cartes révélées à la mort, bulletins publics.",
  express: "Même nuit, débats et votes raccourcis.",
  mystery: "Les cartes des morts restent secrètes.",
  chaos: "Un Bouffon se glisse parmi vous.",
  workshop: "Ton paquet, avec tes cartes inventées.",
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
      const plural = /[sx]$/.test(name) ? name : `${name}s`;
      return count > 1 ? `${count} ${plural}` : name;
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
  const leave = useMutation(api.rooms.leave);
  const [workshop, setWorkshop] = useState(false);
  const [preview, setPreview] = useState<Role>();
  const me = room.members.find((member) => member.id === room.me);
  if (!me) return null;
  const mode = room.settings.mode;
  let deck: Role[] = [];
  let deckError = "";
  try {
    deck = deckFor(
      Math.min(maxPlayers, Math.max(room.members.length, minForMode(mode))),
      room.settings,
    );
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
      : waiting.length > 0
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
          onPick={(index) =>
            void act(() =>
              update({
                ...credentials,
                character:
                  ((index % characters.length) + characters.length) %
                  characters.length,
              }),
            )
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
          <span>Mode{room.isHost ? "" : " · choisi par l’hôte"}</span>
          <select
            value={mode}
            disabled={!room.isHost}
            onChange={(event) => choose(event.target.value as Mode)}
          >
            {(Object.keys(modes) as Mode[]).map((value) => (
              <option
                key={value}
                value={value}
                disabled={
                  room.members.length < minForMode(value) &&
                  minForMode(value) > 8
                }
              >
                {modes[value]}
                {minForMode(value) > 8 ? ` · dès ${minForMode(value)}` : ""}
              </option>
            ))}
          </select>
          <small>{blurbs[mode]}</small>
        </label>
        {mode === "workshop" && room.isHost && (
          <button
            type="button"
            className="secondary"
            onClick={() => setWorkshop(true)}
          >
            <Sparkles size={16} /> Atelier de cartes
          </button>
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
        <button
          type="button"
          className={me.ready ? "secondary on" : "secondary"}
          aria-pressed={me.ready}
          onClick={() =>
            void act(() => update({ ...credentials, ready: !me.ready }))
          }
        >
          {me.ready && <Check size={18} />} {me.ready ? "Prêt" : "Je suis prêt"}
        </button>
        {room.isHost && (
          <button
            type="button"
            className="primary"
            disabled={!!blocker}
            onClick={() => void act(() => start(credentials))}
          >
            <Play size={16} /> Lancer · {readyCount}/{room.members.length} prêts
          </button>
        )}
      </section>

      <p className="footnote">
        {blocker || "Tout le monde est prêt."} · {room.members.length}/
        {maxPlayers} sur la place
      </p>

      <Drawer
        open={workshop}
        title="Atelier de cartes"
        onClose={() => setWorkshop(false)}
      >
        <Workshop
          settings={room.settings}
          count={room.members.length}
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
