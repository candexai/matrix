"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
  width: number;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => undefined, width: 236 });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar:collapsed") === "1");
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar:collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }, []);
  return <Ctx.Provider value={{ collapsed, toggle, width: collapsed ? 64 : 236 }}>{children}</Ctx.Provider>;
}

export const useSidebar = () => useContext(Ctx);
