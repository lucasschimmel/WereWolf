# Game implementation

The game uses a single Convex deployment for room membership, server-authoritative rules and realtime projections. Each seat has a browser-generated private credential. Invite codes identify rooms and cannot authorize existing seats. The host seat is assigned at creation and stays fixed across disconnects and rematches.

The frontend keeps lobby and match projections separate from scene animation. Avatar movement is bounded and interpolated, and hidden during nighttime play.

Convex authorizes and distributes movement during the lobby, introduction and debate. An active match limits participation to living seats. Each movement command and stored pose belongs to the current movement window. Expired windows return no positions. The client disconnects its subscription and discards interpolation state when the window closes. The former WebSocket worker is disabled and stops traffic from old sockets when they wake.

## Night turns

A night is a sequence of turns. Custom games with chance-based roles schedule every possible action slot. Revealing modes may skip publicly eliminated holders. Hidden modes retain the slots. Each private multiplayer turn and retaliation uses its full public duration, independently of choices and holder status. Solo practice can still end turns early. The server binds choices to the match, cycle, phase and turn, and validates seat privileges, action, target and deadline. Public daytime ballots keep their early closing rule.

## Mayor

The first debate opens with a public election among living players. Each living player can vote once, including for themselves, or abstain. The candidate with the most votes wins, with a random draw among tied leaders. If nobody votes, the office stays vacant until the next debate. The village holds a new election at the next debate after the mayor dies. If an elimination runoff ties again, the living mayor may pick one of the remaining tied candidates or pass within 15 seconds. A pass or timeout leaves everyone alive. A mayoral elimination uses the usual daytime verdict rules.

## Optional roles

The host can toggle eligible roles in the lobby. Optional cards fill Villager seats, while the White Wolf and Black Wolf take one existing wolf seat. Only one of the Wild Child, White Wolf and Black Wolf can be enabled together. Mystery enables the Necromancer at 12 players, and Chaos enables Cupid at 12 players and the Arsonist at 13 players. The other new roles are opt-in.

The living Necromancer sees announced dead players as ghosts at night. If the public room settings can include the Necromancer, announced dead seats can access the spirit channel at night even when the role is absent or eliminated. The living Necromancer can join them. In hidden-role modes, eliminated players see a generic Necromancer label for messages from that role.

Cupid links two other living players privately on the first night without changing their victory conditions. When either linked player dies, their partner dies in the same resolution. The Wild Child chooses a model during distribution and joins the pack when the next night starts after that model dies. The White Wolf votes with the pack, can kill another wolf once, and wins alone. The Black Wolf can convert the pack's unprotected target once, subject to the Witch's remedy. The Arsonist can mark up to two other players and ignite the living marked players once on a later night. The White Wolf and Arsonist win only as the last survivor and do not inherit the Jester's victory.

## Solo practice

`rooms.createSolo` opens a room flagged `solo`, with the host and bot seats (`players.bot`, random unguessable keys, named from a fixed list) padded up to the mode's minimum. In the lobby the host sets the table size (`rooms.soloSetup`, up to 15) and may ask for a card; at `rooms.start` that card is swapped into the host's seat if the dealt deck holds it. Readiness is not required and nobody can join a solo room. The match carries `solo: true`: debates are capped at 45 s, the host can skip intro, dawn and debate (`game.skip`), and every new phase schedules `bots.play` after a random 1.5–5 s. Bots act through the same `applyChoice` (`convex/choices.ts`) as human seats, so they obey the same rules; `decide` (`convex/bots.ts`) is deliberately simple (wolves hunt villagers, a seer's bot trusts its visions, the witch heals most nights, everyone else votes at random). During debates a bot posts a short remark every few seconds. The client shows a coach (`src/rooms/coach.ts`) with advice for the current action, and a "How to play" drawer (`src/ui/Guide.tsx`) is reachable from the village square and from every room.

## Interface

The scenery is one of four maps (`src/scene/maps`: `hamlet`, `island`, `glade`, `pass`), each its own lazily imported chunk. `mapFor(room.code)` hashes the room code into a map and a seed, so every client derives the same choice and the server stores nothing; the hub draws one per visit. All maps share the walkable square, the seat ring and a low centrepiece, so movement bounds and seat poses stay map-independent. A map builds 15 homes and 15 gap props once; `arrange(world, players)` (`maps/ring.ts`) shows one home per player between two seats, widens the ring from 15 m to 16.75 m and hides props that no longer fit. Trees, ground cover and distant scenery load in deferred batches and use instancing with per-sector culling and two levels of detail. `?map=<id>` and `?seats=<n>` force a map and a head count for review.

Players land on a private village square. The public roster provides nicknames and announced deaths. At night, the server separately lists the avatars the viewer may instantiate for the current action, along with authorized awake pack members and ghosts. Candidates are static silhouettes. Only living pack participants on their shared turn receive partner aims. Public votes and keyboard targeting keep their normal behavior. If WebGL is unavailable, the scene falls back to target buttons. Workshop presets are saved in the host browser.

## Text chat

The chat drawer uses a reactive Convex query scoped to the authenticated room seat. The lobby and match share the same thread, which displays the 100 most recent messages. All seats can read it. Posting is available in the lobby and to living players during the daytime phases of an active match. Convex validates posting permissions, derives the author's name from the seat and limits posts to one message per second per seat. The thread is removed when the room expires.

The eliminated players' thread is private to seats whose death has been publicly announced in the current match. Convex checks that condition before returning the thread or accepting a post. Eliminated players can talk at night and after the result. The thread is removed when the host reopens the lobby or the room expires.

## Verification

| Requirement                              | Verification                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal decks for 8–15 and mode thresholds | `shared/rules.test.ts` covers all eight player counts, Express timing, the Chaos threshold, and the night turn order.                                                                                                                                                                                                       |
| Custom cards and composition limits      | `shared/rules.test.ts` covers replacements, protection limits, and preserved pack size. `convex/engine.test.ts` covers private action observation.                                                                                                                                                                          |
| Night resolution                         | `convex/engine.test.ts` covers the turn sequence, skipped dead-holder turns, equal hidden-role windows, masked retaliation phases, early-advance completion (`isTurnComplete`), turn-gated abilities, the seer's immediate vision, tied wolves, protection, heal and poison, deduplicated deaths, and the Hunter's riposte. |
| Solo bots                                | `convex/bots.test.ts` covers legal bot moves: wolves spare the pack, no repeated turn, seer memory, witch potions, hunter shot, Cupid's two links and mayor votes.                                                                                                                                                          |
| Room access and privacy                  | Playwright smoke against the development deployment with two isolated browser sessions and six additional API seats. Verify an invalid session is rejected and only the host can configure and launch.                                                                                                                      |
| Scheduler and pause                      | Run a live eight-seat Express session through the first night with `bun run playtest`, step through every turn with `next`, test protection, and pause the resulting debate as host.                                                                                                                                        |
