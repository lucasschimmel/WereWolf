import { Crown, Skull, UserMinus } from "lucide-react";
import {
  type Camp,
  cardFor,
  characters,
  type Settings,
} from "../../shared/rules";
import type { MatchView, Member, View } from "./model";

export function Roster({
  room,
  onKick,
}: {
  room: View;
  onKick?: (id: Member["id"]) => void;
}) {
  const playing = !!room.match;
  return (
    <ul className="roster">
      {room.members.map((member) => {
        const look = characters[member.character] ?? characters[0];
        const card = member.role
          ? cardFor(member.role, room.settings)
          : undefined;
        const mate =
          room.match?.mates.includes(member.id) && member.id !== room.me;
        return (
          <li key={member.id} className={member.alive ? "" : "fallen"}>
            <span
              className="person-dot large"
              style={{ background: look.color, borderColor: look.trim }}
              aria-hidden="true"
            >
              {!member.alive && <Skull size={13} />}
            </span>
            <span className="roster-name">
              <strong>
                {member.name}
                {member.id === room.me && <small> · toi</small>}
              </strong>
              <small>
                {member.host && (
                  <>
                    <Crown size={11} /> Hôte ·{" "}
                  </>
                )}
                {playing ? (member.alive ? "En vie" : "Éliminé·e") : look.name}
                {mate && <b className="mate"> · Meute</b>}
              </small>
            </span>
            {card ? (
              <span className={`roster-role camp-${card.camp}`}>
                {card.name}
              </span>
            ) : !playing ? (
              <span className={`ready-chip${member.ready ? " on" : ""}`}>
                {member.ready ? "Prêt" : "En attente"}
              </span>
            ) : null}
            {onKick && !member.host && !playing && (
              <button
                type="button"
                className="icon-button"
                aria-label={`Retirer ${member.name}`}
                onClick={() => onKick(member.id)}
              >
                <UserMinus size={15} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Event = MatchView["events"][number];

function Ballots({
  votes,
  name,
}: {
  votes: Record<string, string>;
  name: (id: string) => string;
}) {
  const counts = new Map<string, string[]>();
  const abstained: string[] = [];
  for (const [from, to] of Object.entries(votes)) {
    if (!to) abstained.push(from);
    else counts.set(to, [...(counts.get(to) ?? []), from]);
  }
  const max = Math.max(1, ...[...counts.values()].map((list) => list.length));
  return (
    <div className="ballots">
      {[...counts]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([target, voters]) => (
          <div key={target} className="ballot">
            <span className="ballot-head">
              <b>{name(target)}</b>
              <span>{voters.length}</span>
            </span>
            <span
              className="bar"
              style={{ width: `${(voters.length / max) * 100}%` }}
            />
            <small>{voters.map(name).join(", ")}</small>
          </div>
        ))}
      {abstained.length > 0 && (
        <small className="dim">
          Abstention : {abstained.map(name).join(", ")}
        </small>
      )}
    </div>
  );
}

export function Journal({
  events,
  members,
  settings,
  audit,
}: {
  events: Event[];
  members: Member[];
  settings: Settings;
  audit?: boolean;
}) {
  const name = (id: string) =>
    members.find((member) => member.id === id)?.name ?? id;
  if (!events.length)
    return <p className="dim">Le journal est encore vierge.</p>;
  const occurrences = new Map<string, number>();
  const keyed = events.map((event) => {
    const base = `${event.cycle}:${event.label}`;
    const count = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, count);
    return { event, key: `${base}:${count}` };
  });
  return (
    <ol className="journal">
      {keyed.reverse().map(({ event, key }) => (
        <li key={key}>
          <span className="journal-cycle">Tour {event.cycle}</span>
          <strong>{event.label}</strong>
          {event.deaths &&
            (event.deaths.length ? (
              <ul className="deaths">
                {event.deaths.map((id) => {
                  const role = members.find((member) => member.id === id)?.role;
                  const card = role ? cardFor(role, settings) : undefined;
                  return (
                    <li key={id}>
                      <Skull size={13} /> {name(id)}
                      {card && (
                        <span className={`camp-${card.camp as Camp}`}>
                          {" "}
                          · {card.name}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="dim">Aucune élimination.</p>
            ))}
          {event.votes &&
            (audit ? (
              <ul className="deaths">
                {Object.entries(event.votes).map(([from, to]) => (
                  <li key={from}>
                    {name(from)} → {to ? name(to) : "rien"}
                  </li>
                ))}
              </ul>
            ) : (
              <Ballots votes={event.votes} name={name} />
            ))}
        </li>
      ))}
    </ol>
  );
}
