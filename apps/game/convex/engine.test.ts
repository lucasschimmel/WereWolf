import { describe, expect, test } from "bun:test";
import { defaultSettings, maskedRange, turnSeconds } from "../shared/rules";
import type { Id } from "./_generated/dataModel";
import {
  advanceNight,
  finishDeaths,
  firstWindow,
  inspect,
  isTurnComplete,
  type Match,
  nextNight,
  nightAbility,
  nightOrder,
  resolvePotions,
  turnAbility,
} from "./engine";
import { durationOf } from "./phases";

function scenario(): Match {
  const seat = (role: Match["seats"][string]["role"]) => ({
    role,
    alive: true,
    spent: false,
    guard: "",
    heal: true,
    poison: true,
    intel: [],
  });
  return {
    room: "fixture" as Id<"rooms">,
    phase: "night",
    turn: "pack",
    revision: 1,
    cycle: 1,
    end: 0,
    settings: defaultSettings,
    seats: {
      wolf: seat("wolf"),
      lone: seat("wolf"),
      guard: seat("guard"),
      hunter: seat("hunter"),
      seer: seat("seer"),
      witch: seat("witch"),
      villager: seat("villager"),
    },
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
  };
}

test("only the Little Girl learns about a wolf vote when a tied attack fails", () => {
  const match = scenario();
  match.seats.villager.role = "littleGirl";
  match.night = { wolf: "seer", lone: "hunter" };
  match.phase = advanceNight(match);
  expect(turnAbility(match, "villager")).toEqual({
    action: "peek",
    targets: ["wolf", "lone", "guard", "hunter", "seer", "witch"],
  });

  inspect(match, "villager", "seer");
  firstWindow(match);

  expect(match.attack).toBe("");
  expect(match.seats.villager.intel).toEqual(["1|seer|packVoted"]);
  expect(match.seats.seer.intel).toEqual([]);
});

test("the Little Girl ignores non-wolf actions targeting the observed player", () => {
  const match = scenario();
  match.seats.villager.role = "littleGirl";
  match.night = { wolf: "hunter", lone: "", guard: "seer" };

  inspect(match, "villager", "seer");

  expect(match.seats.villager.intel).toEqual(["1|seer|packDidNotVote"]);
});
test("protection blocks the pack attack and locks the previous target", () => {
  const match = scenario();
  match.night = { wolf: "seer", guard: "seer" };
  firstWindow(match);
  expect(match.attack).toBe("");
  expect(nightAbility(match, "guard")?.targets).not.toContain("seer");
});
test("tied wolves do not attack", () => {
  const match = scenario();
  match.night = { wolf: "seer", lone: "hunter" };
  firstWindow(match);
  expect(match.attack).toBe("");
});
test("the remedy preserves the target and the poisoned hunter can shoot", () => {
  const match = scenario();
  match.attack = "seer";
  match.heal = true;
  match.poison = "hunter";
  resolvePotions(match);
  expect(match.seats.seer.alive).toBe(true);
  expect(match.hunter).toBe("hunter");
  match.shot = "wolf";
  finishDeaths(match, "Verdict");
  expect(match.events[0].deaths).toEqual(["hunter", "wolf"]);
  expect(match.seats.witch.poison).toBe(false);
  expect(match.seats.witch.heal).toBe(false);
});
test("two fatal effects on one target produce one death", () => {
  const match = scenario();
  match.attack = "seer";
  match.poison = "seer";
  resolvePotions(match);
  expect(match.deaths).toEqual(["seer"]);
});
test("the custom observer detects a submitted action despite a tied attack", () => {
  const match = scenario();
  match.settings = {
    ...defaultSettings,
    mode: "workshop",
    replaced: ["seer"],
    custom: [
      {
        name: "Guetteur",
        flavor: "",
        target: "other",
        effect: "activity",
        uses: "once",
        avoidRepeat: false,
      },
    ],
  };
  match.seats.seer.role = "custom:0";
  match.night = { wolf: "seer", lone: "hunter", seer: "wolf" };
  firstWindow(match);
  expect(match.seats.seer.intel).toEqual(["1|wolf|active"]);
  expect(nightAbility(match, "seer")).toBeUndefined();
});

