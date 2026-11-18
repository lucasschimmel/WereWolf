import { useMutation, useQuery } from "convex/react";
import { Home, Link2, Pause, ScrollText, Settings2, Users } from "lucide-react";
import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { type Camp, cardFor } from "../../shared/rules";
import type { SceneState } from "../scene/Village";
import { type Credentials, errorMessage } from "../session";
import { RoleCard } from "../ui/cards";
import { Drawer, Joystick, SettingsPanel } from "../ui/controls";
import { Herald, RoleReveal, useHerald } from "../ui/Herald";
import { PhaseClock } from "../ui/PhaseClock";
import { ActionDock } from "./ActionDock";
import { EndScreen } from "./EndScreen";
import { Journal, Roster } from "./Ledger";
import { Lobby } from "./Lobby";
import type { MatchView, View } from "./model";

const Village = lazy(() => import("../scene/Village"));
type Panel = "roster" | "journal" | "settings" | null;
type Toast = { id: number; text: string; tone: "error" | "info" };

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
        <main className="gate">
          <section className="gate-card">
            <h1>Connexion interrompue</h1>
            <p role="alert">{errorMessage(this.state.error)}</p>
            <button type="button" className="primary" onClick={this.props.back}>
              Retour à l’accueil
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}

function useNow(interval = 250) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

function useCoarse() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const change = () => setCoarse(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return coarse;
}

