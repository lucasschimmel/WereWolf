import { ConvexError } from "convex/values";
export type Credentials = { code: string; key: string };
const last = "werewolf.last";
export function guestKey() {
  const id = "werewolf.guest";
  const existing = localStorage.getItem(id);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  localStorage.setItem(id, key);
  return key;
}
export const session = {
  has: (code: string) => localStorage.getItem(`werewolf.room.${code}`) === "1",
  last: () => localStorage.getItem(last) ?? undefined,
  save: (code: string) => {
    localStorage.setItem(`werewolf.room.${code}`, "1");
    localStorage.setItem(last, code);
  },
  remove: (code: string) => {
    localStorage.removeItem(`werewolf.room.${code}`);
    if (localStorage.getItem(last) === code) localStorage.removeItem(last);
  },
};
export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string")
    return error.data;
  return "La connexion a rencontré un problème. Réessaie.";
}
