import { createFileRoute } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient, useMutation } from "convex/react";
import { type FormEvent, useEffect, useState } from "react";
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
const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : undefined;
function Home() {
  if (!client)
    return (
      <main className="entry">
        <h1>WereWolf</h1>
        <p>Configure VITE_CONVEX_URL pour ouvrir le village.</p>
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
  const [code, setCode] = useState(invite ?? "");
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
      <div className="entry-art" aria-hidden="true">
        <div className="moon" />
        <div className="fog" />
        <div className="ridgeline far" />
        <div className="ridgeline near" />
      </div>
      <section className="entry-copy">
        <div className="brand">
          <span aria-hidden="true">◈</span> WereWolf
        </div>
        <h1>
          Le village
          <br />
          s’endort.
        </h1>
        <p>
          Une partie de Loup-Garou en 3D, entre 8 et 15 amis. Retrouvez-vous en
          vocal sur Discord.
        </p>
      </section>
      <section className="entry-panel panel">
        <div className="switch">
          <button
            type="button"
            aria-pressed={intent === "create"}
            onClick={() => setIntent("create")}
          >
            Créer
          </button>
          <button
            type="button"
            aria-pressed={intent === "join"}
            onClick={() => setIntent("join")}
          >
            Rejoindre
          </button>
        </div>
        <h2>
          {intent === "create" ? "Ouvrir un salon" : "Rejoindre un salon"}
        </h2>
        <form onSubmit={submit}>
          <label>
            Pseudo
            <input
              required
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ton nom au village"
            />
          </label>
          {intent === "join" && (
            <label>
              Code du salon
              <input
                required
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC234"
                autoCapitalize="characters"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={pending}>
            {pending
              ? "Connexion…"
              : intent === "create"
                ? "Créer la partie"
                : "Rejoindre la partie"}
          </button>
        </form>
        {resume && (
          <button
            type="button"
            className="link"
            onClick={() => enter(resume, guestKey())}
          >
            Reprendre le salon {resume}
          </button>
        )}
      </section>
    </main>
  );
}
