export const DEFAULT_AFTER_AUTH = "/conversations";

/** Only allow same-origin relative paths as a post-login destination (no `//evil.com`, no auth-page loops). */
export function safeNext(raw: string | null | undefined, fallback = DEFAULT_AFTER_AUTH): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  const path = raw.split(/[?#]/, 1)[0];
  if (path === "/" || path === "/login" || path === "/signup") return fallback;
  return raw;
}
