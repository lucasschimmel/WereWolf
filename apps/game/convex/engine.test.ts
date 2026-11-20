import { describe, expect, test } from "bun:test";
import { defaultSettings, maskedRange, turnSeconds } from "../shared/rules";
import type { Id } from "./_generated/dataModel";
import { spiritMatch } from "./chat";
import {
  advanceDayBallot,
  advanceNight,
  beginDebate,
  dawnRequiresResolution,
  dayAbility,
  finishDeaths,
  finishElection,
  firstWindow,
  inspect,
  isTurnComplete,
  kill,
  type Match,
  nextNight,
  nightAbility,
  nightOrder,
  resolvePotions,
  turnAbility,
} from "./engine";
import { durationOf } from "./phases";
import { igniteChoice, partnerOf, roleOf } from "./special";

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

test("the spirit channel admits announced dead players and a living Necromancer only at night", () => {
  const match = {
    ...scenario(),
    _id: "match" as Id<"matches">,
    _creationTime: 0,
  };
  match.seats.villager.role = "necromancer";
  match.settings = { ...defaultSettings, mode: "mystery" };
  for (let index = 0; index < 5; index++)
    match.seats[`guest${index}`] = { ...match.seats.guard };
  kill(match, ["seer"]);
  const access = (id: string) => spiritMatch(match, id as Id<"players">);

  expect(access("villager")).toBe(match._id);
  expect(access("seer")).toBeNull();
  finishDeaths(match, "À l’aube");
  expect(access("seer")).toBe(match._id);
  expect(access("hunter")).toBeNull();
  kill(match, ["villager"]);
  expect(access("seer")).toBe(match._id);
  expect(access("villager")).toBeNull();
  match.phase = "debate";
  expect(access("seer")).toBeNull();
});

test("the Wild Child converts only when the next night starts", () => {
  const match = scenario();
  match.seats.extra = { ...match.seats.villager, intel: [] };
  match.seats.villager.role = "wildChild";
  match.model = "guard";
  kill(match, ["guard"]);

  expect(roleOf(match, "villager")).toBe("wildChild");
  expect(nextNight(match)).toBe("night");
  expect(roleOf(match, "villager")).toBe("wolf");
  expect(nightAbility(match, "villager")?.action).toBe("wolf");
});

test("the Wild Child's conversion can bring the pack to parity", () => {
  const match = scenario();
  match.seats.villager.role = "wildChild";
  match.model = "guard";
  kill(match, ["guard"]);

  expect(nextNight(match)).toBe("ended");
  expect(match.outcome).toBe("pack");
});

test("Cupid's link is only exposed to the two completed recipients", () => {
  const match = scenario();
  match.lovers = ["seer"];
  expect(partnerOf(match, "seer")).toBeUndefined();

  match.lovers.push("wolf");
  expect(partnerOf(match, "seer")).toBe("wolf");
  expect(partnerOf(match, "wolf")).toBe("seer");
  expect(partnerOf(match, "hunter")).toBeUndefined();
  expect(roleOf(match, "seer")).toBe("seer");
});

test("a pack attack kills both lovers at dawn and the linked hunter can shoot", () => {
  const match = scenario();
  match.phase = "potions";
  match.turn = "witch";
  match.lovers = ["seer", "hunter"];
  match.attack = "seer";

  expect(advanceNight(match)).toBe("dawn");

  expect(match.events.at(-1)?.deaths).toEqual(["seer", "hunter"]);
  expect(dawnRequiresResolution(match)).toBe(true);
  expect(match.hunter).toBe("hunter");
});

test("the village verdict counts both lovers before checking for victory", () => {
  const match = scenario();
  match.phase = "vote";
  match.lovers = ["wolf", "lone"];
  match.votes = { villager: "lone" };

  expect(advanceDayBallot(match)).toBe("ended");

  expect(match.events.at(-1)?.deaths).toEqual(["lone", "wolf"]);
  expect(match.outcome).toBe("village");
});

test("the hunter's shot and its linked death are announced together", () => {
  const match = scenario();
  match.lovers = ["seer", "guard"];
  match.shot = "guard";

  finishDeaths(match, "Riposte du Chasseur");

  expect(match.events.at(-1)?.deaths).toEqual(["guard", "seer"]);
});

