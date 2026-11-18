import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { ArrowRight, DoorOpen, Sparkles } from "lucide-react";
import { type FormEvent, lazy, Suspense, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Room } from "../rooms/Room";
import { errorMessage, guestKey, session } from "../session";

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
const showcase = {
  showcase: true,
  members: [],
  me: "",
  positions: [],
  events: [],
  targets: [],
  onMove: noop,
  onSelect: noop,
};

function Home() {
  if (!client)
    return (
      <main className="gate">
        <section className="gate-card">
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

function Gate() {
  const { room: invite } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [intent, setIntent] = useState<"create" | "join">(
    invite ? "join" : "create",
  );
  const [code, setCode] = useState(invite?.toUpperCase() ?? "");
  const [name, setName] = useState("");
  const [active, setActive] = useState<{ code: string; key: string }>();
  const [resume, setResume] = useState<string>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const create = useMutation(api.rooms.create);
  const join = useMutation(api.rooms.join);

  useEffect(() => {
    const key = guestKey();
    if (invite && session.has(invite.toUpperCase()))
      setActive({ code: invite.toUpperCase(), key });
    setResume(session.last());
    const stored = localStorage.getItem("werewolf.name");
    if (stored) setName(stored);
  }, [invite]);

  function enter(room: string, key: string) {
    session.save(room);
    setActive({ code: room, key });
    void navigate({ search: { room }, replace: true });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const key = guestKey();
      localStorage.setItem("werewolf.name", name.trim());
      const room =
        intent === "create"
          ? await create({ key, name })
          : await join({ key, name, code });
      enter(room, key);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
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
  return (
    <main className="entry">
      <Suspense fallback={null}>
        <Village {...showcase} />
      </Suspense>
      <div className="entry-shade" aria-hidden="true" />
      <section className="entry-copy">
        <p className="entry-kicker">
          <Sparkles size={14} /> Loup-Garou entre amis · 8 à 15 joueurs
        </p>
        <h1>
          Le village
          <br />
          <em>s’endort.</em>
        </h1>
        <p>
          Une place, un puits, des lanternes — et quelques loups parmi vous.
          Retrouvez-vous en vocal sur Discord, le jeu s’occupe du reste.
        </p>
      </section>
      <section className="entry-card">
        <div className="segmented wide">
          <button
            type="button"
            aria-pressed={intent === "create"}
            onClick={() => setIntent("create")}
          >
            Créer un salon
          </button>
          <button
            type="button"
            aria-pressed={intent === "join"}
            onClick={() => setIntent("join")}
          >
            Rejoindre
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            <span>Ton nom au village</span>
            <input
              required
              maxLength={20}
              value={name}
              autoComplete="nickname"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Margot"
            />
          </label>
          {intent === "join" && (
            <label className="field">
              <span>Code du salon</span>
              <input
                className="code-input"
                required
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC234"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="primary big" disabled={pending}>
            {pending
              ? "Ouverture des portes…"
              : intent === "create"
                ? "Allumer les lanternes"
                : "Entrer au village"}
            {!pending && <ArrowRight size={18} />}
          </button>
        </form>
        {resume && (
          <button
            type="button"
            className="ghost resume"
            onClick={() => enter(resume, guestKey())}
          >
            <DoorOpen size={16} /> Reprendre le salon <b>{resume}</b>
          </button>
        )}
      </section>
    </main>
  );
}
