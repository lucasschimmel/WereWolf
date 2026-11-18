import { createInterface } from "node:readline";
import { ConvexError } from "convex/values";
import {
  type Camp,
  campNames,
  cardFor,
  modes,
  phaseNames,
} from "../apps/game/shared/rules.ts";
import { DevRoom, type RoomView } from "./dev-room.ts";

const help = `WereWolf · CLI de test

Ouvrir le jeu, créer un salon, puis lancer :
  bun run playtest CODE [commande]

Sans commande, démarre une session interactive.
  add 7                      Ajoute 7 faux joueurs prêts à jouer
  remove Bot-01              Libère une place dans le lobby
  ready [all|Bot-01]         Marque les faux joueurs comme prêts
  unready [all|Bot-01]       Annule leur statut prêt
  status                     Affiche rôles, phase, cibles et choix
  status Bot-01              Affiche une fiche détaillée
  play Bot-01 Pseudo         Soumet son action actuelle sur Pseudo
  pass Bot-01                Passe ou annule son action actuelle
  heal Bot-01 [off]          Utilise ou annule le remède
  poison Bot-01 Pseudo|off   Choisit ou annule le poison
  auto                       Joue une action aléatoire par bot en attente
  next                       Avance une étape serveur (Convex CLI)
  journal                    Affiche votes, éliminations et bilan
  help                       Affiche les commandes
  quit                       Quitte la CLI, conserve les faux joueurs

L’hôte règle et lance sa partie dans le navigateur. Les nuits comprennent
plusieurs étapes serveur. Utilise status après next pour voir les actions.
`;
const nameOf = (view: RoomView, id: string) =>
  view.members.find((member) => member.id === id)?.name ?? (id || "passe");
const label = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : error instanceof Error
      ? error.message
      : String(error);

function showStatus(views: RoomView[], detailed: boolean) {
  const first = views[0];
  if (!first) {
    console.log("Ajoute d’abord des faux joueurs avec add.");
    return;
  }
  const match = first.match;
  const seconds = match
    ? Math.max(0, Math.ceil((match.remaining ?? match.end - Date.now()) / 1000))
    : 0;
  console.log(
    `${first.code} · ${modes[first.settings.mode]} · ${first.members.length} joueurs · ${match ? `${phaseNames[match.phase]} · tour ${match.cycle} · ${match.remaining !== undefined ? "pause · " : ""}${seconds} s` : "Lobby"}`,
  );
  for (const view of views) {
    const member = view.members.find((entry) => entry.id === view.me);
    const state = view.match;
    if (!member) continue;
    const role = state
      ? cardFor(state.role, view.settings).name
      : member.ready
        ? "Prêt"
        : "En attente";
    console.log(
      `  ${member.name} · ${role}${member.alive ? "" : " · éliminé"}`,
    );
    if (state?.action) {
      console.log(
        `    ${state.action} → ${state.targets?.map((id) => nameOf(view, id)).join(", ") || "aucune cible"}`,
      );
      if (state.selected !== undefined)
        console.log(`    Choix : ${nameOf(view, state.selected)}`);
    }
    if (state?.potions) {
      if (state.potions.attack)
        console.log(
          `    Remède : ${nameOf(view, state.potions.attack)}${state.potions.heal ? " (sélectionné)" : ""}`,
        );
      if (state.potions.targets.length)
        console.log(
          `    Poison : ${state.potions.targets.map((id) => nameOf(view, id)).join(", ")}${state.potions.poison ? ` (choix : ${nameOf(view, state.potions.poison)})` : ""}`,
        );
    }
    if (detailed && state?.mates.length)
      console.log(
        `    Meute : ${state.mates.map((id) => nameOf(view, id)).join(", ")}`,
      );
    if (detailed && state)
      for (const intel of state.intel) {
        const [cycle, target, result] = intel.split("|");
        console.log(
          `    Nuit ${cycle} · ${nameOf(view, target)} · ${campNames[result as Camp] ?? (result === "active" ? "a agi" : "n’a pas agi")}`,
        );
      }
  }
  const bots = new Set(views.map((view) => view.me));
  if (!detailed)
    for (const member of first.members.filter((entry) => !bots.has(entry.id))) {
      console.log(
        `  ${member.name}${member.host ? " · hôte" : ""} · ${member.alive ? (member.ready ? "prêt" : "en jeu") : "éliminé"}`,
      );
    }
}

async function run(room: DevRoom, [input, actor = "", ...rest]: string[]) {
  const command = input?.toLowerCase();
  switch (command) {
    case "add":
      await room.add(Number(actor));
      return;
    case "remove":
      await room.remove(actor);
      return;
    case "ready":
      await room.ready(actor || "all", true);
      return;
    case "unready":
      await room.ready(actor || "all", false);
      return;
    case "play":
    case "pass":
    case "heal":
    case "poison":
      await room.act(actor, command, rest.join(" "));
      return;
    case "auto":
      await room.auto();
      return;
    case "next":
      await room.next();
      showStatus(await room.views(), false);
      return;
    case "status":
      showStatus(
        actor ? [await room.view(actor)] : await room.views(),
        !!actor,
      );
      return;
    case "journal": {
      const first = room.names()[0];
      if (!first) throw new Error("Ajoute d’abord des faux joueurs.");
      const view = await room.view(first);
      const match = view.match;
      if (!match) throw new Error("La partie est dans le lobby.");
      for (const event of [...match.events, ...(match.audit ?? [])]) {
        console.log(`Tour ${event.cycle} · ${event.label}`);
        if (event.deaths)
          console.log(
            `  ${event.deaths.map((id) => nameOf(view, id)).join(", ") || "Aucune élimination"}`,
          );
        for (const [from, to] of Object.entries(event.votes ?? {}))
          console.log(`  ${nameOf(view, from)} → ${nameOf(view, to)}`);
      }
      if (match.outcome)
        console.log(
          `Victoire : ${match.outcome === "draw" ? "partie nulle" : campNames[match.outcome]}`,
        );
      return;
    }
    case "help":
      console.log(help);
      return;
    default:
      throw new Error("Commande inconnue. Tape help.");
  }
}

async function main() {
  const [code, ...args] = process.argv.slice(2);
  if (!code || code === "--help" || code === "-h") {
    console.log(help);
    return;
  }
  const room = new DevRoom(code);
  if (args.length) {
    await run(room, args);
    return;
  }
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
    prompt: `${room.code} > `,
  });
  console.log(`Salon ${room.code} · tape help pour afficher les commandes.`);
  input.prompt();
  for await (const line of input) {
    const command = line.trim().split(/\s+/);
    if (command[0] === "quit" || command[0] === "exit") break;
    if (command[0]) {
      try {
        await run(room, command);
      } catch (error) {
        console.error(label(error));
      }
    }
    input.prompt();
  }
  input.close();
}

main().catch((error) => {
  console.error(label(error));
  process.exitCode = 1;
});
