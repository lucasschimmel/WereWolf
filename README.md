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

To preview the compiled game locally, run `bun run build` and then `bun run start`. Open the URL printed by Vite.

### Run in Zellij

Install [Zellij](https://zellij.dev/documentation/installation.html) and make sure `zellij` is on your PATH. On Windows, use native Zellij and run the command from PowerShell or Windows Terminal.

From the repository root, run `bun run dev:zellij`. It starts Zellij or opens a **WereWolf** tab in the current session, with Convex on the left and the Vite dev server on the right.

After building, run `bun run start:zellij` to use the compiled game in the same layout. Add `--playtest` to either Zellij command to open a column with a shell at the repository root. Pass a room code with `--playtest CODE` to open and focus the interactive [playtest CLI](#playtest-with-bots) directly.

Run `bun run dev:zellij --relay` to start the local worker below Convex in a shared left column. Combine it with `--playtest` to give Game and Playtest their own columns. The worker runs in disabled mode, and the game sends player movement through Convex.

### Movement and relay rollout

Convex serves movement during the lobby, introduction and debate. Each position belongs to a single movement window. Roll out the new protocol between multiplayer matches and refresh older game tabs afterward.

If the WebSocket worker was deployed, deploy the disabled worker from `apps/relay` before updating the game. It rejects new connections and stops forwarding frames from sockets admitted by the earlier worker.

`develop` is the integration branch. Submit feature branches to `develop`. Release PRs promote `develop` to `main`.

The `apps/landing` directory is reserved for the future landing page.

## Playtest with bots

With Node.js 24 installed, create a room in the browser, copy its six-character code, then run this from the repository root:

```sh
bun run playtest CODE add 7
bun run playtest CODE
```

Select your character, mark yourself ready, and start the match as host. In the CLI, use `status` to see bot roles, available actions, and targets. Use `play Bot-01 Pseudo` to submit an action, `done Bot-01` to confirm a Witch turn, `auto` to play pending bot turns, or `next` to advance one server step. Use `help` for potions, abstentions, readiness, and the journal. Changing the room rules resets readiness, so run `ready` again after changing modes.

The CLI uses the game's cloud development deployment. `next` requires the authenticated Convex CLI and operates only on the active development room. Bot sessions are kept locally in the ignored `.codex/dev-rooms/` directory, so restarting the CLI preserves control.
