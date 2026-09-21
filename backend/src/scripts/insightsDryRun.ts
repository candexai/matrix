/**
 * Try the insights tagging on real conversations WITHOUT writing anything: the taxonomy is simulated in
 * memory, starting empty, so the output shows what a full re-analysis would produce.
 *   npx ts-node --transpile-only src/scripts/insightsDryRun.ts [--workspace default] [--n 14]
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { Conversation } from "../models/Conversation";
import type { InsightTagDoc } from "../models/InsightTag";
import { buildInsightsPrompt, isOverused, slug, TAG_CAP } from "../services/insights.service";
import { defaultOpenAICaller } from "../services/extraction.service";

async function main() {
  const args = process.argv.slice(2);
  const opt = (k: string, d: string) => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : d);
  const workspaceId = opt("--workspace", env.DEFAULT_WORKSPACE_ID);
  const n = Number(opt("--n", "14"));
  await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME });
  const convs = await Conversation.find({ workspaceId, status: "done", "transcript.1": { $exists: true } }).sort({ createdAt: -1 }).limit(n);
  convs.reverse();
  const tax = new Map<string, { key: string; label: string; category: string; count: number; description: string }>();
  let analysed = 0;
  for (const c of convs) {
    const list = [...tax.values()].sort((a, b) => b.count - a.count) as unknown as InsightTagDoc[];
    const { system, user } = buildInsightsPrompt(c, list, TAG_CAP, analysed);
    const raw = await defaultOpenAICaller([{ role: "system", content: system }, { role: "user", content: user }], process.env.OPENAI_INSIGHTS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini");
    const out = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    for (const m of out.merges ?? []) {
      const from = tax.get(slug(m.from ?? "")), into = tax.get(slug(m.into ?? ""));
      if (from && into && from !== into) { into.count += from.count; if (m.label) into.label = m.label; tax.delete(from.key); }
    }
    const tags: string[] = [];
    for (const t of (out.tags ?? []).slice(0, 5)) {
      const key = slug(t.key || t.label);
      if (/^(no_objection|neutral_caller|call_successful|call_completed|general_inquiry)$/.test(key)) continue;
      const existing = tax.get(key);
      if (!existing && tax.size >= TAG_CAP) { tags.push(`(dropped: ${t.label})`); continue; }
      if (existing) existing.count++;
      else tax.set(key, { key, label: t.label, category: t.category ?? "topic", count: 1, description: t.description ?? "" });
      tags.push(`${existing ? "" : "+"}${tax.get(key)!.label}${existing && isOverused(existing.count, analysed) ? "*" : ""}`);
    }
    analysed++;
    const callerTurns = c.transcript.filter((t) => t.role !== "agent").length;
    console.log(`${String(c.durationSecs ?? 0).padStart(4)}s ${String(callerTurns).padStart(2)}t  ${(c.summaryTitle ?? "").slice(0, 34).padEnd(34)} → ${tags.join(" | ")}${(out.merges ?? []).length ? `   [merges: ${JSON.stringify(out.merges)}]` : ""}`);
  }
  console.log(`\ntaxonomy after ${analysed} calls: ${tax.size} tags`);
  for (const t of [...tax.values()].sort((a, b) => b.count - a.count)) console.log(`  ${String(t.count).padStart(3)}  ${t.category.padEnd(9)} ${t.label}`);
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
