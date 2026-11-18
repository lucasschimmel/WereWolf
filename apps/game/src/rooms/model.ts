import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
export type View = FunctionReturnType<typeof api.game.view>;
export type Member = View["members"][number];
export type MatchView = NonNullable<View["match"]>;
export type Position = FunctionReturnType<typeof api.game.positions>[number];
