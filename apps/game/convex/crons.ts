import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("expire rooms", { minutes: 10 }, internal.game.clean, {});
export default crons;
