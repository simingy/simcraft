"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ITERATION_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000];

export default function SimForm() {
  const router = useRouter();
  const [simcInput, setSimcInput] = useState("");
  const [iterations, setIterations] = useState(3);
  const [fightStyle, setFightStyle] = useState("Patchwerk");
  const [targetError, setTargetError] = useState(0.1);
  const [simType, setSimType] = useState<"quick" | "stat_weights">("quick");
  const [maxUpgrade, setMaxUpgrade] = useState(false);
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
          iterations: ITERATION_STEPS[iterations],
          fight_style: fightStyle,
          target_error: targetError,
          sim_type: simType,
          max_upgrade: maxUpgrade,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      router.push(`/sim/${data.id}`);
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

      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Iterations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-gray-400">
                Iterations
              </label>
              <span className="text-xs font-mono bg-surface-2 border border-border px-2 py-0.5 rounded text-white tabular-nums">
                {ITERATION_STEPS[iterations].toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={ITERATION_STEPS.length - 1}
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>100</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Fight Style */}
          <div>
            <label className="text-[13px] font-medium text-gray-400 block mb-3">
              Fight Style
            </label>
            <select
              value={fightStyle}
              onChange={(e) => setFightStyle(e.target.value)}
              className="input-field"
            >
              <option value="Patchwerk">Patchwerk</option>
              <option value="HecticAddCleave">Hectic Add Cleave</option>
              <option value="LightMovement">Light Movement</option>
            </select>
          </div>

          {/* Target Error */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-medium text-gray-400">
                Target Error
              </label>
              <span className="text-xs font-mono bg-surface-2 border border-border px-2 py-0.5 rounded text-white tabular-nums">
                {targetError.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={targetError}
              onChange={(e) => setTargetError(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>Precise</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Sim Type */}
          <div>
            <label className="text-[13px] font-medium text-gray-400 block mb-3">
              Sim Type
            </label>
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
          </div>
        </div>

        <div className="border-t border-border/50 mt-5 pt-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={`w-9 h-5 rounded-full transition-colors relative ${
                maxUpgrade ? "bg-gold" : "bg-surface-2 border border-border"
              }`}
              onClick={() => setMaxUpgrade(!maxUpgrade)}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  maxUpgrade ? "left-[18px] bg-black" : "left-0.5 bg-gray-500"
                }`}
              />
            </div>
            <div>
              <span className="text-[13px] font-medium text-gray-300 group-hover:text-white transition-colors">
                Sim Highest Upgrade
              </span>
              <p className="text-[11px] text-gray-600">
                Simulate all items at their max upgrade level
              </p>
            </div>
          </label>
        </div>
      </div>

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
