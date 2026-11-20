import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  Home,
  Lightbulb,
  Link2,
  Pause,
  ScrollText,
  Settings2,
  SkipForward,
  Users,
} from "lucide-react";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { type Camp, cardFor } from "../../shared/rules";
import { useMotion } from "../net/motion";
import { roomMap } from "../scene/maps";
import Village, { type SceneState } from "../scene/Village";
import { type Credentials, errorMessage } from "../session";
import { RoleCard } from "../ui/cards";
import { Drawer, Joystick, SettingsPanel } from "../ui/controls";
import { useCoarse } from "../ui/device";
import { Guide } from "../ui/Guide";
import { Herald, RoleReveal, useHerald } from "../ui/Herald";
import { Status } from "../ui/PhaseClock";
import { Chat } from "./Chat";
import { coachTip } from "./coach";
import {
  type Action,
  nightSteps,
  passLabels,
  readIntel,
  statusFor,
} from "./hud";
import { Journal, Roster } from "./Ledger";
import { Lobby } from "./Lobby";
import type { MatchView } from "./model";
import { EndScreen, Vision, WitchTurn } from "./Overlays";
import { RotatePrompt, TargetPicker } from "./Picker";
import { usePresence, usePresenceHeartbeat } from "./presence";

type Panel = "roster" | "journal" | "settings" | "chat" | "guide" | null;
const coachKey = "werewolf.coach";
const skippable = new Set(["intro", "dawn", "debate"]);

function storedCoach() {
  try {
    return localStorage.getItem(coachKey) !== "off";
  } catch {
    return true;
  }
}
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
          <section className="panel gate-card">
            <h1>Connexion interrompue</h1>
            <p role="alert">{errorMessage(this.state.error)}</p>
            <button type="button" className="primary" onClick={this.props.back}>
              Retour à la place
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}

/**
 * Copies text even on plain-http origins (LAN IP), where `navigator.clipboard`
 * is unavailable because the page is not a secure context.
 */
