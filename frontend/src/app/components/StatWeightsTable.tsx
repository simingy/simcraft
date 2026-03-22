"use client";

interface StatWeightsTableProps {
  statWeights: Record<string, number>;
}

const STAT_DISPLAY_NAMES: Record<string, string> = {
  intellect: "Intellect",
  strength: "Strength",
  agility: "Agility",
  stamina: "Stamina",
  crit_rating: "Critical Strike",
  haste_rating: "Haste",
  mastery_rating: "Mastery",
  versatility_rating: "Versatility",
  weapon_dps: "Weapon DPS",
};

export default function StatWeightsTable({
  statWeights,
}: StatWeightsTableProps) {
  const entries = Object.entries(statWeights)
    .map(([key, value]) => ({
      stat: STAT_DISPLAY_NAMES[key] || key.replace(/_/g, " "),
      weight: value,
    }))
    .sort((a, b) => b.weight - a.weight);

  const maxWeight = entries.length > 0 ? entries[0].weight : 1;

  return (
    <div className="card p-5">
      <h3 className="text-xs font-medium text-muted uppercase tracking-widest mb-5">
        Stat Weights
      </h3>
      <div className="space-y-3">
        {entries.map(({ stat, weight }) => (
          <div key={stat}>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="text-gray-300">{stat}</span>
              <span className="text-white font-mono tabular-nums">
                {weight.toFixed(1)}
              </span>
            </div>
            <div className="w-full bg-bg rounded-full h-1 overflow-hidden">
              <div
                className="bg-gold/70 h-full rounded-full transition-all"
                style={{ width: `${(weight / maxWeight) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
