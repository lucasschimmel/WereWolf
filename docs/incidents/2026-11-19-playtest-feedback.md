# Incident report — first multiplayer playtest (2026-11-19)

| | |
| --- | --- |
| Status | Open — investigation only, **no code was changed** |
| Branch / commit | `feat/tcg-redesign` (working tree on top of `da33ae7`) |
| Source | Manual playtest by the maintainer, 6 findings (listed below) |
| Method | Static code reading of `apps/game/{convex,shared,src}`, `specs/game.md`, `GDD.md`. Nothing was reproduced live, so every latency figure is an **estimate from the code**, to be confirmed with the measurements in the last section. |

## Summary

| # | Finding | Type | Severity | Root cause confirmed in code? |
| --- | --- | --- | --- | --- |
| 1 | Mobile version needs a deep rework | UX / layout | High | Yes (partly) — desktop-first input and HUD |
| 2a | Remote players move with a strange delay and poor fluidity | Realtime / perf | High | Yes — architecture, plus a stale-final-position bug |
| 2b | Votes: others cannot see who each player points at before the timer ends | Missing feature / design | Medium | Yes — votes are never sent to clients |
| 3 | Role cards are not pretty | Visual design | Medium | Subjective, with concrete causes |
| 4 | Dead roles still get their night turn | Rules vs. expectation | Medium | Yes — **intentional by design** (anti-leak) |
| 5 | A role's turn waits for the timer even after the player acted | Missing feature | High | Yes — phases only advance by scheduler |
| 6 | Hunter gets a turn every night, but acts only on death | Rules vs. expectation | Medium | Yes — **same intentional mechanism as 4** |

Findings 4, 5 and 6 share one mechanism (the fixed-length public night) and must be solved together. Findings 2a and 2b look similar but have different causes: 2a is a transport problem, 2b is a data-exposure decision.

---

## 1. Mobile version needs a deep rework

### What the code shows

- **A single breakpoint.** `style.css` has one responsive block, `@media (max-width: 760px)` (`style.css:1502`, about 80 lines). There is no rule for landscape or short screens, no `(pointer: coarse)` / `(hover: none)` styling. Touch is only detected in JS (`useCoarse`), and only to enable the joystick and the native share sheet.
- **Instructions are written for a mouse.** `hud.ts:16-22` tells the player "clique · clic droit pour t'abstenir". The pass button prints `· clic droit` (`Room.tsx:435`). The settings legend lists ZQSD and Tab/Enter. On touch, "pass" is a 650 ms long press (`input.ts:153`) that nothing advertises.
- **Targeting is hover-then-click.** The design says "hover to aim, click to choose" (`specs/game.md:13`). A phone has no hover, so every pick is a blind tap raycast on small 3D puppets (`stage.ts` `tap` → `cast.pick`). Look and tap share one gesture surface (drag = look, tap = pick, with a 6/8 px travel threshold), which is fragile on a small, moving screen.
- **An accessible fallback already exists but is unused on mobile.** `Village.tsx:48-75` renders plain target buttons, but only when WebGL fails. It is the natural base for a mobile "pick from a list" sheet.
- **Bottom-of-screen collisions.** On narrow screens the following compete for the same area: the mini role card `.hand` (bottom-left), the `.joystick` (`bottom + 150px`, left), the centred `.pass` chip, `.side.right`, the vote/witch overlays and the toasts. The top is also crowded: code chip, four icon buttons, then the `.status` panel pushed to `top: 68px` with wrapping step chips. On a ~390 px high landscape phone there is almost no 3D viewport left.
- **Card sizing.** `.tcg` scales with `font-size: calc(16px * var(--s))`. `tcg-hand` (`--s: .5`) and `tcg-mini` (`--s: .34`) render body text at about 7 px or less. Only `.turn-card` and `.reveal-card` get a mobile override.
- **Performance on phones is unverified.** `quality.ts` has a tier governor (auto-low on coarse pointer with ≤ 4 cores) which is a good sign, but nothing was measured. Each remote position update also re-renders the whole `RoomContent` (see 2a), which costs main-thread time on phones.
- **No mobile test coverage.** The repository has no Playwright config or dependency (`specs/game.md:22` mentions a smoke test, but it is not in the repo), and no viewport matrix.

