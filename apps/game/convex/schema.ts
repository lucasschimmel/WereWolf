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
  tabPresenceReport,
} from "./validators";
export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    host: v.optional(v.id("players")),
    settings,
    match: v.optional(v.id("matches")),
    /** Practice room: the other seats are bots. `role` is the card the host asked for. */
    solo: v.optional(v.object({ role: v.optional(v.string()) })),
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
    lastChoice: v.optional(v.number()),
    /** Computer-controlled seat of a solo room. */
    bot: v.optional(v.boolean()),
    /** Last heartbeat from clients using the original presence protocol. */
    seen: v.optional(v.number()),
    tabs: v.optional(
      v.array(v.object({ ...tabPresenceReport, at: v.number() })),
    ),
  })
    .index("by_room", ["room"])
    .index("by_seat", ["room", "key"]),
  messages: defineTable({
    room: v.id("rooms"),
    match: v.optional(v.id("matches")),
    spirits: v.optional(v.literal(true)),
    author: v.id("players"),
    name: v.string(),
    text: v.string(),
  })
    .index("by_room_match", ["room", "match"])
    .index("by_room_match_spirits", ["room", "match", "spirits"])
    .index("by_author", ["author"]),
  positions: defineTable({
    room: v.id("rooms"),
    player: v.id("players"),
    scope: v.optional(v.string()),
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
        converted: v.optional(v.boolean()),
        knownPack: v.optional(v.array(v.string())),
        alive: v.boolean(),
        spent: v.boolean(),
        guard: v.string(),
        heal: v.boolean(),
        poison: v.boolean(),
        intel: v.array(v.string()),
      }),
    ),
    votes: choices,
    model: v.optional(v.string()),
    lovers: v.optional(v.array(v.string())),
    marks: v.optional(v.array(v.string())),
    ignited: v.optional(v.boolean()),
    infected: v.optional(v.boolean()),
    winner: v.optional(v.string()),
    mayor: v.optional(v.string()),
    night: choices,
    wolfPowers: v.optional(choices),
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
    /** Practice match: bots play and waiting phases are shortened. */
    solo: v.optional(v.boolean()),
    remaining: v.optional(v.number()),
  }).index("by_room", ["room"]),
});