test("two lovers hit by separate attacks are each announced once", () => {
  const match = scenario();
  match.lovers = ["seer", "guard"];
  match.attack = "seer";
  match.poison = "guard";

  resolvePotions(match);

  expect(match.deaths).toEqual(["seer", "guard"]);
});

test("the Pyromane prepares targets one night and burns them on a later night", () => {
  const match = scenario();
  match.seats.villager.role = "arsonist";
  match.night.villager = "seer";
  resolvePotions(match);
  expect(match.seats.seer.alive).toBe(true);
  expect(match.marks).toEqual(["seer"]);

  nextNight(match);
  match.night.villager = igniteChoice;
  resolvePotions(match);
  expect(match.seats.seer.alive).toBe(false);
  expect(match.ignited).toBe(true);
});

test("the White Wolf can betray another wolf without replacing its pack vote", () => {
  const match = scenario();
  match.seats.wolf.role = "whiteWolf";
  match.night = { wolf: "guard", lone: "guard" };
  expect(turnAbility(match, "wolf")?.action).toBe("wolf");
  match.turn = "whiteWolf";
  expect(turnAbility(match, "wolf")?.targets).toEqual(["lone"]);

  match.wolfPowers = { wolf: "lone" };
  firstWindow(match);
  resolvePotions(match);
  expect(match.deaths.sort()).toEqual(["guard", "lone"]);
  expect(match.seats.wolf.spent).toBe(true);
});

test("the Black Wolf preserves its target and converts them when the attack lands", () => {
  const match = scenario();
  match.seats.wolf.role = "blackWolf";
  match.turn = "guard";
  match.night = { wolf: "seer", lone: "seer" };
  match.phase = advanceNight(match);
  expect(turnAbility(match, "wolf")).toEqual({
    action: "infect",
    targets: ["seer"],
  });
  match.wolfPowers = { wolf: "seer" };

  match.phase = advanceNight(match);
  advanceNight(match);
  expect(roleOf(match, "seer")).toBe("wolf");
  expect(match.seats.seer.alive).toBe(true);
  expect(match.infected).toBe(true);
});

test("the Witch's remedy prevents the Black Wolf from converting the target", () => {
  const match = scenario();
  match.seats.wolf.role = "blackWolf";
  match.attack = "seer";
  match.wolfPowers = { wolf: "seer" };
  match.heal = true;

  resolvePotions(match);
  expect(roleOf(match, "seer")).toBe("seer");
  expect(match.seats.seer.alive).toBe(true);
});

test("a surviving Pyromane prevents an early Village win and wins alone by seat", () => {
  const match = scenario();
  match.seats.villager.role = "arsonist";
  kill(match, ["wolf", "lone"]);
  finishDeaths(match, "Verdict");
  expect(match.outcome).toBeUndefined();

  kill(match, ["seer", "guard", "hunter", "witch"]);
  finishDeaths(match, "Verdict");
  expect(match.outcome).toBe("solo");
  expect(match.winner).toBe("villager");
});

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

test("living players elect a public mayor and replace them after their death", () => {
  const match = scenario();
  match.phase = beginDebate(match);
  expect(match.phase).toBe("mayorElection");
  match.votes = { seer: "seer", villager: "witch" };

  expect(finishElection(match, () => 0)).toBe("debate");
  expect(match.mayor).toBe("seer");
  expect(match.events[0].mayor).toBe("seer");
  expect(match.votes).toEqual({});
  expect(beginDebate(match)).toBe("debate");
  kill(match, ["seer"]);
  expect(beginDebate(match)).toBe("mayorElection");
});

test("only the mayor gets a verdict after a second tied ballot", () => {
  const match = scenario();
  match.phase = "vote";
  match.mayor = "seer";
  match.votes = { wolf: "hunter", lone: "wolf", witch: "guard" };

  match.phase = advanceDayBallot(match);
  expect(match.phase).toBe("runoff");
  expect(dayAbility(match, "seer")?.action).toBe("vote");
  match.votes = { wolf: "hunter", lone: "wolf" };
  match.phase = advanceDayBallot(match);

  expect(match.phase).toBe("mayorVerdict");
  expect(dayAbility(match, "seer")).toEqual({
    action: "decideTie",
    targets: ["hunter", "wolf"],
  });
  expect(dayAbility(match, "lone")).toBeUndefined();
});

