import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  cardFor,
  type Phase,
  type Role,
  type Settings,
} from "../../shared/rules";
import type { MatchView, View } from "../rooms/model";

type Tone = "night" | "day" | "blood" | "gold" | "calm";
export type Proclamation = {
  id: number;
  at: number;
  title: string;
  detail?: string;
  tone: Tone;
};

const headlines: Partial<
  Record<Phase, (role: Role) => Omit<Proclamation, "id" | "at">>
> = {
  intro: () => ({
    title: "Les cartes sont distribuées",
    detail: "Découvre ton rôle, en secret.",
    tone: "gold",
  }),
  night: (role) => ({
    title: "La nuit tombe",
    detail: role === "wolf" ? "La meute se réveille…" : "Le village s’endort.",
    tone: role === "wolf" ? "blood" : "night",
  }),
  dawn: () => ({ title: "Le jour se lève", tone: "day" }),
  debate: () => ({
    title: "Débat",
    detail: "Accusez, défendez, mentez. Sur Discord.",
    tone: "day",
  }),
  vote: () => ({
    title: "Le clocher sonne",
    detail: "Désigne la personne à éliminer.",
    tone: "gold",
  }),
  runoff: () => ({
    title: "Égalité",
    detail: "Second vote entre les ex æquo.",
    tone: "gold",
  }),
  dayShot: () => ({
    title: "Le Chasseur riposte",
    detail: "Un dernier tir avant de tomber.",
    tone: "blood",
  }),
};

function tally(votes: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const target of Object.values(votes))
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** Queues cinematic proclamations for phase changes, verdicts and deaths. */
export function useHerald(
  room: View | undefined,
  match: MatchView | null,
  now: number,
) {
  const [queue, setQueue] = useState<Proclamation[]>([]);
  const seen = useRef<{ phase?: Phase; events: number; started: boolean }>({
    events: 0,
    started: false,
  });
  const counter = useRef(0);
  const members = room?.members;
  const settings = room?.settings;

  useEffect(() => {
    const name = (id: string) =>
      members?.find((member) => member.id === id)?.name ?? "Quelqu’un";
    const role = (id: string) =>
      members?.find((member) => member.id === id)?.role;
    const state = seen.current;
    if (!match || !settings) {
      state.phase = undefined;
      state.events = 0;
      state.started = false;
      return;
    }
    const additions: Proclamation[] = [];
    const push = (delay: number, item: Omit<Proclamation, "id" | "at">) =>
      additions.push({
        ...item,
        id: ++counter.current,
        at: Date.now() + delay,
      });
    if (!state.started) {
      state.started = true;
      state.phase = match.phase;
      state.events = match.events.length;
      return;
    }
    if (match.phase !== state.phase) {
      const make = headlines[match.phase];
      if (make) push(match.phase === "night" ? 600 : 0, make(match.role));
      if (match.phase === "night" || match.phase === "vote")
        navigator.vibrate?.(match.phase === "night" ? [30, 60, 30] : 40);
      state.phase = match.phase;
    }
    for (const event of match.events.slice(state.events)) {
      if (event.votes) {
        const ranking = tally(event.votes);
        const top = ranking[0];
        const tied =
          ranking.filter(([, count]) => count === top?.[1]).length > 1;
        push(400, {
          title: !top
            ? "Aucun suffrage"
            : tied
              ? "Le village hésite"
              : `${name(top[0])} est désigné·e`,
          detail: top
            ? ranking
                .slice(0, 3)
                .map(([id, count]) => `${name(id)} · ${count} voix`)
                .join("   ")
            : "Personne n’a voté.",
          tone: "gold",
        });
      }
      if (event.deaths) {
        const dawn = event.label === "À l’aube";
        if (!event.deaths.length)
          push(dawn ? 3200 : 2200, {
            title: dawn
              ? "Personne n’est mort cette nuit"
              : "Personne n’est éliminé",
            detail: dawn ? "Le village se réveille au complet." : undefined,
            tone: "calm",
          });
        for (const [index, id] of event.deaths.entries()) {
          const revealed = role(id);
          push((dawn ? 3600 : 2400) + index * 3200, {
            title: dawn
              ? `${name(id)} ne s’est pas réveillé·e`
              : `${name(id)} est éliminé·e`,
            detail: revealed
              ? `C’était : ${cardFor(revealed, settings).name}`
              : "Sa carte reste secrète.",
            tone: "blood",
          });
        }
      }
    }
    state.events = match.events.length;
    if (additions.length) setQueue((current) => [...current, ...additions]);
  }, [match, members, settings]);

  const live = queue.filter((item) => item.at <= now && now - item.at < 3400);
  useEffect(() => {
    if (queue.some((item) => now - item.at >= 3400))
      setQueue((current) => current.filter((item) => now - item.at < 3400));
  }, [now, queue]);
  return live.at(-1);
}

export function Herald({ item }: { item?: Proclamation }) {
  if (!item) return null;
  return (
    <div
      className={`herald tone-${item.tone}`}
      key={item.id}
      role="status"
      aria-live="polite"
    >
      <span className="herald-rule" aria-hidden="true" />
      <h2>{item.title}</h2>
      {item.detail && <p>{item.detail}</p>}
      <span className="herald-rule" aria-hidden="true" />
    </div>
  );
}

export function RoleReveal({
  role,
  settings,
  onClose,
  children,
}: {
  role: Role;
  settings: Settings;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  const card = cardFor(role, settings);
  return (
    <div
      className="reveal"
      role="dialog"
      aria-label={`Ton rôle : ${card.name}`}
    >
      <button
        type="button"
        className="reveal-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="reveal-card">
        <p className="reveal-kicker">Tu es</p>
        {children}
        <button type="button" className="ghost" onClick={onClose}>
          Garder le secret
        </button>
      </div>
    </div>
  );
}