### Likely causes

The HUD, controls and copy were designed desktop-first and then squeezed with one breakpoint. Interaction (hover/right-click/keyboard) is the real gap, not just spacing.

### Leads for correction

1. Define a mobile interaction model first: bottom-sheet target picker (reuse `fallback-targets`), explicit "Pass" button, tap-to-confirm instead of hover-aim, larger hit radius for puppets.
2. Split HUD layouts by capability (`(pointer: coarse)`, `(orientation: landscape) and (max-height: 500px)`), not only by width. Define a safe "play zone" and stack controls in a bottom dock.
3. Make copy input-aware (`hud.ts` `instructions` / `passLabels` keyed by pointer type).
4. Rework card scaling for small sizes (see 3).
5. Add a Playwright viewport matrix (360×640, 390×844, 844×390, 768×1024) with screenshots at each phase.
6. Test on a mid-range Android (the real low end) and profile frame time; decide whether the post-processing/bloom pass should be off by default on coarse pointers.

---

## 2a. Replication of other players' movement is laggy and choppy

### Pipeline today

```
client frame (≥200 ms apart, only if moved)        stage.ts:333  report()
  → mutation game.move (5 Hz max)                  Room.tsx:194
     server: access() = 2 reads, match get, positions by_player, then patch   game.ts:249
     silently drops the write if < 125 ms since the previous one              game.ts:271
  → table `positions` (persistent DB row per player)
  → query game.positions: collect() of ALL rows of the room   game.ts:234
     re-runs and re-sends the full list to EVERY client on ANY row change
  → React state → whole RoomContent re-renders → useMemo scene → Village effect → Stage.setState
  → puppet.update(..., "glide"): exponential chase, k = 1 - exp(-7·dt)   puppets.ts:507
```

### Why it feels bad (ordered by likely impact)

1. **Ephemeral data goes through a transactional database.** Position is throw-away, high-frequency data. Each update is a full Convex mutation (auth lookups, an OCC transaction, a durable write), followed by query invalidation and re-execution. This path was built for state, not for a 5–20 Hz stream.
2. **Quadratic fan-out.** Every position write invalidates `game.positions` for all N subscribers, and each re-run re-reads and re-sends all N rows. With N = 12 moving players: ~60 writes/s → ~720 query executions/s and 720 pushes/s per room. Latency grows with room size.
3. **Receiver smoothing adds lag and steps.** Updates arrive at ≤ 5 Hz as discrete targets, and the puppet chases each with an exponential filter of ~140 ms time constant (about 430 ms to reach 95 %). There is no timestamp, no velocity, no snapshot buffer and no extrapolation, so motion is staircase-then-rubber-band. The `updated` field is stored but never used on the client.
4. **Rough latency budget (estimate):** send throttle 0–200 ms + uplink + mutation + invalidation + downlink (≈ 100–300 ms on a typical connection) + smoothing 150–430 ms ≈ **0.5–0.9 s** behind real time. That matches "délai très étrange".
5. **Whole-UI re-render on every update.** `positions` is held in React state inside `RoomContent` (`Room.tsx:132`, `:232`). Each push re-renders the HUD, status, herald and overlays, then runs `Stage.setState`. This steals frame time, especially on phones, and degrades the 3D framerate on top of the network delay.
6. **Possible head-of-line blocking (hypothesis).** `onMove` fires mutations without awaiting them. Convex executes a client's mutations in order, so a slow round trip should queue later position updates behind it and make the delay grow. To verify.

### Confirmed bug: the last position can be lost

