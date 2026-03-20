"use client";

import { usePathname } from "next/navigation";

const simTypes = [
  {
    href: "/quick-sim",
    label: "Quick Sim",
    description: "Simulate your character as-is. Get DPS, ability breakdown, and stat weights.",
    icon: (
      <svg className="w-5 h-5 text-gold" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8l-5 5-5-5M3 3h10" />
      </svg>
    ),
    matchPaths: ["/quick-sim", "/sim"],
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
    matchPaths: ["/top-gear"],
  },
];

export default function SimTypeCards() {
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      {simTypes.map((sim) => {
        const isActive = sim.matchPaths.some(
          (p) => pathname === p || pathname.startsWith(p + "/")
        );
        return (
          <a
            key={sim.href}
            href={sim.href}
            className={`card p-4 group transition-all ${
              isActive
                ? "border-gold/50 bg-gold/[0.03]"
                : "hover:border-gold/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isActive ? "bg-gold/20" : "bg-gold/10"
              }`}>
                {sim.icon}
              </div>
              <div>
                <h2 className={`text-[15px] font-semibold transition-colors ${
                  isActive ? "text-gold" : "text-white group-hover:text-gold"
                }`}>
                  {sim.label}
                </h2>
                <p className="text-[11px] text-muted hidden sm:block">
                  {sim.description}
                </p>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