describe("turn-by-turn nights", () => {
  /** Plays every remaining slot of the night and returns the phases seen. */
  function playNight(match: Match) {
    const slots = [`${match.phase}:${match.turn}`];
    while (match.phase !== "dawn") {
      match.phase = advanceNight(match);
      slots.push(`${match.phase}:${match.turn ?? ""}`);
    }
    return slots;
  }

  test("runs every living role's slot in order, then the witch", () => {
    const match = scenario();
    match.phase = "intro";
    match.phase = nextNight(match);
    expect(playNight(match)).toEqual([
      "night:pack",
      "night:seer",
      "night:guard",
      "potions:witch",
      "dawn:",
    ]);
  });

  test("skips the slots of dead holders when roles are revealed on death", () => {
    const match = scenario();
    match.seats.seer.alive = false;
    match.seats.witch.alive = false;
    expect(playNight(match)).toEqual(["night:pack", "night:guard", "dawn:"]);
  });

  test("keeps the slots of dead holders in a hidden mode", () => {
    const match = scenario();
    match.settings = { ...defaultSettings, mode: "mystery" };
    match.seats.seer.alive = false;
    match.seats.witch.alive = false;
    expect(playNight(match)).toEqual([
      "night:pack",
      "night:seer",
      "night:guard",
      "potions:witch",
      "dawn:",
    ]);
  });

  test("a Workshop without reveal keeps slots, with reveal it skips them", () => {
    const hidden = scenario();
    hidden.settings = { ...defaultSettings, mode: "workshop", reveal: false };
    hidden.seats.seer.alive = false;
    const shown = scenario();
    shown.settings = { ...defaultSettings, mode: "workshop", reveal: true };
    shown.seats.seer.alive = false;
    expect(nightOrder(hidden)).toContain("seer");
    expect(nightOrder(shown)).not.toContain("seer");
  });

  test("a dead holder's slot is a short masked window in hidden modes only", () => {
    const match = scenario();
    match.settings = { ...defaultSettings, mode: "mystery" };
    match.seats.seer.alive = false;
    match.phase = "night";
    match.turn = "seer";
    expect(durationOf(match, () => 0)).toBe(maskedRange.min);
    expect(durationOf(match, () => 0.999)).toBe(maskedRange.max);
    match.turn = "guard";
    expect(durationOf(match)).toBe(turnSeconds("guard"));
    match.settings = defaultSettings;
    match.turn = "seer";
    expect(durationOf(match)).toBe(turnSeconds("seer"));
  });

  test("a hunter killed at night gets no night slot of his own", () => {
    const match = scenario();
    match.night = { wolf: "hunter", lone: "hunter" };
    expect(playNight(match)).toEqual([
      "night:pack",
      "night:seer",
      "night:guard",
      "potions:witch",
      "dawn:",
    ]);
  });

  test("a hunter killed at night is announced at dawn and keeps his shot pending", () => {
    const match = scenario();
    match.night = { wolf: "hunter", lone: "hunter" };
    playNight(match);
    expect(match.events.at(-1)?.deaths).toEqual(["hunter"]);
    expect(match.hunter).toBe("hunter");
  });

  test("the dawn shot adds its victim in a separate announcement", () => {
    const match = scenario();
    match.night = { wolf: "hunter", lone: "hunter" };
    playNight(match);
    match.shot = "wolf";
    finishDeaths(match, "Riposte du Chasseur");
    expect(match.events.at(-1)?.deaths).toEqual(["wolf"]);
    expect(match.hunter).toBe("");
  });

  test("without a hunter among the dead, the night is settled at dawn", () => {
    const match = scenario();
    match.night = { wolf: "seer", lone: "seer" };
    playNight(match);
    expect(match.hunter).toBe("");
  });

  test("the outcome waits for the dawn shot", () => {
    const match = scenario();
    match.seats.hunter.alive = false;
    match.hunter = "hunter";
    match.deaths = ["hunter"];
    match.phase = "potions";
    match.turn = "witch";
    for (const id of ["wolf", "lone"]) match.seats[id].alive = false;
    advanceNight(match);
    expect(match.outcome).toBeUndefined();
  });

  test("skips the potion slot when no witch was dealt", () => {
    const match = scenario();
    match.seats.witch.role = "villager";
    expect(playNight(match)).not.toContain("potions:witch");
  });

  test("only the current turn's holders can act", () => {
    const match = scenario();
    expect(turnAbility(match, "wolf")?.action).toBe("wolf");
    expect(turnAbility(match, "seer")).toBeUndefined();
    match.turn = "seer";
    expect(turnAbility(match, "seer")?.action).toBe("inspect");
    expect(turnAbility(match, "wolf")).toBeUndefined();
  });

  test("the seer learns the target's camp during her own turn", () => {
    const match = scenario();
    match.turn = "seer";
    inspect(match, "seer", "lone");
    expect(match.seats.seer.intel).toEqual(["1|lone|pack"]);
  });

  test("the pack's choice reaches the witch after the guard's protection", () => {
    const match = scenario();
    match.night = { wolf: "villager", lone: "villager" };
    match.phase = advanceNight(match);
    match.phase = advanceNight(match);
    match.night.guard = "villager";
    match.phase = advanceNight(match);
    expect(match.phase).toBe("potions");
    expect(match.attack).toBe("");
  });
});

