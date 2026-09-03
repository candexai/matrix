import { Conversation } from "../models/Conversation";
import { elevenlabs } from "./elevenlabs/client";
import { upsertConversationFromRemote } from "./postCall.service";

/**
 * Pull recent conversations from ElevenLabs. This is the fallback path when the
 * post-call webhook cannot reach this server (e.g. no public URL in local dev).
 */
export async function syncConversations(workspaceId: string, opts: { agentId?: string; sinceHours?: number; max?: number } = {}) {
  const sinceHours = opts.sinceHours ?? 24 * 7;
  const max = opts.max ?? 200;
  const after = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  let cursor: string | undefined;
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (;;) {
    const page = await elevenlabs.listConversations({ agent_id: opts.agentId, cursor, call_start_after_unix: after, page_size: 100 });
    for (const summary of page.conversations) {
      scanned++;
      if (scanned > max) break;
      const existing = await Conversation.findOne({ elevenConversationId: summary.conversation_id }, { status: 1, transcript: 1, extraction: 1 });
      // Already complete locally → nothing to do. Everything else (new, in-progress, processing,
      // or done-but-empty) is (re)fetched so calls show up as soon as they start.
      if (existing && existing.status === "done" && (existing.transcript?.length ?? 0) > 0) {
        skipped++;
        continue;
      }
      try {
        const full = await elevenlabs.getConversation(summary.conversation_id);
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
  const full = await elevenlabs.getConversation(elevenConversationId);
  return upsertConversationFromRemote(workspaceId, full);
}
