"use client";
import { useQuery } from "@tanstack/react-query";
import { Coins, Moon, Sun, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Usage } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tip } from "@/components/ui/tooltip";

function BalanceChip() {
  const { data } = useQuery({ queryKey: ["usage"], queryFn: () => api.get<Usage>("/usage"), staleTime: 5 * 60_000, retry: 0 });
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

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-end gap-2 bg-background/80 px-7 backdrop-blur">
      <BalanceChip />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex size-9 items-center justify-center rounded-full border border-border bg-card font-heading text-[15px] hover:bg-muted" aria-label="Account">
            A
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <div className="px-2 pb-2 text-sm">
            <div className="font-medium">Matrix × CandexAI</div>
            <div className="text-xs text-muted-foreground">default workspace</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/integrations">
              <User /> Integrations & settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <LogOut /> Sign out (coming soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