The server silently `return`s when two updates arrive less than 125 ms apart (`game.ts:271`). The client has already stored `lastSent` (`stage.ts:341`) and will not resend while the player stands still (`changed` is false). If jitter or bursting makes the final report arrive too soon after the previous one, the player stops and **remote clients keep an out-of-date position** (up to roughly one step, ≈ 0.7 m) until the player moves again. Probability is moderate on mobile networks. The fix is on the client (always send a final "at rest" report) and/or the server (do not drop, keep the latest).

### Leads for correction

**Tier 1 — stay on Convex, cheap, probably a large improvement:**

- Add a client timestamp and velocity/heading to each report; on the receiver keep a short buffer and interpolate between snapshots with a fixed render delay of ~100–150 ms (classic entity interpolation), with capped extrapolation.
- Always send a forced final report when input stops; stop dropping updates server-side.
- Make `move` cheaper: authenticate by player id + key with one read, drop the `match` read (store a "free movement" flag on the room or position row).
- Move positions out of React state: push them into a store / ref read by the render loop, so network updates do not re-render the UI.
- Reduce fan-out: only send others' positions (the query still invalidates on any row write, so this alone does not fix the quadratic cost).

**Tier 2 — a dedicated ephemeral channel (recommended if Tier 1 is not enough, and as the long-term target):**

- A small WebSocket room service for position and live aim only, at 10–15 Hz, broadcasting compact snapshots, with Convex remaining the authority for rules, phases and votes. Candidate hosts: PartyKit / Cloudflare Durable Objects, Colyseus, Liveblocks presence, Ably, or a minimal Bun/uWS relay. Identity: Convex mints a short-lived signed token per seat; the relay verifies it.
- **About Redis:** on its own it does not fix this. Browsers cannot subscribe to Redis, so a WebSocket gateway is needed anyway; Redis only helps when several gateway instances must share rooms. For a single relay per room, it is unnecessary. WebRTC mesh is not advised for 8–15 players (up to ~100 connections, NAT issues).
- Keep position transient (no DB persistence); late joiners just receive the current snapshot.

Verify with the measurements below before choosing a tier.

### Resolution status

Implemented: Tier 1 and Tier 2 together, Convex kept as fallback.

- **Transport:** `apps/relay`, a Cloudflare Worker with one Durable Object per room (WebSocket hibernation). Convex signs a short-lived HMAC seat ticket (`game.ticket`, `shared/ticket.ts`). The relay verifies it, fans out poses at up to 15 Hz, never echoes to the sender, keeps nothing on disk, and sends a snapshot to late joiners. No Redis: a single relay per room does not need it.
- **Receiver:** `shared/motion.ts` buffers stamped snapshots per player and renders 120 ms in the past with capped extrapolation. Remote puppets follow the interpolated pose exactly (`track` mode) instead of the 140 ms exponential chase.
- **React:** positions no longer live in React state. `src/net/motion.ts` feeds the 3D loop directly, so movement no longer re-renders `RoomContent`.
- **Lost final position:** fixed. The server drop window is now 50 ms (clients send at most every 66 or 200 ms), and the client keeps reporting until its last pose is sent.
- **Fallback:** without `VITE_RELAY_URL`, without `RELAY_SECRET` on Convex, or after four failed connections (4 s connect timeout each), movement goes through Convex at 5 Hz with a 260 ms render delay.

Verified: unit tests for interpolation and tickets; a local relay smoke test (fan-out, no echo, invalid frames dropped, late-joiner snapshot, wrong secret and wrong room rejected with 401); a browser session plus a scripted bot circling the well through the relay. Not yet done: the latency and per-device measurements below, a real multi-device session, and a production deployment of the relay.

---

## 2b. Others' vote targets are not visible before the timer ends

### What the code shows

- Votes live in `matches.votes` (`schema.ts:61`). The `game.view` query returns only the viewer's own choice (`selected`, `game.ts:87-88`). Nobody else's ballot reaches the client until the phase closes and the `events` journal entry is published (`phases.ts:58-64`, then `revealVotes` plays in `stage.ts:457`).
- The **rendering side already exists.** `Room.tsx:224-228` builds `aims` for the wolf pack, and `cast.ts:188-202` makes any member whose id appears in `aims` point at the target (arm gesture, and head turn when seated). It is simply only fed for night wolves.
- The server-side change is small (expose `votes` during `vote`/`runoff` to living players, then pass them as `aims`). The cost is acceptable: votes change rarely, so Convex is the right transport and this does **not** depend on finding 2a.

