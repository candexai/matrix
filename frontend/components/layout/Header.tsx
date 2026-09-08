"use client";
import { useQuery } from "@tanstack/react-query";
import { Coins, KeyRound, LogOut, Moon, Settings2, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Usage } from "@/lib/types";
import { formatNumber, initials, titleCase } from "@/lib/utils";
import { useLogout, useMe } from "@/hooks/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tip } from "@/components/ui/tooltip";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";
import { isElevenNotConfigured } from "@/components/integrations/ElevenLabsRequired";

function BalanceChip() {
  const { data, error } = useQuery({ queryKey: ["usage"], queryFn: () => api.get<Usage>("/usage"), staleTime: 5 * 60_000, retry: 0 });
  // Workspace without its own ElevenLabs key: the 409 is expected — render nothing (Integrations has the connect flow).
  if (isElevenNotConfigured(error)) return null;
  if (!data?.configured) {
    return (
      <Link href="/integrations" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13.5px] text-muted-foreground hover:bg-muted">
        <Coins className="size-4 text-primary" />
        Connect ElevenLabs
      </Link>
    );
  }
  return (
    <Tip label={`${formatNumber(data.charactersUsed)} / ${formatNumber(data.charactersLimit)} characters used · ${data.tier ?? ""} plan`}>
      <Link href="/analytics" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13.5px] hover:bg-muted">
        <Coins className="size-4 text-primary" />
        <span className="text-muted-foreground">Balance:</span>
        <span className="font-medium">{formatNumber(data.minutesRemaining)} min</span>
      </Link>
    </Tip>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <Tip label={dark ? "Light mode" : "Dark mode"}>
      <button type="button" onClick={toggle} className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted">
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </Tip>
  );
}

function AccountMenu() {
  const me = useMe();
  const logout = useLogout();
  const [pwOpen, setPwOpen] = useState(false);

  // Right after login/signup the cached `me` carries an empty workspace name — fetch the real one once.
  const refreshed = useRef(false);
  const { data, refetch } = me;
  useEffect(() => {
    if (data && !data.workspace.name && !refreshed.current) {
      refreshed.current = true;
      void refetch();
    }
  }, [data, refetch]);

  if (!data) return <Skeleton className="size-9 rounded-full" />;
  const { user, workspace } = data;
  const avatar = initials(user.name);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Account menu" className="flex size-9 items-center justify-center rounded-full border border-border bg-card font-heading text-[14px] hover:bg-muted">
            {avatar}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full brand-gradient font-heading text-[14px] text-white">{avatar}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <span className="truncate text-sm">{workspace.name || "Your workspace"}</span>
            <Badge variant={user.role === "owner" ? "soft" : "secondary"}>{titleCase(user.role)}</Badge>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRound /> Change password
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/integrations">
              <Settings2 /> Integrations & settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive disabled={logout.isPending} onSelect={() => logout.mutate()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}

export function Header() {
  const me = useMe();
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-end gap-2 bg-background/80 px-7 backdrop-blur">
      {/* Only poll usage once we know there's a session — avoids a stray 401 redirect racing the auth gate. */}
      {me.data ? <BalanceChip /> : null}
      <ThemeToggle />
      <AccountMenu />
    </header>
  );
}
