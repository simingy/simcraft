"use client";

import React, { type ReactNode } from "react";
import { useSimContext } from "./SimContext";
import SidebarNav from "./SidebarNav";
import TopNavTiles from "./TopNavTiles";

export default function DynamicLayout({ children }: { children: ReactNode }) {
  const { navStyle } = useSimContext();

  return (
    <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
      {/* Sidebar Navigation */}
      {navStyle === "sidebar" && (
        <aside className="w-[260px] border-r border-border/50 shrink-0 hidden md:flex flex-col py-8 px-4">
          <SidebarNav />
        </aside>
      )}

      {/* Main Content Pane */}
      <main className={`flex-1 min-w-0 flex flex-col relative px-8 py-10 transition-all duration-300 ${
        navStyle === "top" ? "w-full" : ""
      }`}>
        <div className={`w-full mx-auto space-y-6 transition-all duration-300 ${
          navStyle === "top" ? "max-w-6xl" : "max-w-4xl"
        }`}>
          {navStyle === "top" && <TopNavTiles />}
          {children}
        </div>
      </main>
    </div>
  );
}
