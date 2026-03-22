"use client";

import { useState } from "react";

interface Ability {
  name: string;
  portion_dps: number;
  school: string;
  children?: Ability[];
}

interface ResultsChartProps {
  dps: number;
  dpsError: number;
  fightLength: number;
  playerName: string;
  playerClass: string;
  abilities: Ability[];
}

const SCHOOL_COLORS: Record<string, string> = {
  physical: "#D4A843",
  holy: "#F5E6A3",
  fire: "#EF6461",
  nature: "#6BCB77",
  frost: "#6CB4EE",
  shadow: "#B07CD8",
  arcane: "#E88AED",
};

function AbilityRow({ a, totalDps, maxDps, depth = 0 }: { a: Ability, totalDps: number, maxDps: number, depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = SCHOOL_COLORS[a.school] || SCHOOL_COLORS.physical;
  const pct = totalDps > 0 ? (a.portion_dps / totalDps) * 100 : 0;
  // Note: we base width on the top-level maxDps so child bars scale relative to the biggest parent attack
  const barWidth = maxDps > 0 ? (a.portion_dps / maxDps) * 100 : 0;
  const name = a.name.replace(/_/g, " ");
  const hasChildren = a.children && a.children.length > 0;

  return (
    <>
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`group relative flex items-center h-8 bg-surface-2 border border-border/50 rounded-md overflow-hidden ${hasChildren ? "cursor-pointer hover:bg-surface-3 transition-colors" : ""}`}
        style={{ marginLeft: `${depth * 1.5}rem` }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-opacity opacity-[0.25] group-hover:opacity-[0.35]"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: color }}
        />
        <span className="relative pl-3 text-[13px] font-medium text-gray-100 truncate flex-1 drop-shadow-md flex items-center gap-2" style={{ textTransform: 'capitalize' }}>
          {hasChildren && <span className="text-muted text-[10px] w-3 flex justify-center">{expanded ? "▼" : "▶"}</span>}
          {!hasChildren && depth > 0 && <span className="w-3" />}
          {name}
        </span>
        <span className="relative text-[12px] font-mono font-medium tabular-nums text-gray-300 w-16 text-right shrink-0 drop-shadow-md">
          {Math.round(a.portion_dps).toLocaleString()}
        </span>
        <span className="relative pr-3 text-[12px] font-mono font-medium tabular-nums text-gray-400 w-14 text-right shrink-0">
          {pct.toFixed(1)}%
        </span>
      </div>
      {expanded && hasChildren && a.children!.map((child, i) => (
        <AbilityRow key={i} a={child} totalDps={totalDps} maxDps={maxDps} depth={depth + 1} />
      ))}
    </>
  );
}

export default function ResultsChart({
  dps,
  dpsError,
  fightLength,
  playerName,
  playerClass,
  abilities,
}: ResultsChartProps) {
  const totalDps = dps || abilities.reduce((s, a) => s + a.portion_dps, 0);
  const maxDps = abilities.length > 0 ? abilities[0].portion_dps : 1;

  return (
    <div className="space-y-6">
      <div className="card p-8 text-center">
        <p className="text-xs text-muted mb-4">
          {playerName} &middot; {playerClass}
        </p>
        <p className="text-5xl font-bold text-white tabular-nums tracking-tight">
          {Math.round(dps).toLocaleString()}
        </p>
        <p className="text-xs text-muted mt-2 uppercase tracking-widest">DPS</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-600">
          <span>&plusmn; {Math.round(dpsError).toLocaleString()}</span>
          <span className="w-px h-3 bg-border" />
          <span>{fightLength}s fight</span>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-4">
          Damage Breakdown
        </h3>
        <div className="space-y-1">
          {abilities.map((a, i) => (
            <AbilityRow key={i} a={a} maxDps={maxDps} totalDps={totalDps} />
          ))}
        </div>
      </div>
    </div>
  );
}
