"use client";

import { useMemo } from "react";
import { ItemsBySlot, ParsedItem, GEAR_SLOTS } from "../lib/parseAddonString";
import { useItemInfo, useEnchantInfo, getIconUrl, getWowheadUrl, getWowheadData, QUALITY_COLORS } from "../lib/useItemInfo";
import type { ItemQuery } from "../lib/useItemInfo";
import { useWowheadTooltips } from "../lib/useWowheadTooltips";

interface TopGearItemSelectorProps {
  itemsBySlot: ItemsBySlot;
  selectedItems: Record<string, number[]>;
  onSelectionChange: (selected: Record<string, number[]>) => void;
}

interface DisplayGroup {
  label: string;
  slots: string[];
}

const DISPLAY_GROUPS: DisplayGroup[] = [
  { label: "Head", slots: ["head"] },
  { label: "Neck", slots: ["neck"] },
  { label: "Shoulder", slots: ["shoulder"] },
  { label: "Back", slots: ["back"] },
  { label: "Chest", slots: ["chest"] },
  { label: "Wrist", slots: ["wrist"] },
  { label: "Hands", slots: ["hands"] },
  { label: "Waist", slots: ["waist"] },
  { label: "Legs", slots: ["legs"] },
  { label: "Feet", slots: ["feet"] },
  { label: "Rings", slots: ["finger1", "finger2"] },
  { label: "Trinkets", slots: ["trinket1", "trinket2"] },
  { label: "Main Hand", slots: ["main_hand"] },
  { label: "Off Hand", slots: ["off_hand"] },
];

interface DisplayItem {
  item: ParsedItem;
  slot: string;
  index: number;
  slotLabel?: string;
}