test("the mayor's verdict triggers the hunter's retaliation", () => {
  const match = scenario();
  match.phase = "mayorVerdict";
  match.mayor = "seer";
  match.runoff = ["hunter", "wolf"];
  match.votes = { seer: "hunter" };

  expect(advanceDayBallot(match)).toBe("dayShot");
  expect(match.hunter).toBe("hunter");
  expect(match.seats.hunter.alive).toBe(false);
});

test("a mayor can pass and let the day end without a death", () => {
  const match = scenario();
  match.phase = "mayorVerdict";
  match.mayor = "seer";
  match.runoff = ["hunter", "wolf"];
  match.votes = { seer: "" };

  expect(advanceDayBallot(match)).toBe("night");
  expect(match.events.at(-1)?.deaths).toEqual([]);
});

test("a conclusive runoff eliminates its winner without asking the mayor", () => {
  const match = scenario();
  match.phase = "runoff";
  match.mayor = "seer";
  match.runoff = ["villager", "wolf"];
  match.votes = { seer: "wolf", guard: "wolf", wolf: "villager" };

  expect(advanceDayBallot(match)).toBe("night");
  expect(match.events.at(-1)?.deaths).toEqual(["wolf"]);
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

  test("a hidden multiplayer turn has the same duration with or without a living holder", () => {
    const match = scenario();
    match.settings = { ...defaultSettings, mode: "mystery" };
    match.seats.seer.alive = false;
    match.phase = "night";
    match.turn = "seer";
    expect(durationOf(match)).toBe(turnSeconds("seer"));
    match.seats.seer.alive = true;
    expect(durationOf(match)).toBe(turnSeconds("seer"));
  });

  test("keeps short empty turns in hidden solo practice only", () => {
    const match = scenario();
    match.settings = { ...defaultSettings, mode: "mystery" };
    match.solo = true;
    match.seats.seer.alive = false;
    match.turn = "seer";
    expect(durationOf(match, () => 0)).toBe(maskedRange.min);
    expect(durationOf(match, () => 0.999)).toBe(maskedRange.max);
  });

  test("preserves legacy night timings regardless of a private holder's status", () => {
    const match = scenario();
    match.settings = {
      ...defaultSettings,
      mode: "custom",
      reveal: false,
      options: { timings: { pack: 42, night: 33 } },
    };
    match.phase = "night";

    match.turn = "pack";
    expect(durationOf(match)).toBe(42);
    match.turn = "seer";
    expect(durationOf(match)).toBe(33);
    match.seats.seer.alive = false;
    expect(durationOf(match)).toBe(33);
  });

  test("uses the same dawn resolution whether a hidden victim is the hunter or a villager", () => {
    for (const target of ["hunter", "villager"]) {
      const match = scenario();
      match.settings = { ...defaultSettings, mode: "mystery" };
      for (let index = 0; index < 3; index++)
        match.seats[`guest${index}`] = { ...match.seats.villager };
      match.night = { wolf: target, lone: target };
      playNight(match);
      expect(match.events.at(-1)?.deaths).toEqual([target]);
      expect(dawnRequiresResolution(match)).toBe(true);
    }
  });

  test("does not expose whether a chance-based role was dealt through the night order", () => {
    const match = scenario();
    match.settings = {
      ...defaultSettings,
      mode: "custom",
      options: { chances: { cupid: 50 } },
    };
    for (let index = 0; index < 3; index++)
      match.seats[`guest${index}`] = { ...match.seats.villager };
    const order = nightOrder(match);
    expect(order).toContain("cupid");
    match.seats.guest0.role = "cupid";
    expect(nightOrder(match)).toEqual(order);
  });

  test("preserves the debate time of an existing solo match", () => {
    const match = scenario();
    match.settings = {
      ...defaultSettings,
      mode: "custom",
      options: { timings: { debate: 80 } },
    };
    match.phase = "debate";
    match.solo = true;

    expect(durationOf(match)).toBe(80);
  });

  test("waits for both living seers to make their own choice", () => {
    const match = scenario();
    match.seats.villager.role = "seer";
    match.turn = "seer";

    inspect(match, "seer", "wolf");
    expect(isTurnComplete(match)).toBe(false);

    inspect(match, "villager", "guard");
    expect(isTurnComplete(match)).toBe(true);
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
