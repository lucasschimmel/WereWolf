import type { ReactNode } from "react";
import { useRef } from "react";

export function useCountdown(
  key: string,
  end: number,
  now: number,
  paused?: number,
) {
  const start = useRef({ key: "", at: 0, total: 1 });
  if (start.current.key !== key) {
    start.current = { key, at: now, total: Math.max(end - now, 1000) };
  }
  const left = paused ?? Math.max(0, end - now);
  return {
    seconds: Math.ceil(left / 1000),
    progress: Math.min(1, left / start.current.total),
  };
}

export type Tone = "day" | "night" | "pack" | "seer" | "witch" | "hunter";

export type Step = { label: string; state: "done" | "now" | "next" };

/**
 * The one piece of HUD that is always there during a match: what is
 * happening, what to do, and how long is left.
 */
export function Status({
  id,
  title,
  detail,
  end,
  now,
  paused,
  tone = "day",
  steps,
  children,
}: {
  id: string;
  title: string;
  detail?: string;
  end?: number;
  now: number;
  paused?: number;
  tone?: Tone;
  steps?: Step[];
  children?: ReactNode;
}) {
  const { seconds, progress } = useCountdown(id, end ?? now, now, paused);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const minutes = Math.floor(seconds / 60);
  const label = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  const urgent = end !== undefined && seconds <= 5 && paused === undefined;
  return (
    <div
      className={`status tone-${tone}${urgent ? " urgent" : ""}`}
      role="timer"
      aria-live="off"
    >
      {end !== undefined && (
        <svg className="status-ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r={radius} className="track" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="fill"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
      )}
      <span className="status-text">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {steps && steps.length > 1 && (
        <ol className="status-steps" aria-label="Ordre de la nuit">
          {steps.map((step) => (
            <li
              key={step.label}
              className={step.state}
              aria-current={step.state === "now" ? "step" : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>
      )}
      {end !== undefined && (
        <span className="status-time">
          {paused !== undefined ? "pause" : label}
        </span>
      )}
      {children}
    </div>
  );
}
