"use client";

import { useMemo } from "react";
import { useItemInfo, useEnchantInfo, useGemInfo, getIconUrl, getWowheadUrl, getWowheadData, QUALITY_COLORS } from "../lib/useItemInfo";
import type { ItemInfo, EnchantInfo, GemInfo, ItemQuery } from "../lib/useItemInfo";
import { SLOT_LABELS } from "../lib/parseAddonString";
import { useWowheadTooltips } from "../lib/useWowheadTooltips";

interface ResultItem {
  slot: string;
  item_id: number;
  ilevel: number;
  name: string;
  bonus_ids?: number[];
  enchant_id?: number;
  gem_id?: number;
  is_kept?: boolean;
}

interface TopGearResult {
  name: string;
  items: ResultItem[];
  dps: number;
  delta: number;
}

interface TopGearResultsProps {
  playerName: string;
  playerClass: string;
  baseDps: number;
  results: TopGearResult[];
}

export default function TopGearResults({
  playerName,
  playerClass,
  baseDps,
  results,
}: TopGearResultsProps) {
  const maxDps = results.length > 0 ? results[0].dps : baseDps;
  const bestResult = results.length > 0 ? results[0] : null;

  const allItemQueries = useMemo(() => {
    const seen = new Set<string>();
    const queries: ItemQuery[] = [];
    for (const r of results) {
      for (const it of r.items) {
        if (it.item_id <= 0) continue;
        const key = `${it.item_id}:${(it.bonus_ids || []).sort().join(":")}`;
        if (!seen.has(key)) {
          seen.add(key);
          queries.push({ item_id: it.item_id, bonus_ids: it.bonus_ids });
        }
      }
    }
    return queries;
  }, [results]);

  const itemInfoMap = useItemInfo(allItemQueries);

  const allEnchantIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of results) {
      for (const it of r.items) {
        if (it.enchant_id && it.enchant_id > 0) ids.add(it.enchant_id);
      }
    }
    return [...ids];
  }, [results]);

  const enchantInfoMap = useEnchantInfo(allEnchantIds);

  const allGemIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of results) {
      for (const it of r.items) {
        if (it.gem_id && it.gem_id > 0) ids.add(it.gem_id);
      }
    }
    return [...ids];
  }, [results]);

  const gemInfoMap = useGemInfo(allGemIds);
  useWowheadTooltips([itemInfoMap]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-8 text-center">
        <p className="text-xs text-muted mb-4">
          {playerName} &middot; {playerClass}
        </p>
        {bestResult && bestResult.delta > 0 ? (
          <>
            <p className="text-5xl font-bold text-white tabular-nums tracking-tight">
              {Math.round(bestResult.dps).toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-2 uppercase tracking-widest">
              DPS
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
              <span className="text-sm font-semibold tabular-nums">
                +{Math.round(bestResult.delta).toLocaleString()}
              </span>
              <span className="text-xs opacity-60">upgrade</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {bestResult.items.map((it, i) => (
                <ItemChip
                  key={i}
                  item={it}
                  info={it.item_id > 0 ? itemInfoMap[it.item_id] : undefined}
                  enchant={it.enchant_id ? enchantInfoMap[it.enchant_id] : undefined}
                  gem={it.gem_id ? gemInfoMap[it.gem_id] : undefined}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-5xl font-bold text-white tabular-nums tracking-tight">
              {Math.round(baseDps).toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-2 uppercase tracking-widest">
              DPS
            </p>
            <p className="text-sm text-muted mt-4">
              Current gear is already optimal.
            </p>
          </>
        )}
      </div>

      {/* Rankings */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-muted uppercase tracking-widest">
            Rankings
          </p>
          <span className="text-[11px] text-muted font-mono">
            {results.length} results
          </span>
        </div>

        <div className="space-y-1">
          {results.map((result, idx) => {
            const barWidth = maxDps > 0 ? (result.dps / maxDps) * 100 : 0;
            const isEquipped = result.items.length === 0 || result.name === "Currently Equipped";
            const isBest = idx === 0 && result.delta > 0;

            return (
              <div
                key={idx}
                className={`relative rounded-lg overflow-hidden ${
                  isBest
                    ? "ring-1 ring-gold/20"
                    : isEquipped
                    ? "ring-1 ring-white/5"
                    : ""
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/[0.02]"
                  style={{ width: `${barWidth}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-gray-600 w-5 text-right shrink-0 tabular-nums">
                      {idx + 1}
                    </span>

                    {isEquipped ? (
                      <span className="text-[12px] text-muted">
                        Currently Equipped
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0 flex-wrap">
                        {result.items.map((it, i) => (
                          <ItemTag
                            key={i}
                            item={it}
                            info={
                              it.item_id > 0
                                ? itemInfoMap[it.item_id]
                                : undefined
                            }
                            enchant={it.enchant_id ? enchantInfoMap[it.enchant_id] : undefined}
                            gem={it.gem_id ? gemInfoMap[it.gem_id] : undefined}
                          />
                        ))}
                      </div>
                    )}

                    {isBest && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        result.delta > 0
                          ? "text-emerald-400"
                          : result.delta < 0
                          ? "text-red-400"
                          : "text-muted"
                      }`}
                    >
                      {result.delta > 0
                        ? `+${Math.round(result.delta).toLocaleString()}`
                        : result.delta < 0
                        ? Math.round(result.delta).toLocaleString()
                        : "—"}
                    </span>
                    <span className="text-[12px] font-mono text-gray-400 tabular-nums w-16 text-right">
                      {Math.round(result.dps).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ItemTag({ item, info, enchant, gem }: { item: ResultItem; info?: ItemInfo; enchant?: EnchantInfo; gem?: GemInfo }) {
  const qc = info ? QUALITY_COLORS[info.quality] || "#fff" : "#fff";
  const name = info?.name || item.name || `Item ${item.item_id}`;
  const icon = info?.icon || "inv_misc_questionmark";
  const kept = item.is_kept;
  const whData = item.item_id > 0 ? getWowheadData(item.bonus_ids, item.ilevel, item.enchant_id, item.gem_id) : undefined;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
        kept ? "opacity-40" : "bg-white/[0.04]"
      }`}
    >
      <div className="w-4 h-4 shrink-0 rounded-sm overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getIconUrl(icon)}
          alt=""
          width={16}
          height={16}
          className="w-full h-full"
          loading="lazy"
        />
      </div>
      <a
        href={item.item_id > 0 ? getWowheadUrl(item.item_id) : undefined}
        data-wowhead={whData}
        className="text-[11px] font-medium truncate max-w-[120px] no-underline"
        style={{ color: qc }}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.preventDefault()}
      >
        {name}
      </a>
      {enchant?.name && (
        <span className="text-[9px] text-emerald-400/70 truncate max-w-[70px]" title={enchant.name}>
          {enchant.name}
        </span>
      )}
    </div>
  );
}

function ItemChip({ item, info, enchant, gem }: { item: ResultItem; info?: ItemInfo; enchant?: EnchantInfo; gem?: GemInfo }) {
  const qc = info ? QUALITY_COLORS[info.quality] || "#fff" : "#fff";
  const name = info?.name || item.name || `Item ${item.item_id}`;
  const icon = info?.icon || "inv_misc_questionmark";
  const kept = item.is_kept;
  const whData = item.item_id > 0 ? getWowheadData(item.bonus_ids, item.ilevel, item.enchant_id, item.gem_id) : undefined;

  return (
    <div
      className={`inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 ${
        kept ? "opacity-40" : ""
      }`}
    >
      <div className="w-5 h-5 shrink-0 rounded overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getIconUrl(icon)}
          alt=""
          width={20}
          height={20}
          className="w-full h-full"
          loading="lazy"
        />
      </div>
      <div className="text-left">
        <a
          href={item.item_id > 0 ? getWowheadUrl(item.item_id) : undefined}
          data-wowhead={whData}
          className="text-[11px] font-medium leading-tight no-underline block"
          style={{ color: qc }}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.preventDefault()}
        >
          {name}
        </a>
        <p className="text-[9px] text-muted">
          {SLOT_LABELS[item.slot] || item.slot}
          {item.ilevel > 0 && ` · ${item.ilevel}`}
          {info?.tag && ` · ${info.tag}`}
          {info?.upgrade && ` · ${info.upgrade}`}
          {gem?.name ? <span className="text-sky-400/70"> · {gem.name}</span> : info?.sockets && info.sockets > 0 && <span className="text-sky-400/70"> · Socket</span>}
          {enchant?.name && <span className="text-emerald-400/70"> · {enchant.name}</span>}
          {kept && " · kept"}
        </p>
      </div>
    </div>
  );
}
