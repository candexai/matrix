/**
 * Re-run Conversation Insights on completed calls (e.g. after changing the tagging scheme).
 *   node dist/scripts/reanalyzeInsights.js [--days 90] [--max 200] [--force] [--reset] [--workspace <id>]
 * --reset wipes the workspace's tag vocabulary and stored analyses first, then re-tags every call in
 * chronological order (use it after the tagging rules change).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { Agent } from "../models/Agent";
import { analyzePending, resetInsights } from "../services/insights.service";

async function main() {
  const args = process.argv.slice(2);
  const opt = (k: string, d: number) => {
    const i = args.indexOf(k);
    return i >= 0 ? Number(args[i + 1]) : d;
  };
  const reset = args.includes("--reset");
  const force = reset || args.includes("--force");
  const only = args.indexOf("--workspace") >= 0 ? args[args.indexOf("--workspace") + 1] : undefined;
  await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME });
  const workspaces = (await Agent.distinct("workspaceId")).map(String);
  for (const ws of only ? [only] : workspaces.length ? workspaces : [env.DEFAULT_WORKSPACE_ID]) {
    if (reset) {
      const r0 = await resetInsights(ws);
      console.log(`[${ws}] reset: removed ${r0.tagsRemoved} tags, cleared ${r0.conversationsCleared} analyses`);
    }
    const r = await analyzePending(ws, { sinceDays: opt("--days", 90), max: opt("--max", 200), force });
    console.log(`[${ws}] scanned ${r.scanned}, analysed ${r.analyzed}, errors ${r.errors.length}`);
    for (const e of r.errors.slice(0, 5)) console.log("  ", e);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
