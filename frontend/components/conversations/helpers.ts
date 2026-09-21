"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { BadgeProps } from "@/components/ui/badge";
import type { Conversation, ConversationProfile } from "@/lib/types";
import { titleCase } from "@/lib/utils";

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** Debounce a changing value (used for the search box → API). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Couldn't copy to clipboard");
  }
}

export function displayName(c: Pick<Conversation, "leadName" | "phone">): string {
  return c.leadName || c.phone || "Unknown caller";
}

/** Phone number formatted for reading: Indian numbers are grouped 5-5 ("+91 72300 88638"), anything else is returned as is. */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const compact = phone.replace(/[\s\-().]/g, "");
  const m = /^\+91(\d{5})(\d{5})$/.exec(compact);
  return m ? `+91 ${m[1]} ${m[2]}` : phone.trim();
}

/** True when a display string is really a phone number (so it gets a phone icon / phone formatting instead of initials). */
export function isPhoneLike(value?: string | null): boolean {
  const v = (value ?? "").trim();
  return v.length >= 5 && /^\+?[\d\s\-().]+$/.test(v);
}

const GENERIC_DISPLAY_NAMES = new Set(["web call", "unknown caller", "unknown"]);
/** True when the profile's display name is a person's name (a lead, or a name captured in a call) — not a phone number or a generic fallback. */
export function profileHasName(p: Pick<ConversationProfile, "kind" | "displayName">): boolean {
  const name = p.displayName.trim();
  if (!name) return false;
  if (p.kind === "lead") return !isPhoneLike(name);
  return !isPhoneLike(name) && !GENERIC_DISPLAY_NAMES.has(name.toLowerCase());
}

/** A name or a phone number, formatted for a heading. */
export function formatDisplayName(value: string): string {
  return isPhoneLike(value) ? formatPhone(value) : value;
}

export const isLive = (status?: Conversation["status"]) => status === "in_progress" || status === "initiated";

export function outcomeMeta(o?: Conversation["callSuccessful"] | null): { label: string; variant: BadgeVariant } {
  switch (o) {
    case "success":
      return { label: "Success", variant: "success" };
    case "failure":
      return { label: "Failed", variant: "destructive" };
    default:
      return { label: "Unknown", variant: "secondary" };
  }
}

export function statusMeta(s?: Conversation["status"]): { label: string; variant: BadgeVariant } {
  switch (s) {
    case "done":
      return { label: "Completed", variant: "outline" };
    case "in_progress":
      return { label: "Live", variant: "info" };
    case "initiated":
      return { label: "Ringing", variant: "warning" };
    case "processing":
      return { label: "Processing", variant: "warning" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    default:
      return { label: s ? titleCase(s) : "Unknown", variant: "secondary" };
  }
}

export function evaluationMeta(result?: string): BadgeVariant {
  const r = (result ?? "").toLowerCase();
  if (r === "success" || r === "pass" || r === "passed" || r === "true") return "success";
  if (r === "failure" || r === "fail" || r === "failed" || r === "false") return "destructive";
  return "secondary";
}

/** Human-readable rendering of an arbitrary collected value. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Best-effort name for an ElevenLabs tool call entry. */
export function toolCallName(t: unknown): string {
  if (typeof t === "string") return t;
  if (!t || typeof t !== "object") return "tool";
  const o = t as Record<string, unknown>;
  const name = o.tool_name ?? o.name ?? o.function_name ?? o.type;
  return typeof name === "string" && name ? name : "tool";
}
