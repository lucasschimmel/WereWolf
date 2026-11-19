import { useEffect, useRef, useState } from "react";
import type { Member, View } from "./model";

/** A player whose heartbeat has not changed for this long is disconnected. */
export const offlineAfter = 30_000;

type Notify = (text: string) => void;

/**
 * Watches the roster for arrivals, departures and dropped connections.
 * Returns the ids of the players currently disconnected (never `me`).
 * Staleness is measured on this client's clock from when a member's
 * heartbeat value last changed, so clock skew with the server is harmless.
 */
export function usePresence(
  room: View | undefined,
  now: number,
  notify: Notify,
) {
  const [offline, setOffline] = useState<ReadonlySet<Member["id"]>>(new Set());
  const known = useRef<Map<string, Member> | null>(null);
  const beats = useRef(new Map<string, { seen: number; at: number }>());
  const gone = useRef(new Set<Member["id"]>());

  useEffect(() => {
    if (!room) return;
    const members = new Map(room.members.map((member) => [member.id, member]));
    const before = known.current;
    if (before) {
      for (const member of members.values())
        if (!before.has(member.id))
          notify(`${member.name} vient de rejoindre le village`);
      for (const member of before.values())
        if (!members.has(member.id)) {
          gone.current.delete(member.id);
          beats.current.delete(member.id);
          notify(`${member.name} a quitté le village`);
        }
    }
    known.current = members;

    const next = new Set<Member["id"]>();
    for (const member of members.values()) {
      const beat = beats.current.get(member.id);
      if (!beat || beat.seen !== member.seen)
        beats.current.set(member.id, { seen: member.seen, at: now });
      else if (member.id !== room.me && now - beat.at > offlineAfter)
        next.add(member.id);
    }
    for (const id of next)
      if (!gone.current.has(id))
        notify(`${members.get(id)?.name} s’est déconnecté`);
    for (const id of gone.current)
      if (!next.has(id) && members.has(id))
        notify(`${members.get(id)?.name} est de retour`);
    gone.current = next;
    setOffline((current) =>
      current.size === next.size && [...next].every((id) => current.has(id))
        ? current
        : next,
    );
  }, [room, now, notify]);

  return offline;
}
