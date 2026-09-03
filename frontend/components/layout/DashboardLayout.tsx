"use client";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SidebarProvider, useSidebar } from "./SidebarContext";

function Frame({ children }: { children: ReactNode }) {
  const { width } = useSidebar();
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div style={{ marginLeft: width }} className="flex min-h-svh min-w-0 flex-1 flex-col transition-[margin] duration-200">
        <Header />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Frame>{children}</Frame>
      </SidebarProvider>
    </TooltipProvider>
  );
}