### Decision needed before building

Live public ballots change the game: they create bandwagon effects and let the last voters react. The current docs imply secrecy until the reveal. Options:

1. Fully public live pointing (what the maintainer asked for; closest to real-life "raise your hand").
2. Public live pointing, but frozen/hidden during the last N seconds.
3. Live anonymous tally only (who is leading, not who voted).
4. Same as (1) for `vote`, but keep `runoff` and hunter shots private.

Also decide whether abstentions are shown, and whether the Express mode (20 s) should differ. Update `specs/game.md` accordingly (the audit and ballot journal currently assume reveal at the end).

### Resolution status

Implemented (option 1, fully public live pointing). `game.view` now returns `match.ballots` (living voters' non-empty targets) during `vote` and `runoff` only, and `undefined` in every other phase, so night actions never leak. `Room.tsx` feeds `aims` from `ballots` in those phases (the viewer's own aim still comes from `selected`) and keeps the wolf pack's aims at night. Abstentions are not shown, and Express mode behaves the same. `cast.ts` already handles missing or hidden targets safely, so it was not changed. `specs/game.md` is updated. Not yet verified in a live multi-player session.

---

## 3. Role cards are not pretty

### What the code shows (`ui/cards.tsx`, `style.css:710-884`)

- One identical template for every role. Only five colours change (`themes`), so roles do not feel distinct. Camp (village / pack / solo) is a tiny gem, not a visual language.
- Art is hand-coded flat SVG (264×176 viewBox) made of basic circles and paths, shown in a window that is only ~42 % of the card height (`11em` of `26.25em`).
- A large flat cream text box (`#f3ebdd`) sits under dark frames, giving an app-widget look rather than a tarot / TCG look. No ornate frame, no foil/sheen, no depth or lighting, no rarity.
- Text is small and dense; in hand/mini sizes it is unreadable (see finding 1).
- `timing` labels the Hunter "À sa mort", which clashes with the Hunter's current night slot (finding 6).

### Leads for correction

1. Settle an art direction first (tarot, woodcut, paper-cutout/puppet-theatre to match the 3D scene) and test it on 3 roles before drawing all 7 plus custom cards.
2. Full-bleed illustration (60–70 % of the card, text over a gradient) with higher-quality art (commissioned or generated raster/vector).
3. Camp-based frame families plus a per-role accent; ornate border as SVG 9-slice.
4. Interaction polish: pointer/gyro tilt, subtle holographic sheen, flip animation on the reveal, a proper card back.
5. Typography: a serif display face with small caps; limit body text to one line of power and one of flavour.
6. Define separate compact layouts for hand/mini sizes instead of scaling the full card.

---

## 4. Dead roles still get their night turn

### What the code shows

- `advanceNight` walks `deckTurns(match)`, which is built from the roles **dealt**, not the roles **alive** (`engine.ts:22-23`, `109-133`). A dead seer's turn lasts the full `turnSeconds` (20 s). Same for the guard, custom cards, the witch (`potions`) and the hunter (`nightShot`).
- This is **deliberate**, and written down: `rules.ts:210-215` ("so the timing never reveals which roles are still alive") and `specs/game.md:9` ("the timing reveals nothing beyond the public deck"). `engine.test.ts` has a test for "slots kept for dead holders".
- `matches.turn` is public and the HUD lists every dealt slot (`hud.ts` `nightSteps`).

So this is a conflict between a design decision (information security) and the observed experience (dead time), not a bug.

### Why it matters

With 10+ players a night can include pack 30 s + seer 20 s + witch 20 s + hunter 15 s = 85 s, often mostly idle once roles have died.

