import { describe, expect, test } from "bun:test";
import {
  cards,
  characters,
  customSettings,
  deckFor,
  defaultCustom,
  defaultSettings,
  earlyEndAt,
  freeCharacter,
  hiddenFloorSeconds,
  maskedRange,
  maskedSeconds,
  maxPlayers,
  minForMode,
  nightTurns,
  plurality,
  revealsOnDeath,
  secondsFor,
  turnSeconds,
  victory,
} from "./rules";

describe("official room settings", () => {
  for (let size = 8; size <= 15; size++) {
    test(`deals ${size} legal cards`, () => {
      const deck = deckFor(size, defaultSettings);
      expect(deck).toHaveLength(size);
      expect(deck.filter((role) => role === "wolf")).toHaveLength(
        size < 10 ? 2 : size < 14 ? 3 : 4,
      );
      expect(deck.includes("witch")).toBe(size >= 10);
      expect(deck.includes("hunter")).toBe(size >= 9);
      expect(deck).toContain("seer");
      expect(deck.filter((role) => role === "littleGirl")).toHaveLength(
        size === 10 || size === 11 ? 1 : 0,
      );
    });
  }
  test("introduces the solitaire at the Chaos threshold", () => {
    const settings = { ...defaultSettings, mode: "chaos" as const };
    expect(() => deckFor(minForMode("chaos") - 1, settings)).toThrow();
    expect(deckFor(minForMode("chaos"), settings)).toContain("jester");
  });
  test("ordinary roles are toggled independently and optional roles take villager seats", () => {
    const settings = {
      ...defaultSettings,
      roleOverrides: { seer: false, guard: true, cupid: true },
    };
    const deck = deckFor(12, settings);
    expect(deck).toHaveLength(12);
    expect(deck).toContain("cupid");
    expect(deck).toContain("guard");
    expect(deck).toContain("witch");
    expect(deck).not.toContain("seer");
  });

  test("a wolf variant uses one normal wolf seat", () => {
    const deck = deckFor(13, {
      ...defaultSettings,
      mode: "chaos",
      roleOverrides: { blackWolf: true },
    });
    expect(deck.filter((role) => role === "wolf")).toHaveLength(2);
    expect(deck).toContain("blackWolf");
    expect(deck).toContain("jester");
    expect(deck).toContain("arsonist");
  });
  test("shortens Express debates and preserves night lengths", () => {
    expect(secondsFor("debate", 10, "express")).toBeLessThan(
      secondsFor("debate", 10, "classic"),
    );
    expect(secondsFor("night", 10, "express")).toBe(
      secondsFor("night", 10, "classic"),
    );
  });
});
describe("custom room settings", () => {
  test("deals exact role quantities and fills new seats with villagers", () => {
    const settings = customSettings(true, { wolf: 2, seer: 2, guard: 0 });

    expect(deckFor(8, settings)).toEqual([
      "wolf",
      "wolf",
      "seer",
      "seer",
      "villager",
      "villager",
      "villager",
      "villager",
    ]);
    expect(deckFor(9, settings)).toEqual([...deckFor(8, settings), "villager"]);
  });

  test("rejects a selected card that becomes unavailable after someone leaves", () => {
    const settings = customSettings(true, { wolf: 2, blackWolf: 1 });
    expect(() => deckFor(11, settings)).toThrow("indisponible");
  });

  test("rejects incompatible pack variants", () => {
    const settings = customSettings(true, {
      wolf: 2,
      blackWolf: 1,
      whiteWolf: 1,
    });

    expect(() => deckFor(12, settings)).toThrow("variante");
  });

  test("rejects a room configuration whose pack would start at parity", () => {
    const settings = customSettings(true, { wolf: 4 });

    expect(() => deckFor(8, settings)).toThrow();
  });

  test("rejects second copies of cards with a shared action state", () => {
    const settings = customSettings(true, { wolf: 2, witch: 2 });

    expect(() => deckFor(10, settings)).toThrow("Sorcière");
  });

  test("carries guaranteed legacy cards into the fixed deck", () => {
    const deck = deckFor(12, {
      ...defaultSettings,
      mode: "custom",
      options: { wolves: 2, chances: { blackWolf: 100, cupid: 30 } },
    });

    expect(deck).toContain("blackWolf");
    expect(deck).not.toContain("cupid");
    expect(deck.filter((role) => role === "wolf")).toHaveLength(1);
  });
});
describe("night turns", () => {
  test("follow the dealt deck in a fixed order", () => {
    expect(nightTurns(deckFor(10, defaultSettings))).toEqual([
      "pack",
      "littleGirl",
      "seer",
    ]);
    expect(nightTurns(deckFor(8, defaultSettings))).toEqual([
      "pack",
      "seer",
      "guard",
    ]);
  });
  test("give the pack the longest slot", () => {
    expect(turnSeconds("pack")).toBeGreaterThan(turnSeconds("seer"));
  });
});
describe("Workshop decks", () => {
  const protection = {
    ...defaultCustom,
    effect: "protect" as const,
    name: "Braises",
  };
  test("allows replacing a protector with a custom protection", () => {
    expect(
      deckFor(8, {
        ...defaultSettings,
        mode: "workshop",
        custom: [protection],
        replaced: ["guard"],
      }),
    ).toContain("custom:0");
  });
  test("rejects two protections", () => {
    expect(() =>
      deckFor(8, {
        ...defaultSettings,
        mode: "workshop",
        custom: [protection],
        replaced: ["villager"],
      }),
    ).toThrow("protection");
  });
  test("preserves wolf seats", () => {
    expect(() =>
      deckFor(8, {
        ...defaultSettings,
        mode: "workshop",
        custom: [protection],
        replaced: ["wolf"],
      }),
    ).toThrow("remplacée");
  });
  test("keeps existing two-villager replacements legal at ten players", () => {
    const deck = deckFor(10, {
      ...defaultSettings,
      mode: "workshop",
      custom: [
        { ...defaultCustom, name: "Témoin" },
        { ...defaultCustom, name: "Pisteur" },
      ],
      replaced: ["villager", "villager"],
    });

    expect(deck).toContain("littleGirl");
    expect(deck).toContain("villager");
    expect(deck).toContain("custom:1");
  });
});
describe("night timing helpers", () => {
  test("reveals roles on death except in Mystery and hidden Workshop", () => {
    expect(revealsOnDeath(defaultSettings)).toBe(true);
    expect(revealsOnDeath({ ...defaultSettings, mode: "mystery" })).toBe(false);
    expect(
      revealsOnDeath({ ...defaultSettings, mode: "workshop", reveal: false }),
    ).toBe(false);
    expect(
      revealsOnDeath({ ...defaultSettings, mode: "workshop", reveal: true }),
    ).toBe(true);
  });
  test("picks masked windows within the allowed range", () => {
    expect(maskedSeconds(() => 0)).toBe(maskedRange.min);
    expect(maskedSeconds(() => 0.9999)).toBe(maskedRange.max);
  });
  test("ends a finished slot after the grace, never past its deadline", () => {
    const slot = {
      now: 10_000,
      started: 0,
      deadline: 20_000,
      graceSeconds: 3,
      floorSeconds: 0,
    };
    expect(earlyEndAt(slot)).toBe(13_000);
    expect(earlyEndAt({ ...slot, now: 19_000 })).toBe(20_000);
  });
  test("holds a fast slot up to the floor in hidden modes", () => {
    expect(
      earlyEndAt({
        now: 1_000,
        started: 0,
        deadline: 20_000,
        graceSeconds: 2,
        floorSeconds: hiddenFloorSeconds,
      }),
    ).toBe(hiddenFloorSeconds * 1000);
  });
});
test("plurality keeps both tied candidates but discards abstention", () => {
  expect(plurality({ alice: "bob", bob: "alice", chris: "" })).toEqual([
    "bob",
    "alice",
  ]);
  expect(plurality({ alice: "" })).toEqual([]);
});
test("the pack wins when it reaches parity including the solitaire", () => {
  expect(victory(["pack", "pack", "village", "solo"])).toBe("pack");
  expect(victory(["pack", "village", "solo"])).toBeUndefined();
});
test("an empty village ends in a draw", () => {
  expect(victory([])).toBe("draw");
});

