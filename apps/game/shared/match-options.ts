import type { OptionalRole } from "./rules";

export type Timer =
  | "intro"
  | "pack"
  | "night"
  | "dawn"
  | "mayorElection"
  | "debate"
  | "vote"
  | "runoff"
  | "mayorVerdict"
  | "shot";
export const percent = { min: 0, max: 100 } as const;
export const packSize = { min: 1, max: 4 } as const;
export const minVillagers = 2;

export type ConfigurableRole = "wolf" | OptionalRole;
export type CardCopies = Partial<Record<ConfigurableRole, number>>;

/** Settings stored before custom games had a fixed deck. */
export type MatchOptions = {
  wolves?: number;
  timings?: Partial<Record<Timer, number>>;
  chances?: Partial<Record<OptionalRole, number>>;
};
