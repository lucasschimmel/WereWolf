/**
 * Mobile screenshot matrix for manual UI review.
 *
 *   bun run shots setup          Opens a room as a touch host, adds 7 bots,
 *                                readies everyone and starts the match.
 *   bun run shots shot LABEL [SELECTOR]
 *                                Captures the current room on every viewport,
 *                                after SELECTOR appears (e.g. ".picker").
 *   bun run shots gate           Captures the entry screen on every viewport.
 *
 * Needs the dev server (`bun run dev`) and the Convex dev deployment used by
 * `bun run playtest`. Output lands in the ignored `.playwright/` folder.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";

const base = process.env.GAME_URL ?? "http://localhost:5173";
const root = ".playwright";
const statePath = join(root, "host.json");
const codePath = join(root, "code.txt");
const shotsDir = join(root, "shots");

export const viewports = [
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "small-landscape", width: 667, height: 375 },
  { name: "android-landscape", width: 800, height: 360 },
  { name: "phone-portrait", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 768 },
] as const;

async function touchPage(browser: Browser, withState: boolean) {
  const context = await browser.newContext({
    viewport: { width: viewports[0].width, height: viewports[0].height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: withState && existsSync(statePath) ? statePath : undefined,
  });
  // Creating a room goes full screen on touch devices, which blocks resizing
  // and screenshots: behave like a browser that refuses (iOS Safari).
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Full screen disabled for screenshots"));
  });
  return { context, page: await context.newPage() };
}

function playtest(code: string, ...args: string[]) {
  execFileSync("bun", ["run", "playtest", code, ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

async function capture(page: Page, label: string) {
  mkdirSync(shotsDir, { recursive: true });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(700);
    await page.screenshot({
      path: join(shotsDir, `${label}-${viewport.name}.png`),
    });
  }
  await page.setViewportSize(viewports[0]);
}

async function setup(browser: Browser) {
  const { context, page } = await touchPage(browser, false);
  await page.goto(base);
  await page.getByLabel("Prénom").fill("Hôte");
  await page.getByRole("button", { name: "Créer un salon" }).click();
  const code = (await page.locator(".room-code").textContent())?.trim();
  if (!code) throw new Error("Room code not found");
  mkdirSync(root, { recursive: true });
  writeFileSync(codePath, code);
  playtest(code, "add", "7");
  playtest(code, "ready", "all");
  await page.getByRole("button", { name: "Je suis prêt" }).click();
  await capture(page, "lobby");
  await page.getByRole("button", { name: "Villageois", exact: true }).click();
  await capture(page, "roster");
  await page.getByRole("button", { name: "Fermer" }).last().click();
  await page.getByRole("button", { name: /Lancer/ }).click();
  await page.waitForSelector(".hand", { timeout: 15_000 });
  await context.storageState({ path: statePath });
  console.log(`Room ${code} started.`);
  await capture(page, "intro");
}

async function shot(browser: Browser, label: string, until?: string) {
  const code = readFileSync(codePath, "utf8").trim();
  const { page } = await touchPage(browser, true);
  await page.goto(`${base}/?room=${code}`);
  await page.waitForSelector(".hud", { timeout: 15_000 });
  // Optionally wait for a moment of the match, e.g. ".picker" for a vote.
  if (until) await page.waitForSelector(until, { timeout: 240_000 });
  await page.waitForTimeout(until ? 300 : 2500);
  await capture(page, label);
}

async function gate(browser: Browser) {
  const { page } = await touchPage(browser, false);
  await page.goto(base);
  await page.waitForTimeout(2500);
  await capture(page, "gate");
}

const [command = "gate", label = "now", until] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader"] });
try {
  if (command === "setup") await setup(browser);
  else if (command === "shot") await shot(browser, label, until);
  else await gate(browser);
} finally {
  await browser.close();
}