export default function TopGearItemSelector({
  itemsBySlot,
  selectedItems,
  onSelectionChange,
}: TopGearItemSelectorProps) {
  const allItemQueries = useMemo(() => {
    const seen = new Set<string>();
    const queries: ItemQuery[] = [];
    for (const items of Object.values(itemsBySlot)) {
      for (const item of items) {
        if (item.item_id <= 0) continue;
        const key = `${item.item_id}:${(item.bonus_ids || []).sort().join(":")}`;
        if (!seen.has(key)) {
          seen.add(key);
          queries.push({ item_id: item.item_id, bonus_ids: item.bonus_ids });
        }
      }
    }
    return queries;
  }, [itemsBySlot]);

  const itemInfoMap = useItemInfo(allItemQueries);

  const allEnchantIds = useMemo(() => {
    const ids = new Set<number>();
    for (const items of Object.values(itemsBySlot)) {
      for (const item of items) {
        if (item.enchant_id > 0) ids.add(item.enchant_id);
      }
    }
    return [...ids];
  }, [itemsBySlot]);

  const enchantInfoMap = useEnchantInfo(allEnchantIds);
  useWowheadTooltips([itemInfoMap]);

  const getIlevel = (di: DisplayItem) => {
    const info = di.item.item_id > 0 ? itemInfoMap[di.item.item_id] : null;
    return di.item.ilevel || info?.ilevel || 0;
  };

  const visibleGroups = useMemo(() => {
    const result: {
      group: DisplayGroup;
      equipped: DisplayItem[];
      alternatives: DisplayItem[];
    }[] = [];
    for (const group of DISPLAY_GROUPS) {
      const equipped: DisplayItem[] = [];
      const alternatives: DisplayItem[] = [];
      const seenAltIds = new Set<number>();
      for (let si = 0; si < group.slots.length; si++) {
        const slot = group.slots[si];
        const items = itemsBySlot[slot];
        if (!items) continue;
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          if (item.is_equipped) {
            equipped.push({
              item,
              slot,
              index: idx,
              slotLabel:
                group.slots.length > 1 ? `Slot ${si + 1}` : undefined,
            });
          } else {
            if (item.item_id && seenAltIds.has(item.item_id)) continue;
            if (item.item_id) seenAltIds.add(item.item_id);
            alternatives.push({ item, slot, index: idx });
          }
        }
      }
      if (alternatives.length > 0) {
        equipped.sort((a, b) => getIlevel(b) - getIlevel(a));
        alternatives.sort((a, b) => getIlevel(b) - getIlevel(a));
        result.push({ group, equipped, alternatives });
      }
    }
    return result;
  }, [itemsBySlot, itemInfoMap]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleItem(displayItem: DisplayItem, group: DisplayGroup) {
    const updated = { ...selectedItems };
    if (group.slots.length === 1) {
      const slot = displayItem.slot;
      const current = updated[slot] || [];
      updated[slot] = current.includes(displayItem.index)
        ? current.filter((i) => i !== displayItem.index)
        : [...current, displayItem.index];
    } else {
      const itemId = displayItem.item.item_id;
      const isCurrentlySelected = group.slots.some((slot) => {
        const items = itemsBySlot[slot];
        if (!items) return false;
        const idx = items.findIndex(
          (it) => !it.is_equipped && it.item_id === itemId
        );
        return idx >= 0 && (updated[slot] || []).includes(idx);
      });
      for (const slot of group.slots) {
        const items = itemsBySlot[slot];
        if (!items) continue;
        const idx = items.findIndex(
          (it) => !it.is_equipped && it.item_id === itemId
        );
        if (idx < 0) continue;
        const current = updated[slot] || [];
        if (isCurrentlySelected) {
          updated[slot] = current.filter((i) => i !== idx);
        } else if (!current.includes(idx)) {
          updated[slot] = [...current, idx];
        }
      }
    }
    onSelectionChange(updated);
  }

  function isItemSelected(
    displayItem: DisplayItem,
    group: DisplayGroup
  ): boolean {
    if (group.slots.length === 1) {
      return (selectedItems[displayItem.slot] || []).includes(
        displayItem.index
      );
    }
    return group.slots.some((slot) => {
      const items = itemsBySlot[slot];
      if (!items) return false;
      const idx = items.findIndex(
        (it) => !it.is_equipped && it.item_id === displayItem.item.item_id
      );
      return idx >= 0 && (selectedItems[slot] || []).includes(idx);
    });
  }

  const comboCount = calculateCombinations(itemsBySlot, selectedItems);

  if (visibleGroups.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-muted">
          No alternative items found. Make sure your SimC addon exports bag
          items.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted uppercase tracking-widest">
          Select Items
        </p>
        <span
          className={`text-xs font-mono px-2.5 py-1 rounded-md ${
            comboCount > 500
              ? "bg-red-500/10 text-red-400"
              : comboCount > 0
              ? "bg-surface-2 text-white"
              : "bg-surface-2 text-muted"
          }`}
        >
          {comboCount.toLocaleString()} combo{comboCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleGroups.map(({ group, equipped, alternatives }) => (
          <div key={group.label} className="card p-3.5 space-y-1">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">
              {group.label}
            </p>

            {equipped.map((di, eqIdx) => {
              const info =
                di.item.item_id > 0 ? itemInfoMap[di.item.item_id] : null;
              const qc = info
                ? QUALITY_COLORS[info.quality] || "#fff"
                : "#fff";
              const name =
                info?.name || di.item.name || `Item ${di.item.item_id}`;
              const icon = info?.icon || "inv_misc_questionmark";

              return (
                <div
                  key={`eq-${eqIdx}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03]"
                >
                  <div className="w-4 h-4 rounded-[3px] bg-white/10 flex items-center justify-center shrink-0">
                    <svg
                      className="w-2.5 h-2.5 text-white/40"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M12 5L6.5 10.5L4 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="w-6 h-6 shrink-0 rounded overflow-hidden ring-1 ring-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getIconUrl(icon)}
                      alt=""
                      width={24}
                      height={24}
                      className="w-full h-full"
                      loading="lazy"
                    />
                  </div>
                  <a
                    href={di.item.item_id > 0 ? getWowheadUrl(di.item.item_id) : undefined}
                    data-wowhead={di.item.item_id > 0 ? getWowheadData(di.item.bonus_ids, di.item.ilevel, di.item.enchant_id) : undefined}
                    className="text-[12px] truncate flex-1 no-underline"
                    style={{ color: qc }}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.preventDefault()}
                  >
                    {name}
                  </a>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {di.item.enchant_id > 0 && (
                      <span className="text-[9px] text-emerald-400/70 max-w-[80px] truncate" title={enchantInfoMap[di.item.enchant_id]?.name || ""}>
                        {enchantInfoMap[di.item.enchant_id]?.name || "Enchanted"}
                      </span>
                    )}
                    <span className="text-[10px] text-muted font-mono tabular-nums">
                      {(getIlevel(di) > 0) && getIlevel(di)}
                    </span>
                  </span>
                </div>
              );
            })}

            {equipped.length > 0 && alternatives.length > 0 && (
              <div className="border-t border-border/50 !my-1.5" />
            )}

            {alternatives.map((di, altIdx) => {
              const checked = isItemSelected(di, group);
              const info =
                di.item.item_id > 0 ? itemInfoMap[di.item.item_id] : null;
              const qc = info
                ? QUALITY_COLORS[info.quality] || "#fff"
                : "#fff";
              const name =
                info?.name || di.item.name || `Item ${di.item.item_id}`;
              const icon = info?.icon || "inv_misc_questionmark";

              return (
                <label
                  key={`alt-${altIdx}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
                    checked
                      ? "bg-gold/[0.07]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(di, group)}
                    className="sr-only peer"
                  />
                  <div
                    className={`w-4 h-4 rounded-[3px] border transition-all shrink-0 flex items-center justify-center ${
                      checked
                        ? "bg-gold border-gold"
                        : "border-gray-600 group-hover:border-gray-500"
                    }`}
                  >
                    {checked && (
                      <svg
                        className="w-2.5 h-2.5 text-black"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M12 5L6.5 10.5L4 8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="w-6 h-6 shrink-0 rounded overflow-hidden ring-1 ring-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getIconUrl(icon)}
                      alt=""
                      width={24}
                      height={24}
                      className="w-full h-full"
                      loading="lazy"
                    />
                  </div>
                  <a
                    href={di.item.item_id > 0 ? getWowheadUrl(di.item.item_id) : undefined}
                    data-wowhead={di.item.item_id > 0 ? getWowheadData(di.item.bonus_ids, di.item.ilevel, di.item.enchant_id) : undefined}
                    className="text-[12px] truncate flex-1 no-underline"
                    style={{ color: qc }}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.preventDefault()}
                  >
                    {name}
                  </a>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {di.item.enchant_id > 0 && (
                      <span className="text-[9px] text-emerald-400/70 max-w-[80px] truncate" title={enchantInfoMap[di.item.enchant_id]?.name || ""}>
                        {enchantInfoMap[di.item.enchant_id]?.name || "Enchanted"}
                      </span>
                    )}
                    <span className="text-[10px] text-muted font-mono tabular-nums">
                      {(getIlevel(di) > 0) && getIlevel(di)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateCombinations(
  itemsBySlot: ItemsBySlot,
  selectedItems: Record<string, number[]>
): number {
  let total = 1;
  let hasAlternative = false;
  for (const slot of GEAR_SLOTS) {
    const items = itemsBySlot[slot];
    if (!items) continue;
    const selected = selectedItems[slot] || [];
    const altCount = selected.filter(
      (idx) => idx < items.length && !items[idx].is_equipped
    ).length;
    if (altCount > 0) {
      total *= altCount + 1;
      hasAlternative = true;
    }
  }
  return hasAlternative ? total - 1 : 0;
}
