import { useMutation, useQuery } from "convex/react";
import { Component, lazy, type ReactNode, Suspense, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  cardFor,
  characters,
  deckFor,
  defaultSettings,
  type Mode,
  minForMode,
  modes,
  type Settings,
} from "../../shared/rules";
import { type Credentials, errorMessage } from "../session";
import { MatchPanel } from "./MatchPanel";
import { Workshop } from "./Workshop";

const Village = lazy(() => import("../scene/Village"));
const preset = "werewolf.workshop";
function workshopPreset(): Settings {
  try {
    const stored = localStorage.getItem(preset);
    if (stored) return JSON.parse(stored);
  } catch {
    localStorage.removeItem(preset);
  }
  return { ...defaultSettings, mode: "workshop" };
}
export function Room({
  credentials,
  back,
}: {
  credentials: Credentials;
  back: (forget: boolean) => void;
}) {
  return (
    <RoomBoundary back={() => back(true)}>
      <RoomContent credentials={credentials} back={back} />
    </RoomBoundary>
  );
}
class RoomBoundary extends Component<
  { children: ReactNode; back: () => void },
  { error?: unknown }
> {
  state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="entry">
          <section className="panel entry-panel">
            <h1>Connexion interrompue</h1>
            <p role="alert">{errorMessage(this.state.error)}</p>
            <button type="button" onClick={this.props.back}>
              Retour à l’accueil
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
function RoomContent({
  credentials,
  back,
}: {
  credentials: Credentials;
  back: (forget: boolean) => void;
}) {
  const room = useQuery(api.game.view, credentials);
  const positions = useQuery(api.game.positions, credentials);
  const update = useMutation(api.rooms.profile);
  const configure = useMutation(api.rooms.configure);
  const start = useMutation(api.rooms.start);
  const leave = useMutation(api.rooms.leave);
  const move = useMutation(api.game.move);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  async function act(operation: () => Promise<unknown>) {
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  if (!room) return <main className="loading">Ouverture du village…</main>;
  const me = room.members.find((member) => member.id === room.me);
  if (!me) return <main className="loading">Place introuvable.</main>;
  let deck: ReturnType<typeof deckFor> = [];
  let deckError = "";
  try {
    deck = deckFor(
      Math.max(room.members.length, minForMode(room.settings.mode)),
      room.settings,
    );
  } catch (cause) {
    deckError = cause instanceof Error ? cause.message : "Paquet invalide.";
  }
  const mode = room.settings.mode;
  async function copyInvite() {
    await navigator.clipboard.writeText(
      new URL(`/?room=${room?.code}`, window.location.origin).toString(),
    );
    setMessage("Lien copié");
  }
  return (
    <main className="room">
      <header className="room-header">
        <div className="brand">
          <span aria-hidden="true">◈</span> WereWolf
        </div>
        <div className="header-right">
          <button type="button" onClick={() => void act(copyInvite)}>
            Inviter · <strong>{room.code}</strong>
          </button>
          <button type="button" onClick={() => back(false)}>
            Accueil
          </button>
        </div>
      </header>
      <div className="workspace">
        <section className="world" aria-label="Village en trois dimensions">
          <Suspense
            fallback={<div className="loading">Chargement du village…</div>}
          >
            <Village
              members={room.members}
              me={room.me}
              positions={positions ?? []}
              phase={room.match?.phase}
              onMove={(position) => {
                void move({ ...credentials, ...position }).catch(
                  () => undefined,
                );
              }}
              onSelect={(id) => setTarget(id)}
            />
          </Suspense>
          <div className="world-caption">
            <strong>
              {room.match?.phase === "night" ? "À l’abri" : "Place du village"}
            </strong>
            <span>
              {!room.match ||
              room.match.phase === "debate" ||
              room.match.phase === "intro"
                ? "ZQSD / WASD · Glisser pour regarder"
                : "Sélectionne une cible dans le panneau"}
            </span>
          </div>
        </section>
        <aside className="sidebar">
          {(error || message) && (
            <p
              role={error ? "alert" : "status"}
              className={error ? "error" : "notice"}
            >
              {error || message}
            </p>
          )}
          {room.match ? (
            <MatchPanel
              room={room}
              match={room.match}
              credentials={credentials}
              sceneTarget={target}
              act={act}
            />
          ) : (
            <>
              <section className="panel lobby-panel">
                <div className="section-title">
                  <h1>Le salon</h1>
                  <span>{room.members.length} / 15</span>
                </div>
                <ul className="roster">
                  {room.members.map((member) => (
                    <li key={member.id}>
                      <span
                        className="avatar-dot"
                        style={{
                          background: characters[member.character].color,
                        }}
                      />
                      <span>
                        {member.name}
                        {member.id === room.me ? " (toi)" : ""}
                        {member.host ? " · Hôte" : ""}
                      </span>
                      <span className={member.ready ? "ready" : "dim"}>
                        {member.ready ? "Prêt" : "En attente"}
                      </span>
                      {room.isHost && !member.host && (
                        <button
                          type="button"
                          className="icon"
                          aria-label={`Retirer ${member.name}`}
                          onClick={() =>
                            void act(() =>
                              leave({ ...credentials, playerId: member.id }),
                            )
                          }
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="panel lobby-panel">
                <h2>Ton personnage</h2>
                <div className="characters">
                  {characters.map((character, index) => (
                    <button
                      type="button"
                      key={character.name}
                      aria-pressed={index === me.character}
                      onClick={() =>
                        void act(() =>
                          update({ ...credentials, character: index }),
                        )
                      }
                    >
                      <span
                        className="pawn"
                        aria-hidden="true"
                        style={{
                          background: character.color,
                          borderColor: character.trim,
                        }}
                      />
                      {character.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={me.ready ? "" : "primary"}
                  onClick={() =>
                    void act(() => update({ ...credentials, ready: !me.ready }))
                  }
                >
                  {me.ready ? "Annuler mon statut prêt" : "Je suis prêt"}
                </button>
              </section>
              <section className="panel lobby-panel">
                <h2>Règles du salon</h2>
                {room.isHost ? (
                  <label>
                    Mode
                    <select
                      value={mode}
                      onChange={(e) => {
                        const selected = e.target.value as Mode;
                        void act(() =>
                          configure({
                            ...credentials,
                            settings:
                              selected === "workshop"
                                ? workshopPreset()
                                : { ...defaultSettings, mode: selected },
                          }),
                        );
                      }}
                    >
                      {Object.entries(modes).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                          {minForMode(value as Mode) > 8
                            ? ` · dès ${minForMode(value as Mode)}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>{modes[mode]}</p>
                )}
                <p className="dim">
                  {mode === "mystery" ||
                  (mode === "workshop" && !room.settings.reveal)
                    ? "Cartes révélées en fin de partie."
                    : "Cartes révélées à la mort."}
                </p>
                {deckError ? (
                  <p role="alert" className="error">
                    {deckError}
                  </p>
                ) : (
                  <details>
                    <summary>Paquet proposé · {deck.length} cartes</summary>
                    <ul className="deck">
                      {[...new Set(deck)].map((role) => {
                        const card = cardFor(role, room.settings);
                        return (
                          <li key={role}>
                            <b>
                              {deck.filter((item) => item === role).length} ×{" "}
                              {card.name}
                            </b>
                            <span>{card.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                {mode === "workshop" && room.isHost && (
                  <Workshop
                    settings={room.settings}
                    count={room.members.length}
                    save={(settings) =>
                      void act(async () => {
                        deckFor(Math.max(room.members.length, 8), settings);
                        await configure({ ...credentials, settings });
                        localStorage.setItem(preset, JSON.stringify(settings));
                      })
                    }
                  />
                )}
                {room.isHost ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      !!deckError ||
                      room.members.length < minForMode(mode) ||
                      room.members.some((member) => !member.ready)
                    }
                    onClick={() => void act(() => start(credentials))}
                  >
                    Lancer la partie
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void act(async () => {
                        await leave(credentials);
                        back(true);
                      })
                    }
                  >
                    Libérer ma place
                  </button>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
