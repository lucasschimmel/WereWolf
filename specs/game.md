# Game implementation

The game uses a single Convex deployment for room membership, server-authoritative rules and realtime projections. Each seat has a browser-generated private credential. Invite codes identify rooms and cannot authorize existing seats. The host seat is assigned at creation and stays fixed across disconnects and rematches.

The frontend keeps lobby and match projections separate from scene animation. Avatar movement is bounded and interpolated, and hidden during nighttime play. Shared rules define official cards, legal decks and phase deadlines. The server applies one scheduled transition per phase revision, and evaluates victory after all death effects.

The first-person scene and a keyboard-friendly roster both provide targeting. Players communicate on Discord. Workshop presets are saved in the host's browser.

## Verification

| Requirement                              | Verification                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legal decks for 8–15 and mode thresholds | `shared/rules.test.ts` covers all eight player counts, Express timing, and the Chaos threshold.                                                                                                        |
| Custom cards and composition limits      | `shared/rules.test.ts` covers replacements, protection limits, and preserved pack size. `convex/engine.test.ts` covers private action observation.                                                     |
| Night resolution                         | `convex/engine.test.ts` covers tied wolves, protection, heal and poison, deduplicated deaths, and the Hunter's riposte.                                                                                |
| Room access and privacy                  | Playwright smoke against the development deployment with two isolated browser sessions and six additional API seats. Verify an invalid session is rejected and only the host can configure and launch. |
| Scheduler and pause                      | Run a live eight-seat Express session through the first night, test protection, and pause the resulting debate as host.                                                                                |
