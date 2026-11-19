import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  choices,
  event,
  nightTurn,
  outcome,
  phase,
  role,
  settings,
} from "./validators";
export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    host: v.optional(v.id("players")),
    settings,
    match: v.optional(v.id("matches")),
    expires: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_expiry", ["expires"]),
  players: defineTable({
    room: v.id("rooms"),
    key: v.string(),
    name: v.string(),
    character: v.number(),
    ready: v.boolean(),
  })
    .index("by_room", ["room"])
    .index("by_seat", ["room", "key"]),
  positions: defineTable({
    room: v.id("rooms"),
    player: v.id("players"),
    x: v.number(),
    z: v.number(),
    yaw: v.number(),
    updated: v.number(),
  })
    .index("by_room", ["room"])
    .index("by_player", ["player"]),
  matches: defineTable({
    room: v.id("rooms"),
    phase,
    turn: v.optional(nightTurn),
    cycle: v.number(),
    revision: v.number(),
    end: v.number(),
    /** When the current phase or night slot began (epoch ms). */
    started: v.optional(v.number()),
    /** The witch validated her turn, or the hunter shot or passed. */
    done: v.optional(v.boolean()),
    settings,
    seats: v.record(
      v.string(),
      v.object({
        role,
        alive: v.boolean(),
        spent: v.boolean(),
        guard: v.string(),
        heal: v.boolean(),
        poison: v.boolean(),
        intel: v.array(v.string()),
      }),
    ),
    votes: choices,
    night: choices,
    runoff: v.array(v.string()),
    attack: v.string(),
    heal: v.boolean(),
    poison: v.string(),
    shot: v.string(),
    hunter: v.string(),
    deaths: v.array(v.string()),
    events: v.array(event),
    audit: v.array(event),
    outcome: v.optional(outcome),
    pauses: v.number(),
    remaining: v.optional(v.number()),
  }).index("by_room", ["room"]),
});
