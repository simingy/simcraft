"use client";

import { useEffect, useMemo, useState } from "react";
import { useSimContext } from "../components/SimContext";
import { detectClass } from "../lib/parseAddonString";
import { API_URL } from "../lib/api";

interface Instance {
  id: number;
  name: string;
  type: string;
  order?: number;
  encounters: { id: number; name: string }[];
}

interface TrackInfo {
  ilvl: number;
  bonus_id: number;
  quality: number;
}

interface DropItem {
  item_id: number;
  name: string;
  icon: string;
  quality: number;
  ilevel: number;
  encounter: string;
  inventory_type?: number;
  difficulty_info?: Record<string, TrackInfo>;
  dungeon_info?: Record<string, TrackInfo>;
}

const QUALITY_COLORS: Record<number, string> = {
  1: "text-gray-400",
  2: "text-green-400",
  3: "text-blue-400",
  4: "text-purple-400",
  5: "text-orange-400",
  6: "text-amber-300",
};

type Category = "raids" | "normal-dungeons" | "mplus";

type Difficulty = "lfr" | "normal" | "heroic" | "mythic";

const RAID_DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "lfr", label: "Raid Finder" },
  { value: "normal", label: "Normal" },
  { value: "heroic", label: "Heroic" },
  { value: "mythic", label: "Mythic" },
];

const MPLUS_DIFFICULTIES = [
  { value: "heroic", label: "Heroic" },
  { value: "mythic", label: "Mythic 0" },
  { value: "mythic+2", label: "+2" },
  { value: "mythic+3", label: "+3" },
  { value: "mythic+4", label: "+4" },
  { value: "mythic+5", label: "+5" },
  { value: "mythic+6", label: "+6" },
  { value: "mythic+7", label: "+7" },
  { value: "mythic+8", label: "+8" },
  { value: "mythic+9", label: "+9" },
  { value: "mythic+10", label: "+10" },
];

const NORMAL_DUNGEON_DIFFICULTIES = [
  { value: "normal", label: "Normal" },
  { value: "heroic", label: "Heroic" },
  { value: "mythic", label: "Mythic" },
];

function getTrackInfo(item: DropItem, raidDiff: Difficulty, dungeonDiff: string): TrackInfo | null {
  return item.dungeon_info?.[dungeonDiff] ?? item.difficulty_info?.[raidDiff] ?? null;
}

function effectiveIlvl(item: DropItem, raidDiff: Difficulty, dungeonDiff: string): number {
  return getTrackInfo(item, raidDiff, dungeonDiff)?.ilvl ?? item.ilevel;
}

function effectiveQuality(item: DropItem, raidDiff: Difficulty, dungeonDiff: string): number {
  return getTrackInfo(item, raidDiff, dungeonDiff)?.quality ?? item.quality;
}

function effectiveBonusId(item: DropItem, raidDiff: Difficulty, dungeonDiff: string): number | undefined {
  return getTrackInfo(item, raidDiff, dungeonDiff)?.bonus_id;
}

function detectSpec(simcInput: string): string | null {
  const m = simcInput.match(/^spec=(\w+)/m);
  return m ? m[1] : null;
}

