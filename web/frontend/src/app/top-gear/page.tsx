"use client";

import { useEffect, useRef, useState } from "react";
import { useSimContext } from "../components/SimContext";
import TopGearItemSelector from "../components/TopGearItemSelector";
import {
  ItemsBySlot,
  GEAR_SLOTS,
  parseAddonString,
  detectClass,
  classMaxArmor,
} from "../lib/parseAddonString";
import { API_URL } from "../lib/api";

export default function TopGearPage() {
  const { simcInput, fightStyle, threads } = useSimContext();
  const [itemsBySlot, setItemsBySlot] = useState<ItemsBySlot | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number[]>>(
    {}
  );
  const [maxUpgrade, setMaxUpgrade] = useState(false);
  const [copyEnchants, setCopyEnchants] = useState(true);
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
          items_by_slot: itemsBySlot,
          iterations: 10000,
          fight_style: fightStyle,
          target_error: 0.1,
          max_upgrade: maxUpgrade,
          copy_enchants: copyEnchants,
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

  if (!itemsBySlot) {
    return (
      <p className="text-sm text-muted text-center py-6">
        Paste your SimC addon export above to see gear options.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 flex flex-col sm:flex-row gap-4">
        <label className="flex items-center gap-3 cursor-pointer group flex-1">
          <div
            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
              copyEnchants ? "bg-gold" : "bg-surface-2 border border-border"
            }`}
            onClick={() => setCopyEnchants(!copyEnchants)}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                copyEnchants ? "left-[18px] bg-black" : "left-0.5 bg-gray-500"
              }`}
            />
          </div>
          <div>
            <span className="text-[13px] font-medium text-gray-300 group-hover:text-white transition-colors">
              Copy Enchants
            </span>
            <p className="text-[11px] text-gray-600">
              Apply equipped enchants to alternatives
            </p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer group flex-1">
          <div
            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
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
              Simulate all items at max upgrade level
            </p>
          </div>
        </label>
      </div>

      <TopGearItemSelector
        itemsBySlot={itemsBySlot}
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        onItemsChange={setItemsBySlot}
        maxUpgrade={maxUpgrade}
        maxArmorSubclass={classMaxArmor(detectClass(simcInput))}
      />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Starting sim…
          </>
        ) : "Find Top Gear"}
      </button>

      {/* Sticky side button */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="group fixed right-4 top-1/2 -translate-y-1/2 z-[90] btn-primary w-10 hover:w-auto py-2.5 px-2.5 hover:px-4 text-sm rounded-full hover:rounded-xl shadow-lg shadow-black/50 flex items-center gap-0 hover:gap-2 transition-all duration-200 overflow-hidden"
      >
        {submitting ? (
          <svg className="w-4 h-4 shrink-0 animate-spin" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2l10 6-10 6V2z" />
          </svg>
        )}
        <span className="whitespace-nowrap max-w-0 group-hover:max-w-[10rem] overflow-hidden transition-all duration-200 opacity-0 group-hover:opacity-100">
          {submitting ? "Starting sim…" : "Find Top Gear"}
        </span>
      </button>
    </div>
  );
}
