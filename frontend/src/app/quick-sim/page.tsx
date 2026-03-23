"use client";

import { useState } from "react";
import { useSimContext } from "../components/SimContext";
import { API_URL } from "../lib/api";

export default function QuickSimPage() {
  const { simcInput, fightStyle, threads, selectedTalent, targetCount, fightLength, customSimc } = useSimContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
          sim_type: "quick",
          desired_targets: targetCount,
          max_time: fightLength,
          threads,
          ...(selectedTalent ? { talents: selectedTalent } : {}),
          ...(customSimc ? { custom_simc: customSimc } : {}),
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