describe("professions", () => {
  test("there is one distinct profession for every seat", () => {
    const names = new Set(characters.map(({ name }) => name));
    const colors = new Set(characters.map(({ color }) => color));
    expect(characters.length).toBeGreaterThanOrEqual(maxPlayers);
    expect(names.size).toBe(characters.length);
    expect(colors.size).toBe(characters.length);
  });

  test("no profession shares its name with a card", () => {
    const strip = (name: string) =>
      name.replace(/^(Le |La |L’)/, "").toLowerCase();
    const cardNames = Object.values(cards).map(({ name }) => strip(name));
    const clashes = characters.filter(({ name }) =>
      cardNames.includes(strip(name)),
    );
    expect(clashes).toEqual([]);
  });

  test("keeps the preferred profession when nobody wears it", () => {
    expect(freeCharacter([1, 2], 4)).toBe(4);
  });

  test("moves on to the next free profession when the preferred is taken", () => {
    expect(freeCharacter([4, 5], 4)).toBe(6);
  });

  test("wraps around the list to find a free profession", () => {
    const last = characters.length - 1;
    expect(freeCharacter([last], last)).toBe(0);
  });

  test("finds the only free profession at an almost full table", () => {
    const taken = characters
      .map((_, index) => index)
      .filter((index) => index !== 9);
    expect(freeCharacter(taken, 0)).toBe(9);
  });
});
