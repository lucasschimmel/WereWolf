import { describe, expect, test } from "bun:test";
import {
  deckFor,
  defaultCustom,
  defaultSettings,
  minForMode,
  plurality,
  secondsFor,
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
    });
  }
  test("introduces the solitaire at the Chaos threshold", () => {
    const settings = { ...defaultSettings, mode: "chaos" as const };
    expect(() => deckFor(minForMode("chaos") - 1, settings)).toThrow();
    expect(deckFor(minForMode("chaos"), settings)).toContain("jester");
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