### Key insight for the fix: the leak only exists in some modes

`game.view` already reveals the role of dead players in Classic, Express, Chaos and Workshop-with-reveal (`game.ts:26-33`). In those modes a skipped dead role leaks nothing new. Masking only matters in **Mystery** and **Workshop without reveal**, where roles are not shown on death.

### Leads for correction

- **Policy A (recommended):** skip turns whose holder is dead when the mode already reveals roles on death. In Mystery / hidden-Workshop, keep a masked turn but short and non-fixed (see 5).
- **Policy B:** a uniform short "phantom" window for every dead/absent role (for example 4–8 s, randomised server-side), so a dead role looks like a quick-deciding live one. Cheaper than the full 20 s and still hides the state.
- **Policy C:** keep today's behaviour as an opt-in "strict secrecy" setting.
- Update `rules.ts` comment, `specs/game.md`, the `nightSteps` HUD (do not list skipped slots, or grey them out) and `engine.test.ts`.

---

## 5. A turn waits for its timer even when the player already chose

### What the code shows

- The only way a phase advances is a timer: `schedule()` → `scheduler.runAt(end)` → `internal.phases.advance`, guarded by `revision` (`phases.ts:20-97`). `game.choose` records the choice and returns; it never evaluates "is everyone done".
- The seer's vision is already **final and instant** (`game.ts:179-185`, immutable once made), so the engine knows when she is done but still waits out the 20 s. The witch has no "done" action at all (heal/poison are independent toggles), and wolves/guard/custom cards can overwrite their choice until the end.
- The day phases are the same: `vote` waits 30 s (20 s Express) even if all living players have voted.
- Documented as intended: "always runs to its full length" (`phases.ts:109`).

### Design tension with finding 4

Ending a turn as soon as its holder acted makes **fast = alive and acted**, **full duration = dead/idle**, which leaks exactly what the full-length rule hides. The two requirements must be designed together (see the policy table below).

### Leads for correction

- Add an `isTurnComplete(match)` check, evaluated at the end of `choose`: seer after the choice; every living wolf has a ballot or an abstention; guard/custom after choice or pass; witch after an explicit "done"; vote/runoff when all living voters have a ballot (abstention counts); hunter after the shot.
- To end early, bump `revision`, set `end = now + grace`, and call `scheduler.runAfter(grace, advance, { id, revision })`. The revision guard already makes the original scheduled call a no-op, so the mechanism is safe.
- Because choices can currently be changed, use either a short grace (2–3 s, reset by any new choice) or an explicit **Confirm** action. The witch needs the confirm (or a "Pass / Validate" pair) regardless.
- For anti-leak: enforce a minimum floor (≥ 3–5 s) and apply the same early rule to the dead-role turns with a randomised phantom delay (finding 4, Policy B), so that fast and slow turns are not distinguishable by role state.
- Client: `Status` uses `match.end`; no change needed, but the clock should animate a shortened `end`.
- Pause (`game.pause`) only exists for `debate`; make sure early-advance does not interact with `remaining`.

---

## 6. Hunter has a night slot every night, but only acts on death

### What the code shows

- If a hunter card was dealt, `advanceNight` always routes through `nightShot` (15 s, `rules.ts:239-241`) after potions (`engine.ts:123-128`), **every night**, alive or not, killed or not.
- The shot is only possible if the hunter died during that night (`kill()` sets `match.hunter`, `engine.ts:134-141`; `game.view` marks `shooting` only for that player). For everyone else the 15 s phase is empty.
- A hunter killed by the day vote gets `dayShot` instead, and that phase only appears when `match.hunter` is set (`phases.ts:74-77`). So the day slot is **conditional** and the night slot is **unconditional**, which is an inconsistency that also confirms the night slot exists purely to mask information.
- The card itself says "À sa mort" (`cards.tsx:85`), so the schedule contradicts the card.

### Side observation (privacy)