async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (cause) {
    console.warn("Clipboard API refused, using the fallback", cause);
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
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

type Pointing = {
  action?: Action;
  targets: string[];
  selected?: string;
};

/** What this player can point at right now, if anything. */
function pointingFor(match: MatchView | null, poisonAim: boolean): Pointing {
  if (!match || match.phase === "ended") return { targets: [] };
  if (poisonAim && match.potions && !match.potions.done)
    return {
      action: "poison",
      targets: match.potions.targets,
      selected: match.potions.poison || undefined,
    };
  if (!match.action) return { targets: [] };
  if (
    (match.action === "inspect" ||
      match.action === "peek" ||
      match.action === "link") &&
    match.selected !== undefined
  )
    return { targets: [] };
  return {
    action: match.action,
    targets: match.targets ?? [],
    selected: match.selected || undefined,
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
  usePresenceHeartbeat(credentials);
  const motion = useMotion(credentials, room?.movementScope);
  const choose = useMutation(api.game.choose);
  const pause = useMutation(api.game.pause);
  const skip = useMutation(api.game.skip);
  const [coach, setCoach] = useState(storedCoach);
  const rematch = useMutation(api.rooms.rematch);
  const kick = useMutation(api.rooms.leave);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [reveal, setReveal] = useState(false);
  const [poisonWindow, setPoisonWindow] = useState<string>();
  const [choicePending, setChoicePending] = useState(false);
  const choosing = useRef(false);
  const [vision, setVision] = useState<ReturnType<typeof readIntel>>();
  const toastId = useRef(0);
  const revealedFor = useRef("");
  const intelSeen = useRef(-1);
  const now = useNow();
  const coarse = useCoarse();

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, text, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      3600,
    );
  }, []);
  const presence = usePresence(room, now, notify);
  const match = room?.match ?? null;
  const roleBefore = useRef<MatchView["role"] | undefined>(undefined);
  const partnerBefore = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      roleBefore.current &&
      match?.role &&
      roleBefore.current !== match.role
    ) {
      setReveal(true);
      notify("Tu as rejoint la Meute.", "info");
    }
    if (match?.partner && partnerBefore.current !== match.partner) {
      const partner = room?.members.find(
        (member) => member.id === match.partner,
      );
      if (partner) notify(`Cupidon t’a lié à ${partner.name}.`, "info");
    }
    roleBefore.current = match?.role;
    partnerBefore.current = match?.partner;
  }, [match?.partner, match?.role, notify, room?.members]);

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
  const closeVision = useCallback(() => setVision(undefined), []);

  useEffect(() => {
    if (!match || !room) {
      revealedFor.current = "";
      intelSeen.current = -1;
      return;
    }
    const key = `${room.code}:${match.events.length === 0 ? "start" : "running"}`;
    if (match.phase === "intro" && revealedFor.current !== key) {
      revealedFor.current = key;
      setReveal(true);
    }
    if (intelSeen.current >= 0 && match.intel.length > intelSeen.current)
      setVision(readIntel(room, match.intel[match.intel.length - 1]));
    intelSeen.current = match.intel.length;
  }, [match, room]);

  const actionWindow = match?.actionWindow;
  const poisonAim =
    !!match?.potions && !!actionWindow && poisonWindow === actionWindow;
  const pointing = pointingFor(match, poisonAim);
  const pointAction = pointing.action;
  const submitChoice = useCallback(
    async (action: Parameters<typeof choose>[0]["action"], target: string) => {
      if (!actionWindow || choosing.current) return;
      choosing.current = true;
      setChoicePending(true);
      try {
        await choose({ ...credentials, action, target, window: actionWindow });
        if (action === "poison" && target)
          setPoisonWindow((current) =>
            current === actionWindow ? undefined : current,
          );
      } catch (cause) {
        notify(errorMessage(cause), "error");
      } finally {
        choosing.current = false;
        setChoicePending(false);
      }
    },
    [actionWindow, choose, credentials, notify],
  );
  const onSelect = useCallback(
    (id: string) => {
      if (!pointAction) return;
      void submitChoice(pointAction, id);
    },
    [pointAction, submitChoice],
  );
  const onPass = useCallback(() => {
    if (!pointAction || choosing.current) return;
    if (pointAction === "poison") {
      setPoisonWindow(undefined);
      return;
    }
    void submitChoice(pointAction, "");
  }, [pointAction, submitChoice]);

  const scene: SceneState | undefined = useMemo(() => {
    if (!room) return undefined;
    const pack = match?.action === "wolf";
    // Night: the pack's aims. Vote/runoff: every living voter's public ballot.
    // Empty targets (abstentions) are dropped and the viewer's own aim is
    // handled through `pointing`/`selected`.
    const source = pack ? match?.wolves : match?.ballots;
    const aims = Object.fromEntries(
      Object.entries(source ?? {}).filter(
        ([id, target]) => id !== room.me && target,
      ),
    );
    return {
      map: roomMap(room.code),
      showcase: false,
      me: room.me,
      motion,
      phase: match?.phase,
      events: match?.events ?? [],
      role: match?.role,
      outcome: match?.outcome,
      winner: match?.winner,
      targets: pointing.targets,
      selected: pointing.selected,
      aiming:
        match?.phase === "night" &&
        (pointing.targets.length > 0 || !!match.ghosts?.length),
      awake: match?.awake,
      aims,
      members: room.members.map((member) => {
        const card = member.role
          ? cardFor(member.role, room.settings)
          : undefined;
        return {
          id: member.id,
          name: member.name,
          character: member.character,
          alive: member.alive,
          inScene:
            match?.phase !== "night" ||
            !!match.sceneActors?.includes(member.id),
          ghost: match?.ghosts?.includes(member.id),
          host: member.host,
          ready: member.ready,
          role: card?.name,
          camp: card?.camp as Camp | undefined,
          mate: !!match?.mates.includes(member.id) && member.id !== room.me,
        };
      }),
      onSelect,
      onPass,
    };
  }, [
    room,
    match,
    motion,
    pointing.targets,
    pointing.selected,
    onSelect,
    onPass,
  ]);

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
        <section className="panel gate-card">
          <h1>Place introuvable</h1>
          <button type="button" className="primary" onClick={() => back(true)}>
            Retour à la place
          </button>
        </section>
      </main>
    );

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
    else if (await copyText(url)) notify("Lien d’invitation copié");
    else notify(`Copie impossible — lien : ${url}`, "error");
  };
  const free = !match || match.phase === "intro" || match.phase === "debate";
  const canPause =
    room.isHost &&
    match?.phase === "debate" &&
    match.pauses > 0 &&
    match.remaining === undefined;
  const witchTurn = !!match?.potions && !match.potions.done && !poisonAim;
  const status = match
    ? statusFor({
        room,
        match,
        alive: me.alive,
        aiming: pointAction,
        witchTurn,
        touch: coarse,
      })
    : undefined;
  const ended = match?.phase === "ended";
  const solo = !!room.solo;
  const canSkip =
    solo &&
    room.isHost &&
    !!match &&
    match.remaining === undefined &&
    skippable.has(match.phase);
  const tip =
    solo && coach && match
      ? coachTip(match, me.alive, pointAction, witchTurn)
      : undefined;
  const toggleCoach = () => {
    const next = !coach;
    setCoach(next);
    try {
      localStorage.setItem(coachKey, next ? "on" : "off");
    } catch (cause) {
      console.warn("Could not remember the coach setting", cause);
    }
  };

  return (
    <main className={`game phase-${match?.phase ?? "lobby"}`}>
      <Village {...scene} />
      <div className="hud">
        {match ? (
          <button
            type="button"
            className="chip corner-left"
            onClick={() => void act(share)}
            aria-label={`Inviter, code ${room.code}`}
          >
            <Link2 size={15} /> {room.code}
          </button>
        ) : (
          <p className="wordmark">WereWolf</p>
        )}

        {match && status && !ended && (
          <Status
            id={`${match.phase}:${match.turn ?? ""}:${match.cycle}:${match.end}`}
            title={status.title}
            detail={status.detail}
            tone={status.tone}
            end={match.end}
            now={now}
            paused={match.remaining}
            steps={
              match.phase === "night" ? nightSteps(room, match) : undefined
            }
          >
            {canSkip && (
              <button
                type="button"
                className="icon-button"
                aria-label="Passer cette étape"
                onClick={() => void act(() => skip(credentials))}
              >
                <SkipForward size={16} />
              </button>
            )}
            {canPause && !solo && (
              <button
                type="button"
                className="icon-button"
                aria-label={`Mettre en pause (${match.pauses} restantes)`}
                onClick={() => void act(() => pause(credentials))}
              >
                <Pause size={16} />
              </button>
            )}
          </Status>
        )}

        <nav className="corner-right" aria-label="Menu">
          <Chat
            key={room.me}
            credentials={credentials}
            me={room.me}
            members={room.members}
            open={panel === "chat"}
            onOpen={() => setPanel("chat")}
            onClose={() => setPanel(null)}
          />
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
          {solo && (
            <button
              type="button"
              className="icon-button"
              aria-label="Conseils du mode solo"
              aria-pressed={coach}
              onClick={toggleCoach}
            >
              <Lightbulb size={18} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Comment jouer"
            onClick={() => setPanel("guide")}
          >
            <BookOpen size={18} />
          </button>
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
            aria-label="Retour à la place"
            onClick={() => back(false)}
          >
            <Home size={18} />
          </button>
        </nav>

        {!match && (
          <Lobby
            room={room}
            credentials={credentials}
            act={act}
            share={() => void act(share)}
            onLeave={() => back(true)}
          />
        )}

        {match && !ended && <Herald item={herald} settings={room.settings} />}

        {tip && (
          <aside className="coach" aria-label="Conseil">
            <Lightbulb size={16} aria-hidden="true" />
            <p>{tip}</p>
          </aside>
        )}

        {match && !ended && (
          <RoleCard
            kind={match.role}
            settings={room.settings}
            size="mini"
            className="hand"
            onClick={() => setReveal(true)}
          />
        )}

        {pointAction &&
          (coarse ||
          pointAction === "model" ||
          pointAction === "link" ||
          pointAction === "douse" ||
          pointAction === "electMayor" ||
          pointAction === "decideTie" ? (
            <TargetPicker
              room={room}
              targets={pointing.targets}
              selected={pointing.selected}
              ballots={pointAction === "wolf" ? match?.wolves : match?.ballots}
              passLabel={passLabels[pointAction]}
              disabled={choicePending}
              onSelect={onSelect}
              onPass={onPass}
            >
              {match?.canIgnite && (
                <button
                  type="button"
                  className="picker-pass"
                  aria-pressed={match.selected === "ignite"}
                  disabled={choicePending}
                  onClick={() => submitChoice("ignite", "")}
                >
                  Embraser
                </button>
              )}
            </TargetPicker>
          ) : (
            <button
              type="button"
              className="chip pass"
              disabled={choicePending}
              onClick={onPass}
            >
              {passLabels[pointAction]}
              {pointing.targets.length > 0 && <small> · clic droit</small>}
            </button>
          ))}

        {match?.potions && witchTurn && (
          <WitchTurn
            room={room}
            potions={match.potions}
            disabled={choicePending}
            onHeal={(on) =>
              submitChoice("heal", on ? (match.potions?.attack ?? "") : "")
            }
            onDone={() => submitChoice("done", "")}
            onPoison={() => setPoisonWindow(actionWindow)}
            onClearPoison={() => submitChoice("poison", "")}
          />
        )}

        {vision && (
          <Vision
            room={room}
            target={vision.target}
            result={vision.result}
            packVote={vision.packVote}
            text={vision.text}
            onDone={closeVision}
          />
        )}

        {match && ended && (
          <EndScreen
            room={room}
            match={match}
            onRematch={() => void act(() => rematch(credentials))}
            onAudit={() => setPanel("journal")}
          />
        )}

        <Joystick enabled={coarse && free && me.alive && !panel && !reveal} />

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
        <Roster
          room={room}
          presence={presence}
          onKick={
            room.isHost && !match
              ? (id) => void act(() => kick({ ...credentials, playerId: id }))
              : undefined
          }
        />
      </Drawer>
      <Drawer
        open={panel === "journal"}
        title={ended ? "Les coulisses" : "Journal du village"}
        onClose={() => setPanel(null)}
      >
        {match && (
          <Journal
            events={
              ended && match.audit
                ? [...match.events, ...match.audit]
                : match.events
            }
            members={room.members}
            settings={room.settings}
            audit={ended}
          />
        )}
      </Drawer>
      <Drawer
        open={panel === "settings"}
        title="Réglages"
        onClose={() => setPanel(null)}
      >
        <SettingsPanel touch={coarse} />
      </Drawer>

      <Guide open={panel === "guide"} onClose={() => setPanel(null)} />

      {coarse && <RotatePrompt />}

      {reveal && match && (
        <RoleReveal
          role={match.role}
          settings={room.settings}
          onClose={closeReveal}
          touch={coarse}
        >
          {match.mates.length > 1 && (
            <p className="pack">
              Ta meute :{" "}
              {match.mates
                .filter((id) => id !== room.me)
                .map(
                  (id) => room.members.find((member) => member.id === id)?.name,
                )
                .join(", ")}
            </p>
          )}
          {match.partner && (
            <p>
              Ton lien ·{" "}
              {room.members.find((member) => member.id === match.partner)?.name}
            </p>
          )}
          {match.model && (
            <p>
              Ton modèle ·{" "}
              {room.members.find((member) => member.id === match.model)?.name}
            </p>
          )}
          {!!match.marks?.length && (
            <p>
              Cibles aspergées ·{" "}
              {room.members
                .filter((member) => match.marks?.includes(member.id))
                .map((member) => member.name)
                .join(", ")}
            </p>
          )}
          {match.intel.length > 0 && (
            <ul>
              {match.intel.map((entry) => {
                const read = readIntel(room, entry);
                return (
                  <li key={entry}>
                    Nuit {read.cycle} · {read.text}
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
