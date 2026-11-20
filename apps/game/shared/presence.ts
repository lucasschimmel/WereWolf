export const presenceInterval = 10_000;
const activeTimeout = 30_000;
const inactiveTimeout = 120_000;
const maxPresenceTabs = 16;

export type PresenceStatus = "active" | "inactive" | "disconnected";
export type TabPresence = {
  tab: string;
  revision: number;
  status: PresenceStatus;
  at: number;
};

export function recordPresence(
  tabs: TabPresence[],
  report: TabPresence,
): TabPresence[] {
  const previous = tabs.find((tab) => tab.tab === report.tab);
  if (previous && previous.revision >= report.revision) return tabs;
  return [
    ...tabs
      .filter(
        (tab) => tab.tab !== report.tab && report.at - tab.at < inactiveTimeout,
      )
      .slice(1 - maxPresenceTabs),
    report,
  ];
}

export function presenceStatus(
  member: {
    bot?: boolean;
    seen: number;
    tabs: Pick<TabPresence, "status" | "at">[] | undefined;
  },
  now: number,
): PresenceStatus | undefined {
  if (member.bot) return undefined;
  if (!member.tabs?.length) {
    // CLI playtest seats never send a browser heartbeat.
    if (!member.seen) return undefined;
    return now - member.seen < activeTimeout ? "active" : "disconnected";
  }
  if (
    member.tabs.some(
      (tab) => tab.status === "active" && now - tab.at < activeTimeout,
    )
  )
    return "active";
  return member.tabs.some(
    (tab) => tab.status === "inactive" && now - tab.at < inactiveTimeout,
  )
    ? "inactive"
    : "disconnected";
}
