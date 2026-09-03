/** Best-effort E.164 normalisation. Returns null when the input has no usable digits. */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "91"): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  s = s.replace(/[^\d]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = s.slice(2);
  if (hasPlus) return `+${s}`;
  if (s.length === 10) return `+${defaultCountryCode}${s}`;
  if (s.length > 10) return `+${s}`;
  return null;
}

export function phoneKey(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? n.replace(/\D/g, "").slice(-10) : null;
}
