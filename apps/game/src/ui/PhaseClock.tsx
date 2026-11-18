import {
  Moon,
  Pause,
  Sparkles,
  Sun,
  Sunrise,
  Swords,
  Vote,
} from "lucide-react";
import { useRef } from "react";
import { type Phase, phaseNames } from "../../shared/rules";

const icons: Partial<Record<Phase, typeof Sun>> = {
  night: Moon,
  dawn: Sunrise,
  debate: Sun,
  vote: Vote,
  runoff: Vote,
  dayShot: Swords,
  intro: Sparkles,
};

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

export function PhaseClock({
  phase,
  cycle,
  end,
  now,
  paused,
}: {
  phase: Phase;
  cycle: number;
  end: number;
  now: number;
  paused?: number;
}) {
  const { seconds, progress } = useCountdown(
    `${phase}:${cycle}:${end}`,
    end,
    now,
    paused,
  );
  const Icon = icons[phase] ?? Sun;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const urgent = seconds <= 10 && phase !== "ended" && paused === undefined;
  const minutes = Math.floor(seconds / 60);
  const label = minutes
    ? `${minutes}:${String(seconds % 60).padStart(2, "0")}`
    : `${seconds}`;
  return (
    <div
      className={`phase-clock phase-${phase}${urgent ? " urgent" : ""}`}
      role="timer"
      aria-live="off"
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} className="track" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          className="fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span className="clock-icon">
        {paused !== undefined ? (
          <Pause size={15} />
        ) : (
          <Icon size={15} strokeWidth={2} />
        )}
      </span>
      <span className="clock-text">
        <strong>{phaseNames[phase]}</strong>
        <small>
          Tour {cycle}
          {phase !== "ended" && (
            <>
              {" "}
              ·{" "}
              {paused !== undefined
                ? "en pause"
                : `${label}${minutes ? "" : " s"}`}
            </>
          )}
        </small>
      </span>
    </div>
  );
}
