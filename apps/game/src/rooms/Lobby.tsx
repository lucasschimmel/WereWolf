import { useMutation } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Play,
} from "lucide-react";
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
  type Settings,
} from "../../shared/rules";
import type { Credentials } from "../session";
import { Emblem } from "../ui/cards";
import { Roster } from "./Ledger";
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
  } catch {
    localStorage.removeItem(presetKey);
  }
  return { ...defaultSettings, mode: "workshop" };
}

type Tab = "look" | "table" | "rules";

export function Lobby({
  room,
  credentials,
  act,
  open,
  setOpen,
  onLeave,
}: {
  room: View;
  credentials: Credentials;
  act: (operation: () => Promise<unknown>) => Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
  onLeave: () => void;
}) {
  const update = useMutation(api.rooms.profile);
  const configure = useMutation(api.rooms.configure);
  const start = useMutation(api.rooms.start);
  const leave = useMutation(api.rooms.leave);
  const [tab, setTab] = useState<Tab>("look");
  const me = room.members.find((member) => member.id === room.me);
  if (!me) return null;
  const mode = room.settings.mode;
  let deck: ReturnType<typeof deckFor> = [];
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
  const waiting = room.members.filter((member) => !member.ready).length;
  const blocker = deckError
    ? deckError
    : missing > 0
      ? `Encore ${missing} villageois à inviter`
      : waiting > 0
        ? `${waiting} joueur${waiting > 1 ? "s" : ""} pas encore prêt${waiting > 1 ? "s" : ""}`
        : "";
  const pick = (index: number) => {
    const next = (index + characters.length) % characters.length;
    void act(() => update({ ...credentials, character: next }));
  };
  const look = characters[me.character] ?? characters[0];

  return (
    <section className={`sheet lobby${open ? " open" : ""}`} aria-label="Salon">
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <strong>Le salon</strong> · {room.members.length}/{maxPlayers} ·{" "}
          {readyCount} prêt{readyCount > 1 ? "s" : ""}
        </span>
        <ChevronDown size={18} />
      </button>
      <nav className="tabs" aria-label="Sections du salon">
        {(
          [
            ["look", "Personnage"],
            ["table", `Villageois · ${room.members.length}`],
            ["rules", "Règles"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value);
              setOpen(true);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="sheet-body">
        {tab === "look" && (
          <div className="picker">
            <div className="picker-head">
              <button
                type="button"
                className="icon-button"
                aria-label="Personnage précédent"
                onClick={() => pick(me.character - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <small>Ta marionnette</small>
                <strong>{look.name}</strong>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Personnage suivant"
                onClick={() => pick(me.character + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="swatches">
              {characters.map((character, index) => (
                <button
                  type="button"
                  key={character.name}
                  aria-label={character.name}
                  aria-pressed={index === me.character}
                  style={{
                    background: character.color,
                    borderColor: character.trim,
                  }}
                  onClick={() => pick(index)}
                />
              ))}
            </div>
            <p className="dim small-print">
              Marche sur la place pour saluer les autres. La caméra suit ta
              marionnette.
            </p>
          </div>
        )}
        {tab === "table" && (
          <Roster
            room={room}
            onKick={
              room.isHost
                ? (id) =>
                    void act(() => leave({ ...credentials, playerId: id }))
                : undefined
            }
          />
        )}
        {tab === "rules" && (
          <div className="rules">
            <div className="modes">
              {(Object.keys(modes) as Mode[]).map((value) => {
                const locked =
                  room.members.length < minForMode(value) &&
                  minForMode(value) > 8;
                return (
                  <button
                    type="button"
                    key={value}
                    className="mode"
                    aria-pressed={mode === value}
                    disabled={!room.isHost}
                    onClick={() =>
                      void act(() =>
                        configure({
                          ...credentials,
                          settings:
                            value === "workshop"
                              ? workshopPreset()
                              : { ...defaultSettings, mode: value },
                        }),
                      )
                    }
                  >
                    <strong>
                      {modes[value]} {locked && <Lock size={12} />}
                    </strong>
                    <span>{blurbs[value]}</span>
                    {minForMode(value) > 8 && (
                      <small>Dès {minForMode(value)} joueurs</small>
                    )}
                  </button>
                );
              })}
            </div>
            {deckError ? (
              <p className="error" role="alert">
                {deckError}
              </p>
            ) : (
              <ul className="deck">
                {[...new Set(deck)].map((role) => {
                  const card = cardFor(role, room.settings);
                  return (
                    <li key={role} className={`camp-${card.camp}`}>
                      <span className="deck-emblem">
                        <Emblem role={role} size={18} />
                      </span>
                      <span>
                        <strong>
                          {deck.filter((item) => item === role).length} ×{" "}
                          {card.name}
                        </strong>
                        <small>{card.text}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {mode === "workshop" && room.isHost && (
              <Workshop
                settings={room.settings}
                count={room.members.length}
                save={(settings) =>
                  void act(async () => {
                    deckFor(Math.max(room.members.length, 8), settings);
                    await configure({ ...credentials, settings });
                    localStorage.setItem(presetKey, JSON.stringify(settings));
                  })
                }
              />
            )}
          </div>
        )}
      </div>
      <footer className="lobby-actions">
        <button
          type="button"
          className={me.ready ? "ready-button on" : "ready-button"}
          onClick={() =>
            void act(() => update({ ...credentials, ready: !me.ready }))
          }
        >
          {me.ready ? (
            <>
              <Check size={18} /> Prêt
            </>
          ) : (
            "Je suis prêt"
          )}
        </button>
        {room.isHost ? (
          <button
            type="button"
            className="primary launch"
            disabled={!!blocker}
            title={blocker || undefined}
            onClick={() => void act(() => start(credentials))}
          >
            <Play size={16} /> Lancer la partie
          </button>
        ) : (
          <button
            type="button"
            className="ghost small"
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
        {room.isHost && blocker && <p className="blocker">{blocker}</p>}
      </footer>
    </section>
  );
}
