"use client";
import { useEffect, useState } from "react";
import type { Lead, LeadList, PhoneNumber } from "@/lib/types";
import type { BadgeProps } from "@/components/ui/badge";
import { formatDateTime, titleCase } from "@/lib/utils";

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** Id of the synthetic "All leads" table. */
export const ALL_LIST_ID = "all";
/** True for a persisted list id (Zoho view or manual list) — false for the synthetic "all" table. */
export const isRealListId = (id?: string | null): id is string => Boolean(id && id !== ALL_LIST_ID);

/** Local prop → Zoho Leads api_name (mirrors backend STANDARD_TO_ZOHO). */
export const STANDARD_TO_ZOHO = {
  firstName: "First_Name",
  lastName: "Last_Name",
  email: "Email",
  phone: "Phone",
  mobile: "Mobile",
  company: "Company",
  title: "Designation",
  leadStatus: "Lead_Status",
  leadSource: "Lead_Source",
  city: "City",
  state: "State",
  country: "Country",
  industry: "Industry",
  website: "Website",
  description: "Description",
  rating: "Rating",
} as const;

export type StandardKey = keyof typeof STANDARD_TO_ZOHO;
export const STANDARD_KEYS = Object.keys(STANDARD_TO_ZOHO) as StandardKey[];
const ZOHO_TO_STANDARD: Record<string, StandardKey> = Object.fromEntries(Object.entries(STANDARD_TO_ZOHO).map(([k, v]) => [v, k as StandardKey]));

/** View columns already covered by the fixed leading cells (Name / Phone / Email). */
export const FIXED_LEAD_COLUMNS = new Set(["First_Name", "Last_Name", "Full_Name", "Phone", "Email"]);
/** View columns that are identity/status fields — not something the agent should collect. */
export const NON_COLLECTABLE_COLUMNS = new Set(["First_Name", "Last_Name", "Email", "Phone", "Full_Name", "Lead_Status", "Lead_Source"]);

export function statusVariant(status?: string | null): BadgeVariant {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "outline";
  if (/^not contacted|^new\b|^open\b/.test(s)) return "secondary";
  if (/junk|lost|not qualified|unqualified|dead|closed|spam|do not/.test(s)) return "destructive";
  if (/qualified|converted|won|interested|hot/.test(s)) return "success";
  if (/pre[- ]?qual|nurtur|warm|future|attempt/.test(s)) return "warning";
  if (/contact|progress|working|follow|call/.test(s)) return "info";
  return "secondary";
}

export function outcomeVariant(outcome?: string | null): BadgeVariant {
  if (outcome === "success") return "success";
  if (outcome === "failure") return "destructive";
  return "secondary";
}

export function outcomeLabel(outcome?: string | null): string {
  if (outcome === "success") return "Success";
  if (outcome === "failure") return "Failed";
  return "Unknown";
}

export function callStatusVariant(status?: string | null): BadgeVariant {
  switch (status) {
    case "initiated":
    case "queued":
    case "in_progress":
      return "info";
    case "processing":
      return "warning";
    case "failed":
      return "destructive";
    case "done":
      return "success";
    default:
      return "secondary";
  }
}

export function sourceLabel(source: Lead["source"]): string {
  if (source === "zoho") return "Zoho";
  if (source === "csv") return "CSV";
  return "Manual";
}

export function listSourceLabel(source: LeadList["source"]): string {
  if (source === "zoho") return "Zoho view";
  if (source === "all") return "All leads";
  return "Manual";
}

const CATEGORY_LABELS: Record<string, string> = {
  public_views: "Public views",
  created_by_me: "Created by me",
  shared_with_me: "Shared with me",
  favourite: "Favorites",
  favourites: "Favorites",
  favorite: "Favorites",
  favorites: "Favorites",
  system_defined: "System views",
  other_users: "Other users' views",
};

/** Zoho custom-view category (public_views / created_by_me / …) → human label. */
export function categoryLabel(category?: string | null): string {
  const c = (category ?? "").trim().toLowerCase();
  if (!c) return "";
  return CATEGORY_LABELS[c] ?? titleCase(c);
}

/** Best-effort deep link to the Zoho CRM record; data-center TLD derived from the accounts URL when known. */
export function zohoLeadUrl(zohoId: string, accountsUrl?: string | null): string {
  let tld = "com";
  try {
    if (accountsUrl) {
      const host = new URL(accountsUrl).hostname; // accounts.zoho.in → in
      const m = host.match(/zoho\.([a-z.]+)$/i);
      if (m) tld = m[1];
    }
  } catch {}
  return `https://crm.zoho.${tld}/crm/tab/Leads/${encodeURIComponent(zohoId)}`;
}

export function phoneLabel(n?: PhoneNumber | null): string {
  if (!n) return "";
  return n.label ? `${n.label} · ${n.phone_number}` : n.phone_number;
}

export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function displayValue(v: unknown): string {
  if (isEmptyValue(v)) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => displayValue(x)).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const NUMERIC_TYPES = /integer|bigint|double|currency|decimal|percent|number/i;
export const isNumericType = (dataType?: string | null): boolean => NUMERIC_TYPES.test(dataType ?? "");

/** Value of a Zoho column for a lead: raw `fields[api_name]` first, falling back to the mirrored standard prop. */
export function leadFieldValue(lead: Lead, apiName: string): unknown {
  const raw = lead.fields?.[apiName];
  if (!isEmptyValue(raw)) return raw;
  const std = ZOHO_TO_STANDARD[apiName];
  if (std) return lead[std];
  return raw;
}

/** Render a Zoho field value according to its data_type (dates, booleans, numbers, lookups…). */
export function formatFieldValue(v: unknown, dataType?: string | null): string {
  if (isEmptyValue(v)) return "—";
  const t = (dataType ?? "").toLowerCase();
  if (t === "date") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  if (t === "datetime") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : formatDateTime(d);
  }
  if (t === "boolean" || typeof v === "boolean") {
    if (typeof v === "string") return /^(true|yes|1)$/i.test(v) ? "Yes" : "No";
    return v ? "Yes" : "No";
  }
  if (isNumericType(t) && (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))))) {
    const n = Number(v);
    const opts: Intl.NumberFormatOptions = t.includes("percent") ? { maximumFractionDigits: 2 } : { maximumFractionDigits: /integer|bigint/.test(t) ? 0 : 2 };
    return new Intl.NumberFormat("en-IN", opts).format(n) + (t.includes("percent") ? "%" : "");
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const inner = o.name ?? o.display_value ?? o.full_name ?? o.value ?? o.id;
    return inner !== undefined ? String(inner) : displayValue(v);
  }
  return displayValue(v);
}

export function extractionProviderLabel(p?: string | null): string {
  const s = (p ?? "").toLowerCase();
  if (!s) return "AI";
  if (s.includes("openai")) return "OpenAI";
  if (s.includes("anthropic") || s.includes("claude")) return "Anthropic";
  if (s.includes("eleven")) return "ElevenLabs";
  return titleCase(s);
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}
