# WereWolf

A private 3D social deduction game for 8–15 friends. Voice runs on Discord. Players enter with a nickname and an invitation code.

See [the game design](GDD.md) and [implementation notes](specs/game.md).

## Run locally

Install Bun and run:

```sh
bun install --frozen-lockfile
cd apps/game
bun run convex:dev
```

In a second terminal, from the repository root, run `bun run dev`. Open the Vite URL. The Convex CLI sets the frontend deployment URL in the game's local environment file. Each browser profile can hold a separate seat in the same room.

### Movement relay (optional)

Player movement goes through a small WebSocket relay (`apps/relay`, a Cloudflare Durable Object per room). Without it, the game falls back to Convex, which is slower. To run it locally:

```sh
cd apps/relay
echo "RELAY_SECRET=$(openssl rand -hex 32)" > .dev.vars
cd ../game
npx convex env set RELAY_SECRET <same value>
```

Then add `VITE_RELAY_URL=/relay` to `apps/game/.env.local` and run `bun run relay` from the repository root next to `bun run dev`. Vite proxies `/relay` to the local relay, so phones on the LAN only need the Vite URL. To deploy: `wrangler secret put RELAY_SECRET` and `wrangler deploy` in `apps/relay`, optionally set `ALLOWED_ORIGINS`, then point `VITE_RELAY_URL` at `wss://<worker host>`.

`develop` is the integration branch. Submit feature branches to `develop`. Release PRs promote `develop` to `main`.

The `apps/landing` directory is reserved for the future landing page.

## Playtest with bots

With Node.js 24 installed, create a room in the browser, copy its six-character code, then run this from the repository root:

```sh
bun run playtest CODE add 7
bun run playtest CODE
```

Select your character, mark yourself ready, and start the match as host. In the CLI, use `status` to see bot roles, available actions, and targets. Use `play Bot-01 Pseudo` to submit an action, `auto` to fill pending ordinary bot actions, or `next` to advance one server step. Use `help` for potions, abstentions, readiness, and the journal. Changing the room rules resets readiness, so run `ready` again after changing modes.

The CLI uses the game's cloud development deployment. `next` requires the authenticated Convex CLI and operates only on the active development room. Bot sessions are kept locally in the ignored `.codex/dev-rooms/` directory, so restarting the CLI preserves control.
