import { describe, expect, test } from "bun:test";
import { defaultSettings } from "../shared/rules";
import type { Id } from "./_generated/dataModel";
import { decide } from "./bots";
import type { Match } from "./engine";

const first = () => 0;

function table(
  roles: Record<string, Match["seats"][string]["role"]>,
  patch: Partial<Match> = {},
): Match {
  const seats = Object.fromEntries(
    Object.entries(roles).map(([id, role]) => [
      id,
      {
        role,
        alive: true,
        spent: false,
        guard: "",
        heal: true,
        poison: true,
        intel: [] as string[],
      },
    ]),
  );
  return {
    room: "fixture" as Id<"rooms">,
    phase: "night",
    turn: "pack",
    revision: 1,
    cycle: 1,
    end: 0,
    settings: defaultSettings,
    seats,
    votes: {},
    night: {},
    runoff: [],
    attack: "",
    heal: false,
    poison: "",
    shot: "",
    hunter: "",
    deaths: [],
    events: [],
    audit: [],
    pauses: 2,
    ...patch,
  };
}

const village = {
  wolf: "wolf",
  lone: "wolf",
  seer: "seer",
  witch: "witch",
  hunter: "hunter",
  a: "villager",
  b: "villager",
  c: "villager",
} as const;

describe("solo bots", () => {
  test("a wolf only hunts players outside the pack", () => {
    const match = table(village);

    const moves = decide(match, "wolf", first);

    expect(moves).toHaveLength(1);
    expect(moves[0].action).toBe("wolf");
    expect(["lone", "wolf"]).not.toContain(moves[0].target);
  });

  test("a bot waits when it holds no turn", () => {
    const match = table(village, { turn: "seer" });

    expect(decide(match, "wolf", first)).toEqual([]);
  });

  test("a bot does not act twice in the same turn", () => {
    const match = table(village, { turn: "seer", night: { seer: "a" } });

    expect(decide(match, "seer", first)).toEqual([]);
  });

  test("a seer does not look at the same player twice", () => {
    const match = table(village, { turn: "seer" });
    match.seats.seer.intel.push("1|hunter|village");

    const [move] = decide(match, "seer", first);

    expect(move.target).not.toBe("hunter");
  });

  test("the witch heals the victim, then validates her turn", () => {
    const match = table(village, {
      phase: "potions",
      turn: "witch",
      attack: "a",
    });

    const moves = decide(match, "witch", () => 0.01);

    expect(moves.map((move) => move.action)).toEqual(["heal", "done"]);
    expect(moves[0].target).toBe("a");
  });

  test("a dead bot never plays", () => {
    const match = table(village, { phase: "vote" });
    match.seats.a.alive = false;

    expect(decide(match, "a", first)).toEqual([]);
  });

  test("a wolf votes against a villager while one remains", () => {
    const match = table(village, { phase: "vote" });

    const [move] = decide(match, "wolf", () => 0.5);

    expect(["lone", "wolf"]).not.toContain(move.target);
  });

  test("a seer votes against the wolf it identified", () => {
    const match = table(village, { phase: "vote" });
    match.seats.seer.intel.push("1|lone|pack");

    expect(decide(match, "seer", () => 0.5)).toEqual([
      { action: "vote", target: "lone" },
    ]);
  });

  test("a dead hunter takes someone with him", () => {
    const match = table(village, {
      phase: "dayShot",
      hunter: "hunter",
    });
    match.seats.hunter.alive = false;

    const [move] = decide(match, "hunter", first);

    expect(move.action).toBe("shot");
    expect(move.target).not.toBe("");
  });

  test("Cupid links two distinct players", () => {
    const match = table({ ...village, cupid: "cupid" }, { turn: "cupid" });

    const moves = decide(match, "cupid", first);

    expect(moves.map((move) => move.action)).toEqual(["link", "link"]);
    expect(moves[0].target).not.toBe(moves[1].target);
  });

  test("Cupid completes an existing link with just one other player", () => {
    const match = table(
      { ...village, cupid: "cupid" },
      { turn: "cupid", lovers: ["wolf"] },
    );

    const moves = decide(match, "cupid", first);

    expect(moves).toEqual([{ action: "link", target: "lone" }]);
  });

  test("a mayor election vote never goes to the bot itself", () => {
    const match = table(village, { phase: "mayorElection" });

    const [move] = decide(match, "a", first);

    expect(move).toMatchObject({ action: "electMayor" });
    expect(move.target).not.toBe("a");
  });
});
