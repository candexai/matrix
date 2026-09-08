"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/api";
import { DEFAULT_AFTER_AUTH } from "./safeNext";

/** Auth pages: send an already-signed-in visitor into the app. Returns true while that redirect is pending. */
export function useRedirectIfSignedIn(to: string = DEFAULT_AFTER_AUTH): boolean {
  const router = useRouter();
  const me = useMe();
  const signedIn = Boolean(me.data);
  useEffect(() => {
    if (signedIn) router.replace(to);
  }, [signedIn, to, router]);
  return signedIn;
}
