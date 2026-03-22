"use client";

import React, { useState } from "react";
import { useSimContext } from "../components/SimContext";
import { API_URL } from "../lib/api";

export default function QuickSimPage() {
  const { simcInput, fightStyle, threads, selectedTalent } = useSimContext();
  const [simType, setSimType] = useState<"quick" | "stat_weights">("quick");
  const [selectedStats, setSelectedStats] = useState<string[]>(["crit", "haste", "mastery", "vers"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const STAT_OPTIONS = [
    { id: "intellect", label: "Intellect" },
    { id: "strength", label: "Strength" },
    { id: "agility", label: "Agility" },
    { id: "crit", label: "Crit" },
    { id: "haste", label: "Haste" },
    { id: "mastery", label: "Mastery" },
    { id: "vers", label: "Versatility" },
    { id: "weapon_dps", label: "Weapon DPS" },
    { id: "weapon_offhand_dps", label: "Offhand DPS" },
  ];

  function toggleStat(id: string) {
    setSelectedStats((prev: string[]) =>
      prev.includes(id) ? prev.filter((s: string) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (simcInput.trim().length < 10) {
      setError("SimC input is too short. Paste your full addon export.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simc_input: simcInput,
          iterations: 10000,
          fight_style: fightStyle,
          target_error: 0.1,
          sim_type: simType,
          stat_weights: simType === "stat_weights" ? selectedStats : undefined,
          threads,
          ...(selectedTalent ? { talents: selectedTalent } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      window.location.href = `/sim/${data.id}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit sim");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-2">
        {(["quick", "stat_weights"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSimType(t)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-[13px] font-medium transition-all border ${
              simType === t
                ? "bg-white text-black border-white"
                : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
            }`}
          >
            {t === "quick" ? "Quick Sim" : "Stat Weights"}
          </button>
        ))}
      </div>

      {simType === "stat_weights" && (
        <div className="bg-surface-2 border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-[13px] font-medium text-gray-200">Stats to Weight</h3>
          <div className="grid grid-cols-3 gap-2">
            {STAT_OPTIONS.map((stat) => (
              <label
                key={stat.id}
                className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStats.includes(stat.id)}
                  onChange={() => toggleStat(stat.id)}
                  className="rounded border-border bg-surface text-gold focus:ring-gold focus:ring-offset-surface-2"
                />
                {stat.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || simcInput.trim().length < 10}
        className="btn-primary w-full py-3 text-sm"
      >
        {submitting ? "Running…" : "Run Simulation"}
      </button>
    </form>
  );
}
