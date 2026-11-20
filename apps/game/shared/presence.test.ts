import { expect, test } from "bun:test";
import {
  type PresenceStatus,
  presenceStatus,
  recordPresence,
  type TabPresence,
} from "./presence";

const start = 1_000_000;
const member = { bot: false, seen: 0, tabs: undefined };
const report = (
  status: PresenceStatus,
  overrides: Partial<TabPresence> = {},
): TabPresence => ({ tab: "a", revision: 1, status, at: start, ...overrides });

test("a CLI playtest seat does not become disconnected without a browser", () => {
  expect(presenceStatus(member, start + 300_000)).toBeUndefined();
});

test("a background tab stays inactive past the foreground timeout", () => {
  const tabs = [report("inactive")];

  expect(presenceStatus({ ...member, tabs }, start + 60_000)).toBe("inactive");
});

test("a closed tab is marked disconnected immediately", () => {
  const tabs = [report("disconnected")];

  expect(presenceStatus({ ...member, tabs }, start)).toBe("disconnected");
});

test("a long-silent background tab eventually expires", () => {
  const tabs = [report("inactive")];

  expect(presenceStatus({ ...member, tabs }, start + 120_000)).toBe(
    "disconnected",
  );
});

test("closing one tab leaves the seat active when another tab is focused", () => {
  const tabs = recordPresence(
    [report("active")],
    report("disconnected", { tab: "b" }),
  );

  expect(presenceStatus({ ...member, tabs }, start)).toBe("active");
});

test("a late heartbeat cannot undo a newer close report", () => {
  const tabs = recordPresence(
    [report("disconnected", { revision: 2 })],
    report("active"),
  );

  expect(presenceStatus({ ...member, tabs }, start)).toBe("disconnected");
});

test("returning to a hidden tab makes the seat active again", () => {
  const tabs = recordPresence(
    [report("inactive")],
    report("active", { revision: 2, at: start + 60_000 }),
  );

  expect(presenceStatus({ ...member, tabs }, start + 60_000)).toBe("active");
});
