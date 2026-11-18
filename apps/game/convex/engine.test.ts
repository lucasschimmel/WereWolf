import { expect, test } from "bun:test";
import { defaultSettings } from "../shared/rules";
import type { Id } from "./_generated/dataModel";
import {
  finishDeaths,
  firstWindow,
  type Match,
  nightAbility,
  resolvePotions,
} from "./engine";

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
