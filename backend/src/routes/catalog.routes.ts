import { Router } from "express";
import { asyncHandler, ok } from "../utils/http";
import * as catalog from "../constants/catalog";
import { elevenlabs } from "../services/elevenlabs/client";
import { DEFAULT_AGENT_CONFIG } from "../services/elevenlabs/configBuilder";

const router = Router();

router.get("/catalog", (_req, res) =>
  ok(res, {
    llmModels: catalog.LLM_MODELS,
    defaultLlm: catalog.DEFAULT_LLM,
    ttsModels: catalog.TTS_MODELS,
    defaultTtsModel: catalog.DEFAULT_TTS_MODEL,
    languages: catalog.LANGUAGES,
    asrProviders: catalog.ASR_PROVIDERS,
    turnModes: catalog.TURN_MODES,
    turnEagerness: catalog.TURN_EAGERNESS,
    audioFormats: catalog.AUDIO_FORMATS,
    builtInTools: catalog.BUILT_IN_TOOLS,
    dataCollectionTypes: catalog.DATA_COLLECTION_TYPES,
    webhookEvents: catalog.WEBHOOK_EVENTS,
    defaults: DEFAULT_AGENT_CONFIG,
  })
);

let voiceCache: { at: number; list: unknown[] } | null = null;
router.get("/voices", asyncHandler(async (req, res) => {
  if (!voiceCache || Date.now() - voiceCache.at > 10 * 60_000 || req.query.refresh === "1") {
    const voices = await elevenlabs.listVoices();
    voiceCache = {
      at: Date.now(),
      list: voices.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        description: v.description,
        preview_url: v.preview_url,
        labels: v.labels ?? {},
        languages: (v.verified_languages ?? []).map((l) => l.language),
      })),
    };
  }
  ok(res, voiceCache.list);
}));

router.get("/usage", asyncHandler(async (_req, res) => {
  if (!elevenlabs.configured) return ok(res, { configured: false });
  const s = await elevenlabs.getSubscription();
  const used = s.character_count ?? 0;
  const limit = s.character_limit ?? 0;
  ok(res, {
    configured: true,
    tier: s.tier,
    status: s.status,
    charactersUsed: used,
    charactersLimit: limit,
    charactersRemaining: Math.max(0, limit - used),
    // rough conversion used for the header pill: ~1000 characters ≈ 1 minute of conversational audio
    minutesRemaining: Math.max(0, Math.round((limit - used) / 1000)),
    resetsAt: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000) : null,
  });
}));

export default router;
