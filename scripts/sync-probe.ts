/**
 * Two real players in one room: A walks, B watches. Logs, per second, the
 * relay frames A sends and B receives: a gap in B while A keeps sending means
 * the relay is dropping poses.
 *
 *   bun scripts/sync-probe.ts [seconds]
 *
 * Needs the dev server, the relay and the Convex dev deployment.
 */
import { type Browser, chromium, type Page } from "@playwright/test";

const base = process.env.GAME_URL ?? "http://localhost:5173";
const seconds = Number(process.argv[2] ?? 20);
const start = Date.now();
const bucket = () => Math.floor((Date.now() - start) / 1000);

type Probe = { page: Page; sent: number[]; received: number[] };

async function player(browser: Browser, name: string): Promise<Probe> {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 },
  });
  const page = await context.newPage();
  const probe: Probe = { page, sent: [], received: [] };
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/rooms/")) return;
    console.log(name, "relay socket opened at", bucket());
    socket.on("framesent", () => {
      probe.sent[bucket()] = (probe.sent[bucket()] ?? 0) + 1;
    });
    socket.on("framereceived", () => {
      probe.received[bucket()] = (probe.received[bucket()] ?? 0) + 1;
    });
    socket.on("close", () => console.log(name, "relay closed at", bucket()));
  });
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      console.log(name, message.type(), message.text());
  });
  await page.goto(base);
  await page.getByPlaceholder("Ton prénom").fill(name);
  return probe;
}

async function walk(page: Page) {
  await page
    .locator("canvas")
    .first()
    .click({ position: { x: 500, y: 350 } });
  const keys = ["KeyW", "KeyD", "KeyS", "KeyA"];
  for (let index = 0; index < seconds; index++) {
    const key = keys[index % keys.length];
    await page.keyboard.down(key);
    await page.waitForTimeout(1000);
    await page.keyboard.up(key);
  }
}

const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
try {
  const a = await player(browser, "A");
  await a.page.getByRole("button", { name: "Créer un salon" }).click();
  const code = (await a.page.locator(".room-code").textContent())?.trim();
  if (!code) throw new Error("Room code not found");
  const b = await player(browser, "B");
  await b.page.getByPlaceholder("CODE").fill(code);
  await b.page.getByPlaceholder("CODE").press("Enter");
  await b.page.waitForSelector(".room-code");
  await a.page.waitForTimeout(3000);
  console.log(
    "walking from second",
    bucket(),
    await a.page.evaluate(
      () =>
        new Promise((ok) => {
          let n = 0;
          const t = performance.now();
          const f = () => {
            n++;
            if (performance.now() - t < 1000) requestAnimationFrame(f);
            else
              ok({
                fps: n,
                active: document.activeElement?.tagName,
                visible: document.visibilityState,
              });
          };
          requestAnimationFrame(f);
        }),
    ),
  );
  await walk(a.page);
  const row = (list: number[]) =>
    Array.from({ length: bucket() }, (_, index) => list[index] ?? 0).join(",");
  console.log("A sent/s    ", row(a.sent));
  console.log("B received/s", row(b.received));
} finally {
  await browser.close();
}
