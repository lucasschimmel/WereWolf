import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  DoorOpen,
  GraduationCap,
  Settings2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { characters } from "../../shared/rules";
import { Room } from "../rooms/Room";
import { roomMap } from "../scene/maps";
import Village from "../scene/Village";
import { errorMessage, guestKey, session } from "../session";
import { Drawer, SettingsPanel } from "../ui/controls";
import { enterLandscape, suggestInstall, useCoarse } from "../ui/device";
import { Guide } from "../ui/Guide";
import { LookPicker } from "../ui/LookPicker";

export const Route = createFileRoute("/")({
  component: Home,
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    room: typeof search.room === "string" ? search.room : undefined,
  }),
});

const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : undefined;
const noop = () => undefined;
const nameKey = "werewolf.name";
const lookKey = "werewolf.character";

function Home() {
  if (!client)
    return (
      <main className="gate">
        <section className="panel gate-card">
          <h1>WereWolf</h1>
          <p>Configure VITE_CONVEX_URL pour ouvrir le village.</p>
        </section>
      </main>
    );
  return (
    <ConvexProvider client={client}>
      <Gate />
    </ConvexProvider>
  );
}

function storedLook() {
  const value = Number(localStorage.getItem(lookKey));
  return Number.isInteger(value) && characters[value] ? value : 0;
}

/**
 * The player lands straight on a village square of their own: a small panel
 * on the left to pick a name and a look, one on the right to open or join a
 * room. Nothing here reaches the server until they create or join.
 */
function Gate() {
  const { room: invite } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [code, setCode] = useState(invite?.toUpperCase() ?? "");
  const [name, setName] = useState("");
  const [look, setLook] = useState(0);
  const [active, setActive] = useState<{ code: string; key: string }>();
  const [resume, setResume] = useState<string>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"create" | "join" | "solo">();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const create = useMutation(api.rooms.create);
  const createSolo = useMutation(api.rooms.createSolo);
  const join = useMutation(api.rooms.join);
  const coarse = useCoarse();
  const [install, setInstall] = useState(false);
  useEffect(() => setInstall(suggestInstall()), []);

  useEffect(() => {
    const key = guestKey();
    if (invite && session.has(invite.toUpperCase()))
      setActive({ code: invite.toUpperCase(), key });
    setResume(session.last());
    setName(localStorage.getItem(nameKey) ?? "");
    setLook(storedLook());
  }, [invite]);

  // A different village greets every visit to the hub.
  const [map] = useState(() => roomMap(`hub-${Date.now()}`));
  const scene = useMemo(
    () => ({
      map,
      showcase: false,
      me: "hub",
      members: [
        {
          id: "hub",
          name: name || "Toi",
          character: look,
          alive: true,
          host: false,
          ready: false,
          mate: false,
        },
      ],
      events: [],
      targets: [],
      onSelect: noop,
    }),
    [name, look, map],
  );

  function enter(room: string, key: string) {
    session.save(room);
    setActive({ code: room, key });
    void navigate({ search: { room }, replace: true });
  }
  function pick(index: number) {
    const next = (index + characters.length) % characters.length;
    setLook(next);
    localStorage.setItem(lookKey, String(next));
  }
  async function submit(intent: "create" | "join" | "solo") {
    // Still inside the tap: the only moment a phone lets us go full screen.
    void enterLandscape();
    setPending(intent);
    setError("");
    try {
      const key = guestKey();
      localStorage.setItem(nameKey, name.trim());
      const room =
        intent === "create"
          ? await create({ key, name, character: look })
          : intent === "solo"
            ? await createSolo({ key, name, character: look })
            : await join({ key, name, code, character: look });
      setGuideOpen(false);
      enter(room, key);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(undefined);
    }
  }
  function onJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("join");
  }

  if (active)
    return (
      <Room
        credentials={active}
        back={(forget) => {
          if (forget) session.remove(active.code);
          setResume(session.last());
          setSettingsOpen(false);
          setActive(undefined);
          void navigate({ search: { room: undefined }, replace: true });
        }}
      />
    );
  const named = name.trim().length > 0;
  return (
    <main className="game hub">
      <Village {...scene} />
      <div className="hud">
        <p className="wordmark">WereWolf</p>
        <div className="corner-right">
          <button
            type="button"
            className="icon-button"
            aria-label="Comment jouer"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Réglages"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={18} />
          </button>
        </div>

        <section className="panel side left" aria-labelledby="hub-me">
          <h2 id="hub-me">Toi</h2>
          <label className="field">
            <span>Prénom</span>
            <input
              className="name-input"
              maxLength={20}
              value={name}
              autoComplete="nickname"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ton prénom"
            />
          </label>
          <LookPicker look={look} onPick={pick} />
        </section>

        <section className="panel side right" aria-labelledby="hub-play">
          <h2 id="hub-play">Jouer</h2>
          <button
            type="button"
            className="primary"
            disabled={!named || !!pending}
            onClick={() => void submit("create")}
          >
            {pending === "create" ? "Ouverture…" : "Créer un salon"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!named || !!pending}
            onClick={() => void submit("solo")}
          >
            <GraduationCap size={16} />{" "}
            {pending === "solo" ? "Ouverture…" : "Jouer en solo"}
          </button>
          <p className="divider">ou rejoindre</p>
          <form className="join" onSubmit={onJoin}>
            <label className="field">
              <span className="sr-only">Code du salon</span>
              <input
                className="code-input"
                required
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="CODE"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              type="submit"
              className="icon-button solid"
              aria-label="Rejoindre le salon"
              disabled={!named || code.length !== 6 || !!pending}
            >
              <ArrowRight size={20} />
            </button>
          </form>
          {!named && <p className="hint">Choisis d’abord ton prénom.</p>}
          <button
            type="button"
            className="link"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen size={16} /> Comment jouer ?
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {resume && (
            <button
              type="button"
              className="link"
              onClick={() => {
                void enterLandscape();
                enter(resume, guestKey());
              }}
            >
              <DoorOpen size={16} /> Reprendre le salon <b>{resume}</b>
            </button>
          )}
        </section>

        <p className="footnote">
          {coarse
            ? "Le village se joue en paysage · glisse pour regarder autour"
            : "ZQSD pour te promener · glisse pour regarder autour"}
          {install && (
            <>
              <br />
              Plein écran : Partager → « Sur l’écran d’accueil », puis lance le
              jeu depuis l’icône
            </>
          )}
        </p>
      </div>
      <Drawer
        open={settingsOpen}
        title="Réglages"
        onClose={() => setSettingsOpen(false)}
      >
        <SettingsPanel touch={coarse} />
      </Drawer>
      <Guide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onSolo={
          named && !pending
            ? () => {
                void submit("solo");
              }
            : undefined
        }
      />
    </main>
  );
}
