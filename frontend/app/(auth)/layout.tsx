import type { ReactNode } from "react";
import { AudioWaveform, Sparkles, Table2, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { APP_FULL_NAME } from "@/lib/brand";

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: AudioWaveform, text: "ElevenLabs voice agents" },
  { icon: Table2, text: "Zoho CRM lead tables" },
  { icon: Sparkles, text: "AI insights after every call" },
];

/** Split auth layout: brand panel on the left (desktop only), centered form card on the right. No sidebar or header. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[440px] rounded-full brand-gradient opacity-[0.18] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[360px] rounded-full bg-primary/10 blur-3xl" />

        <Logo className="relative" />

        <div className="relative max-w-md">
          <p className="font-heading text-[34px] leading-[1.15] tracking-tight text-balance">Voice agents that call your CRM leads, fill the gaps and tell you what happened.</p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-zinc-700 dark:text-zinc-300">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-card shadow-xs">
                  <Icon className="size-4 text-primary" strokeWidth={1.8} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">{APP_FULL_NAME}</p>
      </aside>

      <div className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
