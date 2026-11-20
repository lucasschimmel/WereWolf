import { ConvexHttpClient } from "convex/browser";
import { useConvex } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../../convex/_generated/api";
import {
  type PresenceStatus,
  presenceInterval,
  presenceStatus,
} from "../../shared/presence";
import type { Credentials } from "../session";
import type { Member, View } from "./model";

export function usePresenceHeartbeat({ code, key }: Credentials) {
  const { url } = useConvex();
  useEffect(() => {
    const client = new ConvexHttpClient(url, {
      // Convex only calls fetch. Bun's ambient type also declares fetch.preconnect.
      fetch: ((input, init) =>
        fetch(input, { ...init, keepalive: true })) as typeof fetch,
    });
    const tab = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    let revision = 0;
    let status: PresenceStatus | undefined;
    let suspended = false;
    const send = (next: PresenceStatus, heartbeat = false) => {
      if (status === next && !heartbeat) return;
      status = next;
      void client
        .mutation(
          api.game.beat,
          { code, key, report: { tab, revision: ++revision, status: next } },
          { skipQueue: true },
        )
        .catch(() => console.warn("Could not update room presence"));
    };
    const current = () =>
      document.visibilityState === "visible" && document.hasFocus()
        ? "active"
        : "inactive";
    const refresh = () => {
      if (!suspended) send(current());
    };
    const close = () => {
      suspended = true;
      send("disconnected");
    };
    const restore = () => {
      suspended = false;
      refresh();
    };
    const timer = window.setInterval(() => {
      if (!suspended) send(current(), true);
    }, presenceInterval);
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("blur", refresh);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", restore);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("blur", refresh);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", restore);
      close();
    };
  }, [code, key, url]);
}

type Notify = (text: string) => void;
export type MemberPresence = ReadonlyMap<Member["id"], PresenceStatus>;

export function usePresence(
  room: View | undefined,
  now: number,
  notify: Notify,
) {
  const known = useRef<Map<Member["id"], Member> | null>(null);
  const previous = useRef<MemberPresence>(new Map());
  const statuses = useMemo(() => {
    const next = new Map<Member["id"], PresenceStatus>();
    for (const member of room?.members ?? []) {
      if (member.id === room?.me) continue;
      const status = presenceStatus(member, now);
      if (status) next.set(member.id, status);
    }
    return next;
  }, [room, now]);

  useEffect(() => {
    if (!room) return;
    const members = new Map(room.members.map((member) => [member.id, member]));
    if (known.current) {
      for (const member of members.values()) {
        if (!known.current.has(member.id)) {
          notify(`${member.name} vient de rejoindre le village`);
          continue;
        }
        const before = previous.current.get(member.id);
        const after = statuses.get(member.id);
        if (before && before !== "disconnected" && after === "disconnected")
          notify(`${member.name} s’est déconnecté`);
        if (before === "disconnected" && after && after !== "disconnected")
          notify(`${member.name} est de retour`);
      }
      for (const member of known.current.values())
        if (!members.has(member.id))
          notify(`${member.name} a quitté le village`);
    }
    known.current = members;
    previous.current = statuses;
  }, [room, statuses, notify]);

  return statuses;
}
