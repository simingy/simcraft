"use client";

import { useState } from "react";
import { API_URL } from "../lib/api";
import FightStyleSelector from "./FightStyleSelector";
import ThreadPresetSelector from "./ThreadPresetSelector";

export default function SimForm() {
  const [simcInput, setSimcInput] = useState("");
  const [simType, setSimType] = useState<"quick" | "stat_weights">("quick");
  const [fightStyle, setFightStyle] = useState("Patchwerk");
  const [threads, setThreads] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const detectedInfo = parseCharacterInfo(simcInput);

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
          threads,
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
      <div className="card p-5 space-y-3">
        <label className="label-text">SimC Addon Export</label>
        <textarea
          value={simcInput}
          onChange={(e) => setSimcInput(e.target.value)}
          placeholder="Paste your SimC addon export here…"
          className="input-field h-52 font-mono text-xs resize-y"
        />
        {detectedInfo && (
          <p className="text-xs text-gold">
            {detectedInfo.name} &middot; {detectedInfo.spec}{" "}
            {detectedInfo.className}
          </p>
        )}
      </div>

      <FightStyleSelector value={fightStyle} onChange={setFightStyle} />

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

      <ThreadPresetSelector value={threads} onChange={setThreads} />

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

function parseCharacterInfo(input: string) {
  if (!input) return null;
  const nameMatch = input.match(/^(\w+)="(.+)"$/m);
  const specMatch = input.match(/^spec=(\w+)/m);
  if (!nameMatch) return null;
  return {
    className: nameMatch[1],
    name: nameMatch[2],
    spec: specMatch?.[1] || "unknown",
  };
}
