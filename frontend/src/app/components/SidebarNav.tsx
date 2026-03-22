"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "Results History",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v3.5L10 10" />
      </svg>
    ),
    matchPaths: ["/"],
  },
  {
    href: "/quick-sim",
    label: "Quick Sim",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8l-5 5-5-5M3 3h10" />
      </svg>
    ),
    matchPaths: ["/quick-sim"],
  },
  {
    href: "/top-gear",
    label: "Top Gear",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1l2 4 4.5.7-3.2 3.1.8 4.5L8 11l-4.1 2.3.8-4.5L1.5 5.7 6 5z" />
      </svg>
    ),
    matchPaths: ["/top-gear"],
  },
  {
    href: "/drop-finder",
    label: "Drop Finder",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
    ),
    matchPaths: ["/drop-finder"],
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 w-full">
      {navItems.map((item) => {
        const isActive = item.href === "/"
          ? (pathname === "/" || pathname.startsWith("/sim"))
          : item.matchPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? "bg-gold/10 text-gold font-medium"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
          >
            <div className={isActive ? "text-gold" : "text-gray-500"}>
              {item.icon}
            </div>
            <span className="text-[14px] leading-tight flex-1">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
