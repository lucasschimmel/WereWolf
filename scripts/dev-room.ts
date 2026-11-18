import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../apps/game/convex/_generated/api.js";
import { characters, maxPlayers } from "../apps/game/shared/rules.ts";

export type RoomView = FunctionReturnType<typeof api.game.view>;
type Action = FunctionArgs<typeof api.game.choose>["action"];
type Bot = { name: string; key: string };
const gameDir = resolve(import.meta.dirname, "../apps/game");
const config = resolve(gameDir, ".env.local");
const store = resolve(import.meta.dirname, "../.codex/dev-rooms");
const convexCli = resolve(gameDir, "../../node_modules/convex/bin/main.js");

export class DevRoom {
  readonly code: string;
  private readonly client: ConvexHttpClient;
  private readonly deployment: string;
  private readonly file: string;
  private bots: Bot[];

  constructor(code: string) {
    this.code = code.toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(this.code))
      throw new Error("Saisis le code à six caractères du salon.");
    const url = process.env.VITE_CONVEX_URL;
    const deployment = process.env.CONVEX_DEPLOYMENT?.trim();
    if (!url || !deployment || !/^dev:[\w-]+$/.test(deployment))
      throw new Error(
        "Configure un déploiement Convex cloud de développement avec bun run convex:dev dans apps/game.",
      );
    this.client = new ConvexHttpClient(url);
    this.deployment = deployment.slice(4);
    this.file = resolve(store, `${this.deployment}-${this.code}.json`);
    this.bots = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, "utf8"))
      : [];
  }

  names() {
    return this.bots.map(({ name }) => name);
  }

  private credential(bot: Bot) {
    return { code: this.code, key: bot.key };
  }

  private save() {
    mkdirSync(store, { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.bots), { mode: 0o600 });
    renameSync(temporary, this.file);
  }

  private bot(name: string) {
    const bot = this.bots.find(
      (entry) => entry.name.toLowerCase() === name.toLowerCase(),
    );
    if (!bot)
      throw new Error(`Faux joueur inconnu : ${name || "indique son pseudo"}.`);
    return bot;
  }

  async add(count: number) {
    if (!Number.isInteger(count) || count < 1 || count >= maxPlayers)
      throw new Error("Indique un nombre de joueurs entre 1 et 14.");
    const created: string[] = [];
    for (let added = 0; added < count; added++) {
      const next = Array.from(
        { length: maxPlayers - 1 },
        (_, index) => `Bot-${String(index + 1).padStart(2, "0")}`,
      ).find((name) => !this.bots.some((bot) => bot.name === name));
      if (!next)
        throw new Error("Tous les emplacements de faux joueurs sont utilisés.");
      const bot = { name: next, key: randomBytes(32).toString("hex") };
      await this.client.mutation(api.rooms.join, {
        ...this.credential(bot),
        name: bot.name,
      });
      this.bots.push(bot);
      this.save();
      await this.client.mutation(api.rooms.profile, {
        ...this.credential(bot),
        character: (this.bots.length - 1) % characters.length,
        ready: true,
      });
      created.push(bot.name);
      console.log(`+ ${bot.name} · prêt`);
    }
    return created;
  }

  async remove(name: string) {
    const bot = this.bot(name);
    await this.client.mutation(api.rooms.leave, this.credential(bot));
    this.bots = this.bots.filter((entry) => entry !== bot);
    this.save();
  }

  async ready(name: string, ready: boolean) {
    const bots = name === "all" ? this.bots : [this.bot(name)];
    await Promise.all(
      bots.map((bot) =>
        this.client.mutation(api.rooms.profile, {
          ...this.credential(bot),
          ready,
        }),
      ),
    );
  }

  view(name: string) {
    return this.client.query(api.game.view, this.credential(this.bot(name)));
  }

  async views() {
    return Promise.all(this.names().map((name) => this.view(name)));
  }

  private target(view: RoomView, input: string, allowed: string[]) {
    const canonical = input.toLowerCase();
    const player = view.members.find(
      (member) =>
        member.id === input || member.name.toLowerCase() === canonical,
    );
    if (!player || !allowed.includes(player.id))
      throw new Error(
        "Cette cible est indisponible. Consulte les cibles affichées dans status.",
      );
    return player.id;
  }

  async act(
    name: string,
    command: "play" | "pass" | "heal" | "poison",
    input = "",
  ) {
    const view = await this.view(name);
    const match = view.match;
    if (!match)
      throw new Error("L’hôte doit lancer la partie dans le navigateur.");
    let action: Action;
    let target = "";
    if (command === "heal") {
      if (!match.potions?.attack) throw new Error("Aucun remède disponible.");
      action = "heal";
      target = input === "off" ? "" : match.potions.attack;
    } else if (command === "poison") {
      if (!match.potions?.targets.length)
        throw new Error("Aucun poison disponible.");
      action = "poison";
      target =
        input === "off" ? "" : this.target(view, input, match.potions.targets);
    } else {
      if (!match.action)
        throw new Error("Ce joueur n’a pas d’action pendant cette phase.");
      action = match.action;
      if (command === "play")
        target = this.target(view, input, match.targets ?? []);
    }
    await this.client.mutation(api.game.choose, {
      ...this.credential(this.bot(name)),
      action,
      target,
    });
    console.log(
      `${name} · ${action} → ${view.members.find((member) => member.id === target)?.name ?? "passe"}`,
    );
  }

  async auto() {
    const views = await this.views();
    const plans = views.flatMap((view) => {
      const match = view.match;
      if (
        !match?.action ||
        match.selected !== undefined ||
        !match.targets?.length
      )
        return [];
      const actor = view.members.find((member) => member.id === view.me);
      const target =
        match.targets[Math.floor(Math.random() * match.targets.length)];
      return actor ? [{ actor: actor.name, target }] : [];
    });
    for (const { actor, target } of plans)
      await this.act(actor, "play", target);
    if (!plans.length) console.log("Aucune action automatique disponible.");
  }

  async next() {
    const views = await this.views();
    if (!views.some(({ match }) => match && match.phase !== "ended"))
      throw new Error(
        "Il faut une partie active et au moins un faux joueur contrôlé.",
      );
    const snapshot = this.runConvex(
      "--inline-query",
      `
      const room = await ctx.db.query("rooms").withIndex("by_code", (q) => q.eq("code", ${JSON.stringify(this.code)})).unique();
      if (!room?.match) return null;
      const match = await ctx.db.get(room.match);
      return match && { id: match._id, revision: match.revision, phase: match.phase, paused: match.remaining !== undefined };
    `,
    );
    const phase: {
      id: string;
      revision: number;
      phase: string;
      paused: boolean;
    } | null = JSON.parse(snapshot);
    if (!phase || phase.phase === "ended")
      throw new Error("Aucune phase à avancer.");
    const args = JSON.stringify({ id: phase.id, revision: phase.revision });
    this.runConvex(phase.paused ? "game:resume" : "phases:advance", args);
    console.log(
      phase.paused ? "Débat repris." : `Étape ${phase.phase} résolue.`,
    );
  }

  private runConvex(...args: string[]) {
    const result = spawnSync(
      process.execPath,
      [
        convexCli,
        "run",
        "--env-file",
        config,
        "--deployment",
        this.deployment,
        ...args,
      ],
      {
        cwd: gameDir,
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    if (result.status !== 0)
      throw new Error(
        "Convex CLI n’a pas pu avancer la partie. Vérifie que ta CLI Convex est connectée au projet de développement.",
      );
    return result.stdout.trim();
  }
}
