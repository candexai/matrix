/**
 * Stable categorical palette for conversation-insight tags.
 *
 * Each tag carries a `color` index assigned once by the backend (first free slot) and keeps it for
 * life, so a tag's hue never changes when the taxonomy is filtered, re-ranked or merged. The 12
 * slots are ordered so that adjacent slots stay distinguishable under colour-vision deficiency
 * (validated with the dataviz palette validator on the app's light `#ffffff` and dark `#111111`
 * card surfaces — all six checks pass: adjacent CVD ΔE 9.6 light / 11.9 dark, normal-vision ΔE 17.9 / 19.1,
 * every slot ≥ 3:1 contrast). Order: blue, green, magenta, orange, teal, brown, violet, gold, plum, lime, cyan, red.
 *
 * Colours are exposed as CSS custom properties (`--insight-tag-N`) so the same code path works in
 * light and dark themes; `InsightPaletteStyle` injects the variables once per page.
 */
import type { InsightCategory } from "@/lib/types";

export const TAG_PALETTE_SIZE = 12;

export const INSIGHT_TAG_PALETTE = {
  light: ["#2d69de", "#448502", "#b8338a", "#ab5803", "#068665", "#8d5406", "#854ece", "#a87f09", "#a53ead", "#7e8904", "#007e9f", "#c92f33"],
  dark: ["#568ef9", "#61a82d", "#d861aa", "#dc7100", "#15ab83", "#b66c00", "#a376e9", "#b88a01", "#c568cb", "#909c00", "#00a1cb", "#e8605b"],
} as const;

/** Loss-risk buckets (match the backend's 0 / .25 / .5 / .75 boundaries), green → red. */
export const RISK_PALETTE = {
  light: ["#15803d", "#b45309", "#ea580c", "#b91c1c"],
  dark: ["#22c55e", "#f59e0b", "#fb923c", "#ef4444"],
} as const;

const cssVars = (mode: "light" | "dark") =>
  [...INSIGHT_TAG_PALETTE[mode].map((hex, i) => `--insight-tag-${i}:${hex}`), ...RISK_PALETTE[mode].map((hex, i) => `--insight-risk-${i}:${hex}`)].join(";");

/** Injected once per page by `InsightPaletteStyle`. */
export const INSIGHT_PALETTE_CSS = [
  `:root,.light{${cssVars("light")}}`,
  `.dark{${cssVars("dark")}}`,
  "@keyframes insight-sheet-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}",
  ".insight-sheet{animation:insight-sheet-in .28s cubic-bezier(.16,1,.3,1) both}",
].join("\n");

/** Wrap any colour index onto the 12 palette slots. */
export const tagSlot = (color: number): number => ((Math.trunc(color) % TAG_PALETTE_SIZE) + TAG_PALETTE_SIZE) % TAG_PALETTE_SIZE;

/** CSS colour for a tag; unknown / retired tags fall back to the muted ink. */
export function tagColor(color?: number | null): string {
  if (color === null || color === undefined || !Number.isFinite(color)) return "var(--muted-foreground)";
  return `var(--insight-tag-${tagSlot(color)})`;
}

/** Translucent tint of a tag colour (chip backgrounds, hover washes). */
export const tagTint = (color: number | null | undefined, pct = 14): string => `color-mix(in srgb, ${tagColor(color)} ${pct}%, transparent)`;

// ---------- loss risk ----------
export const RISK_BUCKETS = [
  { key: "low", label: "Low", range: "0–25%" },
  { key: "medium", label: "Medium", range: "25–50%" },
  { key: "high", label: "High", range: "50–75%" },
  { key: "critical", label: "Critical", range: "75–100%" },
] as const;

export function riskBucket(risk?: number | null): number {
  if (risk === null || risk === undefined || !Number.isFinite(risk)) return 0;
  if (risk < 0.25) return 0;
  if (risk < 0.5) return 1;
  if (risk < 0.75) return 2;
  return 3;
}
export const riskColor = (risk?: number | null): string => `var(--insight-risk-${riskBucket(risk)})`;
export const riskLabel = (risk?: number | null): string => RISK_BUCKETS[riskBucket(risk)].label;
export const riskPct = (risk?: number | null): number => Math.round(Math.min(1, Math.max(0, risk ?? 0)) * 100);
/** Map a backend bucket label ("Critical (75–100%)") back to its index. */
export function riskBucketFromLabel(label: string): number {
  const i = RISK_BUCKETS.findIndex((b) => label.toLowerCase().startsWith(b.label.toLowerCase()));
  return i < 0 ? 0 : i;
}

// ---------- sentiment ----------
export type SentimentKey = "positive" | "neutral" | "negative";
export const SENTIMENTS: Record<SentimentKey, { label: string; color: string; variant: "success" | "secondary" | "destructive" }> = {
  positive: { label: "Positive", color: "var(--success)", variant: "success" },
  neutral: { label: "Neutral", color: "var(--muted-foreground)", variant: "secondary" },
  negative: { label: "Negative", color: "var(--destructive)", variant: "destructive" },
};
export const SENTIMENT_ORDER: SentimentKey[] = ["positive", "neutral", "negative"];
export function sentimentMeta(s?: string | null) {
  return SENTIMENTS[(s as SentimentKey) in SENTIMENTS ? (s as SentimentKey) : "neutral"];
}
export const formatScore = (n?: number | null): string => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}`);

// ---------- categories ----------
export const INSIGHT_CATEGORIES: InsightCategory[] = ["outcome", "sentiment", "objection", "intent", "topic", "action", "other"];
export const CATEGORY_META: Record<InsightCategory, { label: string; hint: string }> = {
  outcome: { label: "Outcome", hint: "How the call ended for the business" },
  sentiment: { label: "Sentiment", hint: "How the caller felt" },
  objection: { label: "Objection", hint: "A reason the lead pushed back" },
  intent: { label: "Intent", hint: "What the lead wants" },
  topic: { label: "Topic", hint: "A subject that came up" },
  action: { label: "Action", hint: "Something the team should do" },
  other: { label: "Other", hint: "Uncategorised" },
};
export const categoryLabel = (c?: string | null): string => CATEGORY_META[(c as InsightCategory) in CATEGORY_META ? (c as InsightCategory) : "other"].label;
