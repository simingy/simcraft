"use client";

interface Ability {
  name: string;
  portion_dps: number;
  school: string;
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

export default function ResultsChart({
  dps,
  dpsError,
  fightLength,
  playerName,
  playerClass,
  abilities,
}: ResultsChartProps) {
  const totalDps = dps || abilities.reduce((s, a) => s + a.portion_dps, 0);
  const top = abilities.slice(0, 15);
  const maxDps = top.length > 0 ? top[0].portion_dps : 1;

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
          {top.map((a, i) => {
            const color = SCHOOL_COLORS[a.school] || SCHOOL_COLORS.physical;
            const pct = totalDps > 0 ? (a.portion_dps / totalDps) * 100 : 0;
            const barWidth = maxDps > 0 ? (a.portion_dps / maxDps) * 100 : 0;
            const name = a.name.replace(/_/g, " ");

            return (
              <div
                key={i}
                className="group relative flex items-center h-8 bg-surface-2 border border-border/50 rounded-md overflow-hidden"
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 transition-opacity opacity-[0.25] group-hover:opacity-[0.35]"
                  style={{ width: `${barWidth}%`, backgroundColor: color }}
                />
                {/* Left edge accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: color }}
                />
                {/* Content */}
                <span className="relative pl-3 text-[13px] font-medium text-gray-100 truncate flex-1 drop-shadow-md">
                  {name}
                </span>
                <span className="relative text-[12px] font-mono font-medium tabular-nums text-gray-300 w-16 text-right shrink-0 drop-shadow-md">
                  {Math.round(a.portion_dps).toLocaleString()}
                </span>
                <span className="relative pr-3 text-[12px] font-mono font-medium tabular-nums text-gray-400 w-14 text-right shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
