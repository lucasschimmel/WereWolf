import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cliArgs = Bun.argv.slice(2);
const gameScript = cliArgs[0] === "--start" ? "start" : "dev";
const relayUsage = gameScript === "dev" ? " [--relay]" : "";
const usage = `Usage: bun run ${gameScript}:zellij [--playtest [ROOM_CODE]]${relayUsage}`;
const options = gameScript === "start" ? cliArgs.slice(1) : cliArgs;
if (options.length === 1 && ["--help", "-h"].includes(options[0])) {
  console.log(usage);
  process.exit(0);
}

let playtest = false;
let relay = false;
let roomCode: string | undefined;
for (let index = 0; index < options.length; index += 1) {
  const option = options[index];
  if (option === "--relay" && gameScript === "dev" && !relay) {
    relay = true;
  } else if (option === "--playtest" && !playtest) {
    playtest = true;
    const next = options[index + 1];
    if (next && !next.startsWith("-")) {
      roomCode = next;
      index += 1;
    }
  } else {
    console.error(usage);
    process.exit(2);
  }
}

const zellij = Bun.which("zellij");
if (!zellij) {
  console.error(
    "Zellij is required on PATH. See https://zellij.dev/documentation/installation.html",
  );
  process.exit(1);
}

const repoRoot = resolve(import.meta.dir, "..");
const bunCommand = JSON.stringify(process.execPath);
const serviceIndent = relay ? "                " : "            ";
const convexPane = `${serviceIndent}pane name="Convex" cwd="apps/game" command=${bunCommand} {
${serviceIndent}    args "run" "convex:dev"
${serviceIndent}}
`;
const services = relay
  ? `            pane size="25%" split_direction="horizontal" {
${convexPane}                pane name="Relay" command=${bunCommand} {
                    args "run" "relay"
                }
            }
`
  : convexPane;
let playtestPane = "";
if (playtest) {
  playtestPane = roomCode
    ? `            pane name="Playtest" command=${bunCommand} focus=true {
                args "run" "playtest" ${JSON.stringify(roomCode)}
            }
`
    : '            pane name="Playtest"\n';
}
const layout = `layout {
    tab name="WereWolf" {
        pane size=1 borderless=true {
            plugin location="zellij:tab-bar"
        }
        pane split_direction="vertical" {
${services}            pane name="Game" command=${bunCommand} focus=${!roomCode} {
                args "run" "${gameScript}"
            }
${playtestPane}        }
        pane size=2 borderless=true {
            plugin location="zellij:status-bar"
        }
    }
}
`;

const layoutDir = mkdtempSync(join(tmpdir(), "werewolf-zellij-"));
const layoutPath = join(layoutDir, "werewolf.kdl");
try {
  writeFileSync(layoutPath, layout);

  const args = process.env.ZELLIJ_SESSION_NAME
    ? ["action", "new-tab", "--cwd", repoRoot, "--layout", layoutPath]
    : ["--layout", layoutPath];
  const result = Bun.spawnSync([zellij, ...args], {
    cwd: repoRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = result.exitCode ?? 1;
} finally {
  rmSync(layoutPath, { force: true });
  rmdirSync(layoutDir);
}
