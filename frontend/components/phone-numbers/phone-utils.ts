import type { BadgeProps } from "@/components/ui/badge";
import type { PhoneNumber, SipTrunkConfig } from "@/lib/types";
import { titleCase } from "@/lib/utils";

export type BadgeVariant = NonNullable<BadgeProps["variant"]>;
export type Transport = NonNullable<SipTrunkConfig["transport"]>;
export type Encryption = NonNullable<SipTrunkConfig["media_encryption"]>;

export const TRANSPORT_OPTIONS: { value: Transport; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Let ElevenLabs negotiate" },
  { value: "udp", label: "UDP", description: "Port 5060, most carriers" },
  { value: "tcp", label: "TCP", description: "Port 5060, reliable signalling" },
  { value: "tls", label: "TLS", description: "Port 5061, encrypted signalling" },
];

export const ENCRYPTION_OPTIONS: { value: Encryption; label: string; description: string }[] = [
  { value: "disabled", label: "Disabled", description: "Plain RTP audio" },
  { value: "allowed", label: "Allowed", description: "SRTP when the peer supports it" },
  { value: "required", label: "Required", description: "SRTP only — reject unencrypted media" },
];

export function providerMeta(provider?: string | null): { label: string; variant: BadgeVariant } {
  switch (provider) {
    case "twilio":
      return { label: "Twilio", variant: "info" };
    case "sip_trunk":
      return { label: "SIP trunk", variant: "violet" };
    case "exotel":
      return { label: "Exotel", variant: "success" };
    default:
      return { label: provider ? titleCase(provider) : "Unknown", variant: "secondary" };
  }
}

export const isSipNumber = (n: Pick<PhoneNumber, "provider">): boolean => n.provider === "sip_trunk";

/** ElevenLabs returns the outbound trunk under `outbound_trunk` (new) or `provider_config` (older payloads). */
export const outboundConfig = (n: PhoneNumber): SipTrunkConfig | null => n.outbound_trunk ?? n.provider_config ?? null;

export const numberDisplay = (n: Pick<PhoneNumber, "label" | "phone_number">): string => (n.label ? `${n.label} · ${n.phone_number}` : n.phone_number);

/* ---------- phone number parsing ---------- */

export const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Strip spaces, dashes, dots and parentheses; turn a leading 00 into +. */
export function cleanPhoneInput(raw: string): string {
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return s;
}

export type DialParse = { ok: true; value: string; assumedCountry: boolean } | { ok: false; reason: string };

/**
 * Mirrors the backend's normalisation: E.164 as-is, a bare 10-digit number is
 * treated as Indian (+91), anything else is rejected with a reason.
 */
export function parseDialNumber(raw: string): DialParse {
  const s = cleanPhoneInput(raw);
  if (!s) return { ok: false, reason: "Enter a phone number." };
  if (E164_RE.test(s)) return { ok: true, value: s, assumedCountry: false };
  if (/^\d{10}$/.test(s)) return { ok: true, value: `+91${s}`, assumedCountry: true };
  if (!s.startsWith("+")) return { ok: false, reason: "Start with a country code, e.g. +91 or +1." };
  return { ok: false, reason: "Use international format: + followed by 7–15 digits." };
}

/** host, host:port, IPv4 or [IPv6] — no scheme, path or spaces. */
export const SIP_ADDRESS_RE = /^(?:\[[0-9a-f:]+\]|[a-z0-9][a-z0-9.-]*)(?::\d{1,5})?$/i;
export const isValidSipAddress = (s: string): boolean => SIP_ADDRESS_RE.test(s.trim());
