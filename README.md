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

`develop` is the integration branch. Submit feature branches to `develop`. Release PRs promote `develop` to `main`.

The `apps/landing` directory is reserved for the future landing page.
