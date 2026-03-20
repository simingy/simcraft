"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TopGearItemSelector from "../components/TopGearItemSelector";
import {
  ItemsBySlot,
  GEAR_SLOTS,
  parseAddonString,
} from "../lib/parseAddonString";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ITERATION_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000];

export default function TopGearPage() {
  const router = useRouter();
  const [simcInput, setSimcInput] = useState("");
  const [itemsBySlot, setItemsBySlot] = useState<ItemsBySlot | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number[]>>(
    {}
  );
  const [iterations, setIterations] = useState(3);
  const [fightStyle, setFightStyle] = useState("Patchwerk");
  const [targetError, setTargetError] = useState(0.1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const prevInputRef = useRef("");

  useEffect(() => {
    const trimmed = simcInput.trim();
    if (trimmed === prevInputRef.current) return;
    if (trimmed.length < 10) {
      setItemsBySlot(null);
      setSelectedItems({});
      prevInputRef.current = trimmed;
      return;
    }
    const timer = setTimeout(() => {
      prevInputRef.current = trimmed;
      const parsed = parseAddonString(simcInput);
      const hasAlternatives = GEAR_SLOTS.some(
        (slot) => parsed[slot] && parsed[slot].length > 1
      );
      if (!hasAlternatives && Object.keys(parsed).length === 0) {
        setItemsBySlot(null);
        setSelectedItems({});
        return;
      }
      setItemsBySlot(parsed);
      const autoSelected: Record<string, number[]> = {};
      for (const [slot, items] of Object.entries(parsed)) {
        autoSelected[slot] = items
          .map((item, idx) => (item.is_equipped ? idx : -1))
          .filter((idx) => idx >= 0);
      }
      setSelectedItems(autoSelected);
    }, 300);
    return () => clearTimeout(timer);
  }, [simcInput]);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/top-gear/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simc_input: simcInput,
          selected_items: selectedItems,
          iterations: ITERATION_STEPS[iterations],
          fight_style: fightStyle,
          target_error: targetError,
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
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Top Gear
        </h2>
        <p className="text-sm text-muted mt-1">
          Find your best gear combination from bags, bank, and vault.
        </p>
      </div>

      <div className="card p-5">
        <label className="label-text">SimC Addon Export</label>
        <textarea
          value={simcInput}
          onChange={(e) => setSimcInput(e.target.value)}
          placeholder="Paste your SimulationCraft addon export here…"
          className="input-field h-36 font-mono text-xs resize-y"
        />
      </div>

      {itemsBySlot && (
        <>
          <TopGearItemSelector
            itemsBySlot={itemsBySlot}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
          />

          <div className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm"
          >
            {submitting ? "Running…" : "Find Top Gear"}
          </button>
        </>
      )}
    </div>
  );
}