describe("early advance completion", () => {
  test("the pack is done once every living wolf has a ballot or abstained", () => {
    const match = scenario();
    match.night = { wolf: "villager" };
    expect(isTurnComplete(match)).toBe(false);
    match.night.lone = "";
    expect(isTurnComplete(match)).toBe(true);
  });

  test("a dead wolf is not waited for", () => {
    const match = scenario();
    match.seats.lone.alive = false;
    match.night = { wolf: "villager" };
    expect(isTurnComplete(match)).toBe(true);
  });

  test("the seer is done after her immutable vision, even a pass", () => {
    const match = scenario();
    match.turn = "seer";
    expect(isTurnComplete(match)).toBe(false);
    inspect(match, "seer", "");
    expect(isTurnComplete(match)).toBe(true);
  });

  test("the guard is done once she chose or passed", () => {
    const match = scenario();
    match.turn = "guard";
    expect(isTurnComplete(match)).toBe(false);
    match.night.guard = "villager";
    expect(isTurnComplete(match)).toBe(true);
  });

  test("a dead holder never completes its own slot", () => {
    const match = scenario();
    match.turn = "seer";
    match.seats.seer.alive = false;
    expect(isTurnComplete(match)).toBe(false);
  });

  test("the witch needs an explicit confirmation", () => {
    const match = scenario();
    match.phase = "potions";
    match.turn = "witch";
    match.heal = true;
    expect(isTurnComplete(match)).toBe(false);
    match.done = true;
    expect(isTurnComplete(match)).toBe(true);
  });

  test("the hunter is done once he shot or passed", () => {
    const match = scenario();
    match.phase = "dayShot";
    match.hunter = "hunter";
    expect(isTurnComplete(match)).toBe(false);
    match.done = true;
    expect(isTurnComplete(match)).toBe(true);
  });

  test("a vote is done when every living voter has a ballot, abstaining included", () => {
    const match = scenario();
    match.phase = "vote";
    match.seats.villager.alive = false;
    match.votes = { wolf: "seer", lone: "", guard: "wolf", hunter: "wolf" };
    expect(isTurnComplete(match)).toBe(false);
    match.votes.seer = "wolf";
    match.votes.witch = "wolf";
    expect(isTurnComplete(match)).toBe(true);
  });

  test("debate, dawn and intro never complete early", () => {
    const match = scenario();
    for (const phase of ["debate", "dawn", "intro"] as const) {
      match.phase = phase;
      expect(isTurnComplete(match)).toBe(false);
    }
  });
});