function sceneState(
  room: View,
  match: MatchView | null,
  positions: SceneState["positions"],
) {
  return {
    showcase: false,
    me: room.me,
    positions,
    phase: match?.phase,
    events: match?.events ?? [],
    role: match?.role,
    outcome: match?.outcome,
    targets: match?.action ? (match.targets ?? []) : [],
    selected: match?.action ? match.selected || undefined : undefined,
    members: room.members.map((member) => {
      const card = member.role
        ? cardFor(member.role, room.settings)
        : undefined;
      return {
        id: member.id,
        name: member.name,
        character: member.character,
        alive: member.alive,
        host: member.host,
        ready: member.ready,
        role: card?.name,
        camp: card?.camp as Camp | undefined,
        mate: !!match?.mates.includes(member.id) && member.id !== room.me,
      };
    }),
  };
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
  const move = useMutation(api.game.move);
  const choose = useMutation(api.game.choose);
  const pause = useMutation(api.game.pause);
  const rematch = useMutation(api.rooms.rematch);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [reveal, setReveal] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(true);
  const toastId = useRef(0);
  const revealedFor = useRef("");
  const intelSeen = useRef(-1);
  const now = useNow();
  const coarse = useCoarse();
  const match = room?.match ?? null;

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, text, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      3600,
    );
  }, []);
  const act = useCallback(
    async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (cause) {
        notify(errorMessage(cause), "error");
      }
    },
    [notify],
  );
  const herald = useHerald(room, match, now);
  const closeReveal = useCallback(() => setReveal(false), []);

  useEffect(() => {
    if (!match) {
      revealedFor.current = "";
      intelSeen.current = -1;
      return;
    }
    const key = `${room?.code}:${match.events.length === 0 ? "start" : "running"}`;
    if (match.phase === "intro" && revealedFor.current !== key) {
      revealedFor.current = key;
      setReveal(true);
    }
    if (intelSeen.current >= 0 && match.intel.length > intelSeen.current) {
      const [, target, result] = match.intel[match.intel.length - 1].split("|");
      const who =
        room?.members.find((member) => member.id === target)?.name ?? "?";
      notify(
        result === "active"
          ? `Vision : ${who} a agi cette nuit.`
          : result === "idle"
            ? `Vision : ${who} n’a rien fait cette nuit.`
            : `Vision : ${who} appartient ${result === "pack" ? "à la Meute" : result === "solo" ? "aux Solitaires" : "au Village"}.`,
      );
    }
    intelSeen.current = match.intel.length;
  }, [match, room?.code, room?.members, notify]);

  const onMove = useCallback(
    (pose: { x: number; z: number; yaw: number }) => {
      void move({ ...credentials, ...pose }).catch(() => undefined);
    },
    [move, credentials],
  );
  const onSelect = useCallback(
    (id: string) => {
      const action = room?.match?.action;
      if (action)
        void act(() => choose({ ...credentials, action, target: id }));
    },
    [room?.match?.action, act, choose, credentials],
  );
  const scene = useMemo(
    () =>
      room
        ? { ...sceneState(room, match, positions ?? []), onMove, onSelect }
        : undefined,
    [room, match, positions, onMove, onSelect],
  );

  if (!room || !scene)
    return (
      <main className="gate">
        <p className="loading-line">Ouverture du village…</p>
      </main>
    );
  const me = room.members.find((member) => member.id === room.me);
  if (!me)
    return (
      <main className="gate">
        <section className="gate-card">
          <h1>Place introuvable</h1>
          <button type="button" className="primary" onClick={() => back(true)}>
            Retour à l’accueil
          </button>
        </section>
      </main>
    );

  const free = !match || match.phase === "intro" || match.phase === "debate";
  const share = async () => {
    const url = new URL(
      `/?room=${room.code}`,
      window.location.origin,
    ).toString();
    if (coarse && navigator.share)
      await navigator.share({
        title: "WereWolf",
        text: `Rejoins le village ${room.code}`,
        url,
      });
    else {
      await navigator.clipboard.writeText(url);
      notify("Lien d’invitation copié");
    }
  };
  const canPause =
    room.isHost &&
    match?.phase === "debate" &&
    match.pauses > 0 &&
    match.remaining === undefined;

  return (
    <main className={`game phase-${match?.phase ?? "lobby"}`}>
      <Suspense
        fallback={<div className="stage-loading">Le village s’éveille…</div>}
      >
        <Village {...scene} />
      </Suspense>
      <div className="hud">
        <header className="topbar">
          <div className="topbar-side">
            <button
              type="button"
              className="chip invite"
              onClick={() => void act(share)}
              aria-label={`Inviter, code ${room.code}`}
            >
              <Link2 size={15} />
              <span className="invite-code">{room.code}</span>
            </button>
          </div>
          {match ? (
            <PhaseClock
              phase={match.phase}
              cycle={match.cycle}
              end={match.end}
              now={now}
              paused={match.remaining}
            />
          ) : (
            <div className="lobby-title">
              <strong>WereWolf</strong>
              <small>Salon d’attente</small>
            </div>
          )}
          <div className="topbar-side end">
            {canPause && (
              <button
                type="button"
                className="chip"
                onClick={() => void act(() => pause(credentials))}
              >
                <Pause size={15} />{" "}
                <span className="hide-compact">Pause · {match.pauses}</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              aria-label="Villageois"
              onClick={() => setPanel("roster")}
            >
              <Users size={18} />
            </button>
            {match && (
              <button
                type="button"
                className="icon-button"
                aria-label="Journal du village"
                onClick={() => setPanel("journal")}
              >
                <ScrollText size={18} />
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              aria-label="Réglages"
              onClick={() => setPanel("settings")}
            >
              <Settings2 size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Retour à l’accueil"
              onClick={() => back(false)}
            >
              <Home size={18} />
            </button>
          </div>
        </header>

        <Herald item={herald} />

        {match ? (
          match.phase === "ended" ? (
            <EndScreen
              room={room}
              match={match}
              onRematch={() => void act(() => rematch(credentials))}
            />
          ) : (
            <div className="hud-bottom">
              <div className="hand">
                <RoleCard
                  role={match.role}
                  settings={room.settings}
                  size="mini"
                  onClick={() => setReveal(true)}
                />
              </div>
              <ActionDock
                room={room}
                match={match}
                choose={(action, target) =>
                  void act(() => choose({ ...credentials, action, target }))
                }
              />
            </div>
          )
        ) : (
          <Lobby
            room={room}
            credentials={credentials}
            act={act}
            open={lobbyOpen}
            setOpen={setLobbyOpen}
            onLeave={() => back(true)}
          />
        )}

        <Joystick
          enabled={
            coarse && free && me.alive && !panel && !(lobbyOpen && !match)
          }
        />

        <div className="toasts" aria-live="polite">
          {toasts.map((toast) => (
            <p
              key={toast.id}
              className={`toast ${toast.tone}`}
              role={toast.tone === "error" ? "alert" : "status"}
            >
              {toast.text}
            </p>
          ))}
        </div>
      </div>

      <Drawer
        open={panel === "roster"}
        title="Villageois"
        onClose={() => setPanel(null)}
      >
        <Roster room={room} />
      </Drawer>
      <Drawer
        open={panel === "journal"}
        title="Journal du village"
        onClose={() => setPanel(null)}
      >
        {match && (
          <Journal
            events={match.events}
            members={room.members}
            settings={room.settings}
          />
        )}
      </Drawer>
      <Drawer
        open={panel === "settings"}
        title="Réglages"
        onClose={() => setPanel(null)}
      >
        <SettingsPanel />
      </Drawer>

      {reveal && match && (
        <RoleReveal
          role={match.role}
          settings={room.settings}
          onClose={closeReveal}
        >
          <RoleCard role={match.role} settings={room.settings} />
          {match.mates.length > 1 && (
            <p className="reveal-note pack">
              Ta meute :{" "}
              {match.mates
                .filter((id) => id !== room.me)
                .map(
                  (id) => room.members.find((member) => member.id === id)?.name,
                )
                .join(", ")}
            </p>
          )}
          {match.intel.length > 0 && (
            <ul className="reveal-note">
              {match.intel.map((entry) => {
                const [cycle, target, result] = entry.split("|");
                const who = room.members.find(
                  (member) => member.id === target,
                )?.name;
                return (
                  <li key={entry}>
                    Nuit {cycle} · {who} ·{" "}
                    {result === "active"
                      ? "a agi"
                      : result === "idle"
                        ? "n’a pas agi"
                        : result === "pack"
                          ? "Meute"
                          : result === "solo"
                            ? "Solitaire"
                            : "Village"}
                  </li>
                );
              })}
            </ul>
          )}
        </RoleReveal>
      )}
    </main>
  );
}
