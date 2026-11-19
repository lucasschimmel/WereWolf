import { describe, expect, test } from "bun:test";
import { signTicket, verifyTicket } from "./ticket";

const secret = "test-secret-REPLACE_ME";
const ticket = { room: "room1", player: "player1", exp: 10_000 };

describe("seat tickets", () => {
  test("a signed ticket verifies before it expires", async () => {
    const token = await signTicket(ticket, secret);
    expect(await verifyTicket(token, secret, 5_000)).toEqual(ticket);
  });

  test("an expired ticket is rejected", async () => {
    const token = await signTicket(ticket, secret);
    expect(await verifyTicket(token, secret, 10_000)).toBeNull();
  });

  test("a ticket signed with another secret is rejected", async () => {
    const token = await signTicket(ticket, "other-secret");
    expect(await verifyTicket(token, secret, 5_000)).toBeNull();
  });

  test("a tampered body is rejected", async () => {
    const token = await signTicket(ticket, secret);
    const [, signature] = token.split(".");
    const forged = await signTicket({ ...ticket, player: "intruder" }, secret);
    const [forgedBody] = forged.split(".");
    expect(
      await verifyTicket(`${forgedBody}.${signature}`, secret, 5_000),
    ).toBeNull();
  });

  test("garbage is rejected without throwing", async () => {
    expect(await verifyTicket("not-a-ticket", secret)).toBeNull();
    expect(await verifyTicket("%%%.###", secret)).toBeNull();
  });
});
