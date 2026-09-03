import { Conversation } from "../models/Conversation";
import { Lead } from "../models/Lead";
import { Agent } from "../models/Agent";

export interface Range {
  from: Date;
  to: Date;
  /** IANA timezone used for day/hour bucketing */
  tz: string;
}

export const DEFAULT_TZ = process.env.ANALYTICS_TZ || "Asia/Kolkata";

export function parseRange(q: { from?: string; to?: string; days?: string; tz?: string }): Range {
  const to = q.to ? new Date(q.to) : new Date();
  const days = q.days ? Number(q.days) : 30;
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - days * 86400000);
  const tz = q.tz && /^[A-Za-z_]+\/[A-Za-z_\/+-]+$|^UTC$/.test(q.tz) ? q.tz : DEFAULT_TZ;
  return { from, to, tz };
}

function timeMatch(r: Range) {
  return { $or: [{ startedAt: { $gte: r.from, $lte: r.to } }, { startedAt: { $exists: false }, createdAt: { $gte: r.from, $lte: r.to } }] };
}

export async function summary(workspaceId: string, r: Range) {
  const match = { workspaceId, channel: "voice", ...timeMatch(r) };
  const [agg] = await Conversation.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        calls: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        success: { $sum: { $cond: [{ $eq: ["$callSuccessful", "success"] }, 1, 0] } },
        failure: { $sum: { $cond: [{ $eq: ["$callSuccessful", "failure"] }, 1, 0] } },
        secs: { $sum: { $ifNull: ["$durationSecs", 0] } },
        inbound: { $sum: { $cond: [{ $eq: ["$direction", "inbound"] }, 1, 0] } },
        outbound: { $sum: { $cond: [{ $eq: ["$direction", "outbound"] }, 1, 0] } },
        withData: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$zohoSync.updatedFields", []] } }, 0] }, 1, 0] } },
        pushed: { $sum: { $cond: [{ $ifNull: ["$zohoSync.pushedAt", false] }, 1, 0] } },
      },
    },
  ]);
  const calls = agg?.calls ?? 0;
  const prevRange: Range = { from: new Date(r.from.getTime() - (r.to.getTime() - r.from.getTime())), to: r.from, tz: r.tz };
  const [prev] = await Conversation.aggregate([{ $match: { workspaceId, channel: "voice", ...timeMatch(prevRange) } }, { $group: { _id: null, calls: { $sum: 1 }, secs: { $sum: { $ifNull: ["$durationSecs", 0] } } } }]);
  const [leadsTotal, leadsCalled, agents] = await Promise.all([
    Lead.countDocuments({ workspaceId }),
    Lead.countDocuments({ workspaceId, callCount: { $gt: 0 } }),
    Agent.countDocuments({ workspaceId }),
  ]);
  return {
    range: r,
    calls,
    completed: agg?.completed ?? 0,
    failed: agg?.failed ?? 0,
    successRate: calls ? Math.round(((agg?.success ?? 0) / calls) * 100) : 0,
    successCount: agg?.success ?? 0,
    failureCount: agg?.failure ?? 0,
    minutes: Math.round(((agg?.secs ?? 0) / 60) * 10) / 10,
    avgDurationSecs: calls ? Math.round((agg?.secs ?? 0) / calls) : 0,
    inbound: agg?.inbound ?? 0,
    outbound: agg?.outbound ?? 0,
    leadsUpdated: agg?.withData ?? 0,
    zohoPushed: agg?.pushed ?? 0,
    leadsTotal,
    leadsCalled,
    agents,
    previous: { calls: prev?.calls ?? 0, minutes: Math.round(((prev?.secs ?? 0) / 60) * 10) / 10 },
  };
}

