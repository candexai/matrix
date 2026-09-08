import { Agent } from "../models/Agent";
import { Conversation } from "../models/Conversation";
import { getElevenClient } from "./elevenlabs/registry";
import { upsertConversationFromRemote } from "./postCall.service";

/**
 * Pull recent conversations from the workspace's ElevenLabs account. This is the fallback path when
 * the post-call webhook cannot reach this server (e.g. no public URL in local dev).
 * Two Matrix workspaces may share one ElevenLabs account, so a conversation is only stored under
 * this workspace when its agent is not linked to a different workspace, and a conversation that
 * already belongs to another workspace is never re-homed.
 */
export async function syncConversations(workspaceId: string, opts: { agentId?: string; sinceHours?: number; max?: number } = {}) {
  const sinceHours = opts.sinceHours ?? 24 * 7;
  const max = opts.max ?? 200;
  const after = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  const eleven = await getElevenClient(workspaceId);
  let cursor: string | undefined;
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const agentOwner = new Map<string, string | null>();
  const ownerOf = async (elevenAgentId: string | undefined): Promise<string | null> => {
    if (!elevenAgentId) return null;
    if (!agentOwner.has(elevenAgentId)) {
      const a = await Agent.findOne({ elevenAgentId }, { workspaceId: 1 });
      agentOwner.set(elevenAgentId, a?.workspaceId ?? null);
    }
    return agentOwner.get(elevenAgentId) ?? null;
  };

  for (;;) {
    const page = await eleven.listConversations({ agent_id: opts.agentId, cursor, call_start_after_unix: after, page_size: 100 });
    for (const summary of page.conversations) {
      scanned++;
      if (scanned > max) break;
      const owner = await ownerOf(summary.agent_id);
      if (owner && owner !== workspaceId) {
        skipped++;
        continue;
      }
      const existing = await Conversation.findOne({ elevenConversationId: summary.conversation_id }, { workspaceId: 1, status: 1, transcript: 1, extraction: 1 });
      if (existing && existing.workspaceId !== workspaceId) {
        skipped++;
        continue;
      }
      // Already complete locally → nothing to do. Everything else (new, in-progress, processing,
      // or done-but-empty) is (re)fetched so calls show up as soon as they start.
      if (existing && existing.status === "done" && (existing.transcript?.length ?? 0) > 0) {
        skipped++;
        continue;
      }
      try {
        const full = await eleven.getConversation(summary.conversation_id);
        await upsertConversationFromRemote(workspaceId, full);
        upserted++;
      } catch (err) {
        errors.push(`${summary.conversation_id}: ${(err as Error).message}`);
      }
    }
    if (!page.has_more || !page.next_cursor || scanned >= max) break;
    cursor = page.next_cursor;
  }
  return { scanned, upserted, skipped, errors };
}

export async function refreshConversation(workspaceId: string, elevenConversationId: string) {
  const eleven = await getElevenClient(workspaceId);
  const full = await eleven.getConversation(elevenConversationId);
  return upsertConversationFromRemote(workspaceId, full);
}