export default function DropFinderPage() {
  const { simcInput, fightStyle, threads, selectedTalent } = useSimContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [drops, setDrops] = useState<Record<string, DropItem[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("heroic");
  const [dungeonDiff, setDungeonDiff] = useState("mythic+10");

  const className = useMemo(() => detectClass(simcInput), [simcInput]);
  const specName = useMemo(() => detectSpec(simcInput), [simcInput]);
  const hasCharacter = simcInput.trim().length >= 10;

  useEffect(() => {
    fetch(`${API_URL}/api/instances`)
      .then((r) => r.json())
      .then(setInstances)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDrops(null);
      setSelected(new Set());
      return;
    }
    setLoading(true);
    setSelected(new Set());
    const params = new URLSearchParams();
    if (className) params.set("class_name", className);
    if (specName) params.set("spec", specName);
    const qs = params.toString();
    // "type:raid" -> /api/instances/type/raid/drops, else /api/instances/{id}/drops
    const url = selectedId.startsWith("type:")
      ? `${API_URL}/api/instances/type/${selectedId.slice(5)}/drops`
      : `${API_URL}/api/instances/${selectedId}/drops`;
    fetch(`${url}${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setDrops(data.detail ? null : data);
      })
      .catch(() => setDrops(null))
      .finally(() => setLoading(false));
  }, [selectedId, className, specName]);

  function toggleItem(itemId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() {
    if (!drops) return;
    const all = new Set<number>();
    for (const items of Object.values(drops)) {
      for (const item of items) all.add(item.item_id);
    }
    setSelected(all);
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleSubmit() {
    if (!drops || selected.size === 0) return;
    setError("");
    setSubmitting(true);
    try {
      // Collect selected items with difficulty-adjusted ilvl
      const dropItems: DropItem[] = [];
      for (const items of Object.values(drops)) {
        for (const item of items) {
          if (selected.has(item.item_id)) {
            dropItems.push({ ...item, ilevel: effectiveIlvl(item, difficulty, dungeonDiff) });
          }
        }
      }

      const res = await fetch(`${API_URL}/api/droptimizer/sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simc_input: simcInput,
          drop_items: dropItems,
          iterations: 10000,
          fight_style: fightStyle,
          target_error: 0.1,
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

  // Build 3 categories from instance data
  const { raids, normalDungeons, mplusDungeons } = useMemo(() => {
    const mplusMeta = instances.find((i) => i.id === -1);
    const normalMeta = instances.find((i) => i.id === -32);
    const mplusIds = new Set(mplusMeta?.encounters.map((e) => e.id) ?? []);
    const normalIds = new Set(normalMeta?.encounters.map((e) => e.id) ?? []);

    const raids: Instance[] = [];
    const normalDungeons: Instance[] = [];
    const mplusDungeons: Instance[] = [];

    for (const inst of instances) {
      if (inst.type === "raid" && inst.id > 0) {
        raids.push(inst);
      } else if (inst.type === "dungeon") {
        if (mplusIds.has(inst.id)) mplusDungeons.push(inst);
        else if (normalIds.has(inst.id)) normalDungeons.push(inst);
        else normalDungeons.push(inst); // default to normal
      }
    }
    raids.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    normalDungeons.sort((a, b) => a.name.localeCompare(b.name));
    mplusDungeons.sort((a, b) => a.name.localeCompare(b.name));
    return { raids, normalDungeons, mplusDungeons };
  }, [instances]);

  const [category, setCategory] = useState<Category | "">("");

  const selectedInstance = selectedId && !selectedId.startsWith("type:")
    ? instances.find((i) => String(i.id) === selectedId)
    : null;
  const isRaid = category === "raids";
  const isDungeon = category === "normal-dungeons" || category === "mplus";
  const totalItems = drops
    ? Object.values(drops).reduce((n, items) => n + items.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "raids" as Category, label: "Raids", icon: "M8 1l2 4 4.5.7-3.2 3.1.8 4.5L8 11l-4.1 2.3.8-4.5L1.5 5.7 6 5z" },
          { key: "normal-dungeons" as Category, label: "Dungeons", icon: "M2 2h12v12H2zM5 5h6M5 8h6M5 11h3" },
          { key: "mplus" as Category, label: "Mythic+", icon: "M8 1v14M1 8h14M4 4l8 8M12 4l-8 8" },
        ]).map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setCategory(cat.key);
              setSelectedId("");
              setDrops(null);
              setSelected(new Set());
            }}
            className={`card p-4 text-center transition-all ${
              category === cat.key
                ? "border-gold/50 bg-gold/[0.03]"
                : "hover:border-gold/20"
            }`}
          >
            <div className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center mb-2 ${
              category === cat.key ? "bg-gold/20" : "bg-gold/10"
            }`}>
              <svg className="w-5 h-5 text-gold" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={cat.icon} />
              </svg>
            </div>
            <p className={`text-[13px] font-semibold transition-colors ${
              category === cat.key ? "text-gold" : "text-white"
            }`}>
              {cat.label}
            </p>
          </button>
        ))}
      </div>

      {/* Instance buttons */}
      {category && (
        <div className="card p-5">
          <label className="label-text">
            {category === "raids" ? "Select Raid" : category === "mplus" ? "Select Dungeon" : "Select Dungeon"}
          </label>
          <div className="flex flex-wrap gap-2">
            {/* All button */}
            <button
              onClick={() => {
                setSelectedId(
                  category === "raids" ? "type:raid" : "type:dungeon"
                );
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all border ${
                selectedId === "type:raid" || selectedId === "type:dungeon"
                  ? "bg-white text-black border-white"
                  : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
              }`}
            >
              All {category === "raids" ? "Raids" : "Dungeons"}
            </button>
            {(category === "raids"
              ? raids
              : category === "mplus"
              ? mplusDungeons
              : normalDungeons
            ).map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedId(String(inst.id))}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all border ${
                  selectedId === String(inst.id)
                    ? "bg-white text-black border-white"
                    : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                }`}
              >
                {inst.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty selector for raids */}
      {isRaid && selectedId && (
        <div className="card p-5">
          <label className="label-text">Difficulty</label>
          <div className="flex gap-1.5">
            {RAID_DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                  difficulty === d.value
                    ? "bg-white text-black border-white"
                    : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dungeon difficulty selector */}
      {isDungeon && selectedId && (
        <div className="card p-5">
          <label className="label-text">Difficulty</label>
          <div className="flex gap-1.5 flex-wrap">
            {(category === "mplus" ? MPLUS_DIFFICULTIES : NORMAL_DUNGEON_DIFFICULTIES).map((d) => (
              <button
                key={d.value}
                onClick={() => setDungeonDiff(d.value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                  dungeonDiff === d.value
                    ? "bg-white text-black border-white"
                    : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtering info */}
      {className && (
        <p className="text-xs text-gold">
          Filtering for {specName || ""} {className.replace("_", " ")}
        </p>
      )}
      {!className && (
        <p className="text-xs text-muted">
          Paste a SimC export above to filter drops for your class.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-gold" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* No drops */}
      {!loading && selectedId && !drops && (
        <p className="text-sm text-muted text-center py-6">
          No equippable drops found for this instance.
        </p>
      )}

      {/* Drops grouped by slot */}
      {!loading && drops && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">
              {selectedInstance?.name || (selectedId.startsWith("type:") ? `All ${category === "raids" ? "Raids" : "Dungeons"}` : "")} &mdash; {totalItems} items
              {selected.size > 0 && (
                <span className="text-gold ml-1.5">
                  ({selected.size} selected)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] text-gray-500 hover:text-white transition-colors"
              >
                Select all
              </button>
              <button
                onClick={selectNone}
                className="text-[11px] text-gray-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {Object.entries(drops).map(([slot, items]) => (
            <div key={slot} className="card p-4">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">
                {slot}
                <span className="text-gray-600 ml-1.5 normal-case tracking-normal font-normal">
                  ({items.length})
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isSelected = selected.has(item.item_id);
                  return (
                    <button
                      key={item.item_id}
                      onClick={() => toggleItem(item.item_id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all border ${
                        isSelected
                          ? "bg-gold/10 border-gold/40"
                          : "bg-surface-2 border-border hover:border-gray-500"
                      }`}
                    >
                      <img
                        src={`https://render.worldofwarcraft.com/icons/56/${item.icon}.jpg`}
                        alt=""
                        className="w-6 h-6 rounded"
                      />
                      <a
                        href={`https://www.wowhead.com/item=${item.item_id}`}
                        data-wowhead={`item=${item.item_id}${effectiveBonusId(item, difficulty, dungeonDiff) ? `&bonus=${effectiveBonusId(item, difficulty, dungeonDiff)}` : ""}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[12px] font-medium ${QUALITY_COLORS[effectiveQuality(item, difficulty, dungeonDiff)] || "text-gray-400"}`}
                      >
                        {item.name}
                      </a>
                      <span className="text-[11px] text-gray-600 tabular-nums">
                        {effectiveIlvl(item, difficulty, dungeonDiff)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Simulate button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0 || !hasCharacter}
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
            ) : !hasCharacter ? (
              "Paste SimC export to simulate"
            ) : selected.size === 0 ? (
              "Select items to simulate"
            ) : (
              `Find Upgrades (${selected.size} items)`
            )}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!selectedId && !loading && !category && (
        <p className="text-sm text-muted text-center py-6">
          Select a category to get started.
        </p>
      )}
    </div>
  );
}