export async function trends(workspaceId: string, r: Range) {
  const rows = await Conversation.aggregate([
    { $match: { workspaceId, channel: "voice", ...timeMatch(r) } },
    { $addFields: { day: { $dateToString: { format: "%Y-%m-%d", date: { $ifNull: ["$startedAt", "$createdAt"] }, timezone: r.tz } } } },
    {
      $group: {
        _id: "$day",
        calls: { $sum: 1 },
        minutes: { $sum: { $divide: [{ $ifNull: ["$durationSecs", 0] }, 60] } },
        success: { $sum: { $cond: [{ $eq: ["$callSuccessful", "success"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  // fill missing days
  const byDay = new Map(rows.map((x) => [x._id, x]));
  const out: { date: string; calls: number; minutes: number; success: number; failed: number }[] = [];
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: r.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  for (let d = new Date(r.from); d <= r.to; d = new Date(d.getTime() + 86400000)) {
    const key = dayKey(d);
    if (out.length && out[out.length - 1].date === key) continue;
    const row = byDay.get(key);
    out.push({ date: key, calls: row?.calls ?? 0, minutes: Math.round((row?.minutes ?? 0) * 10) / 10, success: row?.success ?? 0, failed: row?.failed ?? 0 });
  }
  return out;
}

export async function byAgent(workspaceId: string, r: Range) {
  const rows = await Conversation.aggregate([
    { $match: { workspaceId, channel: "voice", ...timeMatch(r) } },
    {
      $group: {
        _id: "$elevenAgentId",
        agentName: { $last: "$agentName" },
        calls: { $sum: 1 },
        minutes: { $sum: { $divide: [{ $ifNull: ["$durationSecs", 0] }, 60] } },
        success: { $sum: { $cond: [{ $eq: ["$callSuccessful", "success"] }, 1, 0] } },
        avgSecs: { $avg: { $ifNull: ["$durationSecs", 0] } },
      },
    },
    { $sort: { calls: -1 } },
  ]);
  const agents = await Agent.find({ workspaceId }, { elevenAgentId: 1, name: 1 });
  const names = new Map(agents.map((a) => [a.elevenAgentId, a.name]));
  return rows.map((x) => ({
    agentId: x._id,
    agentName: names.get(x._id) || x.agentName || x._id || "Unknown",
    calls: x.calls,
    minutes: Math.round(x.minutes * 10) / 10,
    successRate: x.calls ? Math.round((x.success / x.calls) * 100) : 0,
    avgDurationSecs: Math.round(x.avgSecs ?? 0),
  }));
}

export async function outcomes(workspaceId: string, r: Range) {
  const [byResult, byTermination, byDirection] = await Promise.all([
    Conversation.aggregate([{ $match: { workspaceId, channel: "voice", ...timeMatch(r) } }, { $group: { _id: { $ifNull: ["$callSuccessful", "unknown"] }, count: { $sum: 1 } } }]),
    Conversation.aggregate([{ $match: { workspaceId, channel: "voice", ...timeMatch(r) } }, { $group: { _id: { $ifNull: ["$terminationReason", "unknown"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Conversation.aggregate([{ $match: { workspaceId, channel: "voice", ...timeMatch(r) } }, { $group: { _id: { $ifNull: ["$direction", "unknown"] }, count: { $sum: 1 } } }]),
  ]);
  return {
    result: byResult.map((x) => ({ name: x._id, value: x.count })),
    termination: byTermination.map((x) => ({ name: x._id, value: x.count })),
    direction: byDirection.map((x) => ({ name: x._id, value: x.count })),
  };
}

export async function leadFunnel(workspaceId: string) {
  const [total, called, reached, qualified, byStatus] = await Promise.all([
    Lead.countDocuments({ workspaceId }),
    Lead.countDocuments({ workspaceId, callCount: { $gt: 0 } }),
    Lead.countDocuments({ workspaceId, lastCallStatus: "done" }),
    Lead.countDocuments({ workspaceId, lastCallOutcome: "success" }),
    Lead.aggregate([{ $match: { workspaceId } }, { $group: { _id: { $ifNull: ["$leadStatus", "—"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
  ]);
  return { total, called, reached, qualified, byStatus: byStatus.map((x) => ({ name: x._id, value: x.count })) };
}

export async function hourHeatmap(workspaceId: string, r: Range) {
  const rows = await Conversation.aggregate([
    { $match: { workspaceId, channel: "voice", ...timeMatch(r) } },
    { $addFields: { d: { $ifNull: ["$startedAt", "$createdAt"] } } },
    { $group: { _id: { dow: { $dayOfWeek: { date: "$d", timezone: r.tz } }, hour: { $hour: { date: "$d", timezone: r.tz } } }, count: { $sum: 1 } } },
  ]);
  return rows.map((x) => ({ dow: x._id.dow, hour: x._id.hour, count: x.count, tz: r.tz }));
}
