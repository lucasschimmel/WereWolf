import { v } from "convex/values";
export const presenceStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("disconnected"),
);
export const tabPresenceReport = {
  tab: v.string(),
  revision: v.number(),
  status: presenceStatus,
};
export const role = v.union(
  v.literal("villager"),
  v.literal("wolf"),
  v.literal("seer"),
  v.literal("littleGirl"),
  v.literal("guard"),
  v.literal("hunter"),
  v.literal("witch"),
  v.literal("jester"),
  v.literal("necromancer"),
  v.literal("arsonist"),
  v.literal("wildChild"),
  v.literal("cupid"),
  v.literal("whiteWolf"),
  v.literal("blackWolf"),
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
const specialRoleNumbers = {
  seer: v.optional(v.number()),
  guard: v.optional(v.number()),
  witch: v.optional(v.number()),
  hunter: v.optional(v.number()),
  littleGirl: v.optional(v.number()),
  jester: v.optional(v.number()),
  necromancer: v.optional(v.number()),
  arsonist: v.optional(v.number()),
  wildChild: v.optional(v.number()),
  cupid: v.optional(v.number()),
  whiteWolf: v.optional(v.number()),
  blackWolf: v.optional(v.number()),
};
export const settings = v.object({
  mode: v.union(
    v.literal("classic"),
    v.literal("express"),
    v.literal("mystery"),
    v.literal("chaos"),
    v.literal("workshop"),
    v.literal("custom"),
  ),
  reveal: v.boolean(),
  custom: v.array(custom),
  replaced: v.array(role),
  copies: v.optional(
    v.object({ wolf: v.optional(v.number()), ...specialRoleNumbers }),
  ),
  options: v.optional(
    v.object({
      wolves: v.optional(v.number()),
      timings: v.optional(
        v.object({
          intro: v.optional(v.number()),
          pack: v.optional(v.number()),
          night: v.optional(v.number()),
          dawn: v.optional(v.number()),
          mayorElection: v.optional(v.number()),
          debate: v.optional(v.number()),
          vote: v.optional(v.number()),
          runoff: v.optional(v.number()),
          mayorVerdict: v.optional(v.number()),
          shot: v.optional(v.number()),
        }),
      ),
      chances: v.optional(v.object(specialRoleNumbers)),
    }),
  ),
  roleOverrides: v.optional(
    v.object({
      seer: v.optional(v.boolean()),
      guard: v.optional(v.boolean()),
      witch: v.optional(v.boolean()),
      hunter: v.optional(v.boolean()),
      littleGirl: v.optional(v.boolean()),
      jester: v.optional(v.boolean()),
      necromancer: v.optional(v.boolean()),
      arsonist: v.optional(v.boolean()),
      wildChild: v.optional(v.boolean()),
      cupid: v.optional(v.boolean()),
      whiteWolf: v.optional(v.boolean()),
      blackWolf: v.optional(v.boolean()),
    }),
  ),
});
export const phase = v.union(
  v.literal("intro"),
  v.literal("night"),
  v.literal("potions"),
  v.literal("dawn"),
  v.literal("dawnShot"),
  v.literal("mayorElection"),
  v.literal("debate"),
  v.literal("vote"),
  v.literal("runoff"),
  v.literal("mayorVerdict"),
  v.literal("dayShot"),
  v.literal("ended"),
);
export const nightTurn = v.union(
  v.literal("pack"),
  v.literal("cupid"),
  v.literal("littleGirl"),
  v.literal("seer"),
  v.literal("guard"),
  v.literal("whiteWolf"),
  v.literal("arsonist"),
  v.literal("blackWolf"),
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
  mayor: v.optional(v.string()),
  deaths: v.optional(v.array(v.string())),
  votes: v.optional(choices),
});
export const choiceAction = v.union(
  v.literal("vote"),
  v.literal("electMayor"),
  v.literal("decideTie"),
  v.literal("shot"),
  v.literal("wolf"),
  v.literal("inspect"),
  v.literal("peek"),
  v.literal("protect"),
  v.literal("activity"),
  v.literal("heal"),
  v.literal("poison"),
  v.literal("done"),
  v.literal("model"),
  v.literal("link"),
  v.literal("douse"),
  v.literal("ignite"),
  v.literal("betray"),
  v.literal("infect"),
);
export const credentials = { code: v.string(), key: v.string() };
