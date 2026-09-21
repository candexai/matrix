/**
 * White-label naming. The product is "Pilot"; the voice/AI engine behind it is presented as
 * "Candex" / "Candex AI" — upstream vendor and model names must never reach the UI.
 */
import { TTS_MODELS } from "../constants/catalog";

export const APP_NAME = "Pilot";
export const VOICE_VENDOR = "Candex";
export const VOICE_MODEL_FALLBACK = "Candex AI";
/** Workspace names older releases used as the "not customised yet" default. */
export const LEGACY_DEFAULT_WORKSPACE_NAMES = ["Matrix", APP_NAME];

/** Rewrites vendor / model names in a user-facing message (errors proxied from the voice API, etc.). */
export function brandSafe(message: string): string {
  if (!message) return message;
  return message
    .replace(/\beleven_[a-z0-9_]+\b/gi, (id) => TTS_MODELS.find((m) => m.value === id.toLowerCase())?.label ?? VOICE_MODEL_FALLBACK)
    .replace(/https?:\/\/[^\s)"']*elevenlabs\.io[^\s)"']*/gi, "the voice API")
    .replace(/\b[a-z0-9.-]*elevenlabs\.io\b/gi, "the voice API")
    .replace(/eleven\s*labs/gi, VOICE_VENDOR)
    .replace(/\bxi-api-key\b/gi, "API key");
}
