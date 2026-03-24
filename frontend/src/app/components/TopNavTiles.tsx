"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/quick-sim",
    label: "Quick Sim",
    description: "Simulate your character as-is. Get DPS, ability breakdown, and stat weights.",
    icon: (
      <svg className="w-5 h-5 text-gold" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8l-5 5-5-5M3 3h10" />
      </svg>
    ),
  },
  {
    href: "/top-gear",
    label: "Top Gear",
    description: "Find the best gear combination from your bags, bank, and vault.",
    icon: (
      <svg className="w-5 h-5 text-gold" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1l2 4 4.5.7-3.2 3.1.8 4.5L8 11l-4.1 2.3.8-4.5L1.5 5.7 6 5z" />
      </svg>
    ),
  },
  {
    href: "/drop-finder",
    label: "Drop Finder",
    description: "Browse loot tables for raids and dungeons by slot.",
    icon: (
      <svg className="w-5 h-5 text-gold" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
    ),
  },
];

export default function TopNavTiles() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap justify-center gap-4 mb-12">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-start gap-4 w-full md:w-[300px] p-6 rounded-xl border transition-all duration-200 ${
              isActive 
                ? "bg-[#161618] border-gold/40 shadow-lg shadow-gold/5" 
                : "bg-[#111112] border-border/60 hover:border-gray-600 hover:bg-[#161618]"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
              isActive ? "bg-black border-gold/30" : "bg-black border-border group-hover:border-gold/20"
            }`}>
              {item.icon}
            </div>
            
            <div className="flex flex-col gap-1.5 min-w-0 pr-2">
              <h3 className={`font-bold text-[17px] leading-none transition-colors ${isActive ? "text-white" : "text-gray-200 group-hover:text-white"}`}>
                {item.label}
              </h3>
              <p className="text-[13px] text-gray-500 leading-relaxed font-medium group-hover:text-gray-400 transition-colors">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
