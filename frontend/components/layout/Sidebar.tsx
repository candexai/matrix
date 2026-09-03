"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Table2, AudioWaveform, FlaskConical, BarChart3, Plug, Phone, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { Logo } from "./Logo";
import { Tip } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Conversations", href: "/conversations", icon: MessageSquare },
      { label: "My Leads", href: "/leads", icon: Table2 },
    ],
  },
  {
    label: "Automate",
    items: [
      { label: "Voice Agents", href: "/agents", icon: AudioWaveform },
      { label: "AI Test", href: "/test", icon: FlaskConical },
    ],
  },
  {
    label: "Insights",
    items: [{ label: "Analytics", href: "/analytics", icon: BarChart3 }],
  },
  {
    label: "Manage",
    items: [
      { label: "Phone Numbers", href: "/phone-numbers", icon: Phone },
      { label: "Integrations", href: "/integrations", icon: Plug },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, width } = useSidebar();

  return (
    <aside style={{ width }} className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200">
      <div className={cn("flex h-[72px] items-center", collapsed ? "justify-center px-0" : "px-5")}>
        <Link href="/conversations" className="flex items-center">
          <Logo compact={collapsed} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed ? <div className="mb-1.5 px-2 text-[11.5px] uppercase tracking-[0.09em] text-zinc-500">{group.label}</div> : <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg text-[15px] transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      active ? "border border-sidebar-border bg-card font-medium text-foreground shadow-xs" : "text-zinc-700 hover:bg-sidebar-accent dark:text-zinc-300"
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-zinc-500 group-hover:text-foreground")} strokeWidth={1.7} />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tip label={item.label} side="right">
                        {link}
                      </Tip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button type="button" onClick={toggle} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] text-zinc-700 transition-colors hover:bg-sidebar-accent dark:text-zinc-300", collapsed && "justify-center px-0")}>
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}