In Mystery / hidden-Workshop modes the conditional `dayShot` already reveals that a hunter exists and has just died. The masked night slot protects less than it appears. Worth deciding consciously, together with finding 4.

### Leads for correction

- Run `nightShot` only when a hunter actually died during that night (mirroring `dayShot`). Since the hunter's death is already published at dawn in revealing modes, it leaks nothing there.
- For non-revealing modes, either accept the leak, or keep a masked slot but short and randomised (Policy B), and keep it independent of which roles are alive.
- Remove the always-on hunter step from `nightSteps` in the HUD.

---

## Cross-cutting design decision: fixed public night vs. fast night

| Option | Dead-role turns | Acting turns | Information leak | Matches feedback |
| --- | --- | --- | --- | --- |
| Today | Full length | Full length | None | No |
| A. Reveal-aware skip + early finish | Skipped (revealing modes) / masked short (hidden modes) | Early finish after choice + grace | Only in hidden modes, mitigated by floor + jitter | Yes |
| B. Uniform phantom window | 4–8 s random | Early finish, min floor | Minimal | Yes |
| C. Configurable "strict secrecy" | Full length | Full length | None | Opt-in |

Recommendation: implement A as the default with C as a lobby option (Mystery enables the strict variant by default). This must be decided before touching `engine.ts`, `phases.ts`, `rules.ts` and the tests.

---

## Suggested measurements before fixing

1. **Replication:** log `Date.now() - position.updated` on the receiver; compare p50/p95 on wired, Wi-Fi and 4G; record mutation round-trip (`move` promise duration) and queue depth. Count `game.positions` executions per second in the Convex dashboard with 8 and 12 players.
2. **Render cost:** React Profiler on `RoomContent` during a debate with 10 moving bots (`scripts/playtest.ts` can drive seats).
3. **Mobile:** Chrome remote-debug on a real mid-range Android: frame time at tiers low/medium, plus the viewport screenshot matrix listed in finding 1.
4. **Night length:** compute per-player-count total night duration with and without dead slots (use `rules.test.ts` fixtures).

## Suggested order of work

1. Decide the two game-design questions: **night secrecy policy** (findings 4, 5, 6) and **live vote visibility** (2b).
2. Quick wins: final-position bug and client-side interpolation (2a Tier 1); the hunter conditional slot (6); live aims for votes (2b).
3. Early-advance + dead-turn skipping with tests (4, 5).
4. Mobile interaction rework and Playwright matrix (1), then card redesign (3).
5. Reassess the realtime transport after the Tier 1 measurements (2a Tier 2).

## Files referenced

`apps/game/convex/{game,phases,engine,schema,access}.ts`, `apps/game/shared/rules.ts`, `apps/game/src/rooms/{Room.tsx,hud.ts}`, `apps/game/src/scene/{stage,cast,puppets,input,quality}.ts`, `apps/game/src/scene/Village.tsx`, `apps/game/src/ui/{cards.tsx,controls.tsx}`, `apps/game/src/style.css`, `specs/game.md`, `GDD.md`.

## Resolution status (findings 4, 5, 6)

Implemented on `feat/tcg-redesign` (policy A from the table above):

- **4 — dead roles:** when roles are revealed on death, a dead holder's turn is skipped (`nightOrder`). In Mystery and Workshop without reveal, the slot is kept but is a masked random 4–8 s window (`durationOf`, `maskedSeconds`).
- **5 — early advance:** `isTurnComplete` + `settleEarly` end a slot after a 3 s grace (2 s for the seer) once its actors are done. The witch has an explicit "Valider" (`choose` action `done`). Hidden modes enforce a 4 s floor per night slot. Debate, intro, dawn and paused matches are unaffected.
- **6 — hunter:** `nightShot` only runs when a hunter died during the night. The hunter no longer has a permanent slot in the HUD night steps.

Not done: the "strict secrecy" lobby option (policy C). Known residual leak in hidden modes: a live holder's turn can last up to 20 s while a dead holder's is 4–8 s, and a conditional `nightShot` reveals that a hunter died.
