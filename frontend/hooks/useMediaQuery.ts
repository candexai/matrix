"use client";
import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe `window.matchMedia` subscription. The server (and the hydration pass) render `serverFallback`;
 * on the client the value is correct from the very first render, so there is no open → closed flash.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback
  );
}
