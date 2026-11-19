import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { ArrowRight, DoorOpen } from "lucide-react";
import {
  type FormEvent,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import { characters } from "../../shared/rules";
import { Room } from "../rooms/Room";
import { errorMessage, guestKey, session } from "../session";
import { LookPicker } from "../ui/LookPicker";

export const Route = createFileRoute("/")({
  component: Home,
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    room: typeof search.room === "string" ? search.room : undefined,
  }),
});

const Village = lazy(() => import("../scene/Village"));
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
  const [pending, setPending] = useState<"create" | "join">();
  const create = useMutation(api.rooms.create);
  const join = useMutation(api.rooms.join);

  useEffect(() => {
    const key = guestKey();
    if (invite && session.has(invite.toUpperCase()))
      setActive({ code: invite.toUpperCase(), key });
    setResume(session.last());
    setName(localStorage.getItem(nameKey) ?? "");
    setLook(storedLook());
  }, [invite]);

  const scene = useMemo(
    () => ({
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
    [name, look],
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
  async function submit(intent: "create" | "join") {
    setPending(intent);
    setError("");
    try {
      const key = guestKey();
      localStorage.setItem(nameKey, name.trim());
      const room =
        intent === "create"
          ? await create({ key, name, character: look })
          : await join({ key, name, code, character: look });
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
          setActive(undefined);
          void navigate({ search: { room: undefined }, replace: true });
        }}
      />
    );
  const named = name.trim().length > 0;
  return (
    <main className="game hub">
      <Suspense
        fallback={<div className="stage-loading">La place s’éveille…</div>}
      >
        <Village {...scene} />
      </Suspense>
      <div className="hud">
        <p className="wordmark">WereWolf</p>

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
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {resume && (
            <button
              type="button"
              className="link"
              onClick={() => enter(resume, guestKey())}
            >
              <DoorOpen size={16} /> Reprendre le salon <b>{resume}</b>
            </button>
          )}
        </section>

        <p className="footnote">
          ZQSD pour te promener · glisse pour regarder autour
        </p>
      </div>
    </main>
  );
}
