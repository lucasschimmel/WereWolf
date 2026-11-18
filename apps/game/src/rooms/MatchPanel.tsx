import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { type Camp, campNames, cardFor, phaseNames } from "../../shared/rules";
import type { Credentials } from "../session";
import type { MatchView, View } from "./model";

const actionNames = {
  vote: "Voter",
  shot: "Riposter",
  wolf: "Choisir la cible de la meute",
  inspect: "Observer un camp",
  protect: "Protéger un vivant",
  activity: "Observer une action",
};
export function MatchPanel({
  room,
  match,
  credentials,
  sceneTarget,
  act,
}: {
  room: View;
  match: MatchView;
  credentials: Credentials;
  sceneTarget: string;
  act: (operation: () => Promise<unknown>) => Promise<void>;
}) {
  const choose = useMutation(api.game.choose);
  const pause = useMutation(api.game.pause);
  const rematch = useMutation(api.rooms.rematch);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(
    0,
    Math.ceil((match.remaining ?? match.end - now) / 1000),
  );
  const card = cardFor(match.role, room.settings);
  const name = (id: string) =>
    room.members.find((member) => member.id === id)?.name ??
    (id || "Abstention");
  const action = match.action;
  const isEnded = match.phase === "ended";
  return (
    <>
      <section className="panel lobby-panel">
        <div className="section-title">
          <h1>{phaseNames[match.phase]}</h1>
          {!isEnded && (
            <span>
              {match.remaining !== undefined ? "Pause · " : ""}
              {remaining}s
            </span>
          )}
        </div>
        {match.outcome && (
          <p className="result">
            {match.outcome === "draw"
              ? "Partie nulle"
              : match.outcome === "solo"
                ? "Le Bouffon l’emporte"
                : `${match.outcome === "pack" ? "La Meute" : "Le Village"} l’emporte`}
          </p>
        )}
        <div className="role-card">
          <span>{campNames[card.camp]}</span>
          <h2>{card.name}</h2>
          <p>{card.text}</p>
          {"flavor" in card && card.flavor && (
            <p>
              <i>{card.flavor}</i>
            </p>
          )}
        </div>
        {room.isHost &&
          match.phase === "debate" &&
          match.pauses > 0 &&
          match.remaining === undefined && (
            <button
              type="button"
              onClick={() => void act(() => pause(credentials))}
            >
              Pause 60 s · {match.pauses} restante(s)
            </button>
          )}
        {room.isHost && isEnded && (
          <button
            type="button"
            className="primary"
            onClick={() => void act(() => rematch(credentials))}
          >
            Retour au lobby
          </button>
        )}
        {match.mates.length > 0 && (
          <p>Meute · {match.mates.map(name).join(", ")}</p>
        )}
        {match.wolves && (
          <ul className="deck">
            {Object.entries(match.wolves).map(([wolf, to]) => (
              <li key={wolf}>
                {name(wolf)} → {name(to)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {(action || match.potions) && (
        <section className="panel lobby-panel">
          {action && (
            <>
              <h2>{actionNames[action]}</h2>
              <div className="targets">
                {match.targets?.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className={sceneTarget === id ? "aimed" : ""}
                    aria-pressed={match.selected === id}
                    onClick={() =>
                      void act(() =>
                        choose({ ...credentials, action, target: id }),
                      )
                    }
                  >
                    {name(id)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  void act(() => choose({ ...credentials, action, target: "" }))
                }
              >
                {action === "vote" ? "S’abstenir" : "Passer"}
              </button>
            </>
          )}
          {match.potions && (
            <>
              <h2>Potions</h2>
              {match.potions.attack && (
                <button
                  type="button"
                  aria-pressed={match.potions.heal}
                  onClick={() =>
                    void act(() =>
                      choose({
                        ...credentials,
                        action: "heal",
                        target: match.potions?.heal
                          ? ""
                          : (match.potions?.attack ?? ""),
                      }),
                    )
                  }
                >
                  Sauver {name(match.potions.attack)}
                </button>
              )}
              {match.potions.targets.length > 0 && (
                <label>
                  Poison
                  <select
                    value={match.potions.poison}
                    onChange={(event) => {
                      const target = event.target.value;
                      void act(() =>
                        choose({ ...credentials, action: "poison", target }),
                      );
                    }}
                  >
                    <option value="">Ne pas utiliser</option>
                    {match.potions.targets.map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!match.potions.attack && match.potions.targets.length === 0 && (
                <p>Aucune potion disponible.</p>
              )}
            </>
          )}
        </section>
      )}
      {match.intel.length > 0 && (
        <section className="panel lobby-panel">
          <h2>Tes observations</h2>
          <ul className="deck">
            {match.intel.map((entry) => {
              const [cycle, target, result] = entry.split("|");
              return (
                <li key={entry}>
                  Nuit {cycle} · {name(target)} ·{" "}
                  {result === "active"
                    ? "A agi"
                    : result === "idle"
                      ? "Aucune action"
                      : campNames[result as Camp]}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="panel lobby-panel">
        <h2>Habitants</h2>
        <ul className="roster">
          {room.members.map((member) => (
            <li key={member.id} className={member.alive ? "" : "dim"}>
              <span>{member.name}</span>
              <span>
                {member.role
                  ? cardFor(member.role, room.settings).name
                  : member.alive
                    ? "En vie"
                    : "Éliminé"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {match.events.length > 0 && (
        <section className="panel lobby-panel">
          <h2>Journal du village</h2>
          <Timeline events={[...match.events].reverse()} name={name} />
        </section>
      )}
      {match.audit && (
        <section className="panel lobby-panel">
          <h2>Actions nocturnes et ripostes</h2>
          <Timeline events={match.audit} name={name} />
        </section>
      )}
    </>
  );
}
function Timeline({
  events,
  name,
}: {
  events: MatchView["events"];
  name: (id: string) => string;
}) {
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={`${event.cycle}:${event.label}`}>
          <b>
            Tour {event.cycle} · {event.label}
          </b>
          {event.deaths && (
            <div>
              {event.deaths.length
                ? event.deaths.map(name).join(", ")
                : "Aucune élimination"}
            </div>
          )}
          {event.votes && (
            <div>
              {Object.entries(event.votes).map(([from, to]) => (
                <div key={from}>
                  {name(from) === "Abstention" ? from : name(from)} → {name(to)}
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
