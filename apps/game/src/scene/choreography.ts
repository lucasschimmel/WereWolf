import * as T from "three";
import type { Outcome, Phase } from "../../shared/rules";
import type { CameraPose, Shot } from "./director";
import { facing, type Pose, seat } from "./layout";
import type { Look } from "./sky";

export type View = "village" | "interior";

export const seatPhases = new Set<Phase>([
  "dawn",
  "mayorElection",
  "vote",
  "runoff",
  "mayorVerdict",
  "dayShot",
  "dawnShot",
  "ended",
  "night",
]);
export const isFree = (phase: Phase | undefined) =>
  !phase || phase === "intro" || phase === "debate";

export function lookFor(phase: Phase | undefined, outcome?: Outcome): Look {
  switch (phase) {
    case undefined:
    case "intro":
      return "dusk";
    case "night":
      return "night";
    case "dawn":
      return "dawn";
    case "debate":
      return "day";
    case "ended":
      return outcome === "pack"
        ? "eclipse"
        : outcome === "village"
          ? "dawn"
          : "dusk";
    default:
      return "golden";
  }
}

const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

export function followPose(
  self: Pose,
  yaw: number,
  pitch: number,
  zoom: number,
  compact: boolean,
): CameraPose {
  const distance = (compact ? 5.2 : 4.4) * zoom;
  const angle = pitch + 0.28;
  const ahead = facing(yaw);
  return {
    position: v(
      self.x + Math.sin(yaw) * distance * Math.cos(angle),
      1.55 + distance * Math.sin(angle),
      self.z + Math.cos(yaw) * distance * Math.cos(angle),
    ),
    target: v(self.x + ahead.x * 1.3, 1.3, self.z + ahead.z * 1.3),
    fov: compact ? 60 : 55,
  };
}

export function seatPose(
  index: number,
  count: number,
  look: number,
  compact: boolean,
): CameraPose {
  const place = seat(index, count);
  const ahead = facing(place.yaw + look);
  const back = compact ? 3.6 : 3.1;
  return {
    position: v(
      place.x - ahead.x * back,
      compact ? 3.3 : 3,
      place.z - ahead.z * back,
    ),
    target: v(place.x + ahead.x * 6, 0.85, place.z + ahead.z * 6),
    fov: compact ? 62 : 56,
  };
}

export function orbitPose(
  time: number,
  offset: number,
  lift: number,
  radius: number,
): CameraPose {
  const angle = time * 0.05 + offset;
  return {
    position: v(
      Math.sin(angle) * radius,
      7 + lift * 6,
      Math.cos(angle) * radius,
    ),
    target: v(0, 1.4, 0),
    fov: 50,
  };
}

export const overviewPose = (): CameraPose => ({
  position: v(0, 12.5, 15.5),
  target: v(0, 0.6, 0),
  fov: 48,
});

export type Cues = {
  pose: () => CameraPose;
  interior: () => CameraPose;
  setView: (view: View) => void;
  setLook: (look: Look, immediate?: boolean) => void;
  ring: () => void;
  alive: boolean;
  reduced: boolean;
  verdict: boolean;
  outcome?: Outcome;
};

/** Cinematic shots that bridge one public phase to the next. */
export function transition(
  previous: Phase | undefined,
  next: Phase | undefined,
  cue: Cues,
): Shot[] {
  const look = lookFor(next, cue.outcome);
  const toNight = next === "night" && previous !== "night";
  const fromNight = previous === "night" && next !== "night";
  if (cue.reduced) {
    if (!toNight && !fromNight) {
      cue.setLook(look);
      return [];
    }
    return [
      { to: cue.pose, duration: 0.45, fade: [0, 1] },
      {
        cut: true,
        to: () => (toNight && cue.alive ? cue.interior() : cue.pose()),
        duration: 0.6,
        fade: [1, 0],
        onStart: () => {
          cue.setView(toNight && cue.alive ? "interior" : "village");
          cue.setLook(look, true);
        },
      },
    ];
  }
  const verdict: Shot[] = cue.verdict
    ? [{ to: overviewPose, duration: 1.5, hold: 2.6, arc: 2 }]
    : [];
  if (toNight)
    return [
      ...verdict,
      {
        to: { position: v(0, 15, 24), target: v(10, 12, -60), fov: 50 },
        duration: 3,
        onStart: () => cue.setLook("night"),
      },
      {
        to: { position: v(2, 22, 17), target: v(40, 60, -110), fov: 46 },
        duration: 1.5,
        fade: [0, 1],
      },
      cue.alive
        ? {
            cut: true,
            to: () => {
              const pose = cue.interior();
              return {
                position: pose.position.clone().add(v(0, 0.5, 1.4)),
                target: pose.target,
                fov: 62,
              };
            },
            duration: 0.05,
            onStart: () => cue.setView("interior"),
          }
        : { cut: true, to: overviewPose, duration: 0.05 },
      {
        to: () => (cue.alive ? cue.interior() : cue.pose()),
        duration: 2,
        fade: [1, 0],
      },
    ];
  if (fromNight) {
    const reveal: Shot[] = [
      { to: cue.pose, duration: 0.7, fade: [0, 1] },
      {
        cut: true,
        to: { position: v(-26, 17, 30), target: v(0, 2, 0), fov: 50 },
        duration: 0.05,
        onStart: () => {
          cue.setView("village");
          cue.setLook(look, true);
        },
      },
    ];
    if (next === "ended")
      return [...reveal, { to: cue.pose, duration: 4, fade: [1, 0], arc: 3 }];
    return [
      ...reveal,
      {
        to: { position: v(0, 5.5, 14), target: v(0, 0.9, 0), fov: 50 },
        duration: 4.4,
        hold: 2.4,
        fade: [1, 0],
        onStart: cue.ring,
      },
      { to: cue.pose, duration: 1.6 },
    ];
  }
  cue.setLook(look);
  switch (next) {
    case "intro":
      cue.ring();
      return [
        { to: overviewPose, duration: 1.8, hold: 1.4, arc: 2 },
        { to: cue.pose, duration: 1.8 },
      ];
    case "vote":
    case "mayorElection":
      cue.ring();
      return [{ to: cue.pose, duration: 2, arc: 3 }];
    case "runoff":
    case "mayorVerdict":
    case "dayShot":
    case "dawnShot":
      return [...verdict, { to: cue.pose, duration: 1.5 }];
    case "ended":
      return [...verdict, { to: cue.pose, duration: 3, arc: 4 }];
    default:
      return [];
  }
}
