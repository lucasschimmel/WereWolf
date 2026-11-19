import { v } from "convex/values";
export const role = v.union(
  v.literal("villager"),
  v.literal("wolf"),
  v.literal("seer"),
  v.literal("guard"),
  v.literal("hunter"),
  v.literal("witch"),
  v.literal("jester"),
  v.literal("custom:0"),
  v.literal("custom:1"),
);
export const custom = v.object({
  name: v.string(),
  flavor: v.string(),
  effect: v.union(
    v.literal("camp"),
    v.literal("protect"),
    v.literal("activity"),
  ),
  target: v.union(v.literal("self"), v.literal("other"), v.literal("any")),
  uses: v.union(v.literal("first"), v.literal("once"), v.literal("repeat")),
  avoidRepeat: v.boolean(),
});
export const settings = v.object({
  mode: v.union(
    v.literal("classic"),
    v.literal("express"),
    v.literal("mystery"),
    v.literal("chaos"),
    v.literal("workshop"),
  ),
  reveal: v.boolean(),
  custom: v.array(custom),
  replaced: v.array(role),
});
export const phase = v.union(
  v.literal("intro"),
  v.literal("night"),
  v.literal("potions"),
  v.literal("dawn"),
  v.literal("dawnShot"),
  v.literal("debate"),
  v.literal("vote"),
  v.literal("runoff"),
  v.literal("dayShot"),
  v.literal("ended"),
);
export const nightTurn = v.union(
  v.literal("pack"),
  v.literal("seer"),
  v.literal("guard"),
  v.literal("custom:0"),
  v.literal("custom:1"),
  v.literal("witch"),
);
export const outcome = v.union(
  v.literal("village"),
  v.literal("pack"),
  v.literal("solo"),
  v.literal("draw"),
);
export const choices = v.record(v.string(), v.string());
export const event = v.object({
  cycle: v.number(),
  label: v.string(),
  deaths: v.optional(v.array(v.string())),
  votes: v.optional(choices),
});
export const credentials = { code: v.string(), key: v.string() };
