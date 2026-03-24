"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSimContext } from "./SimContext";
import FightStyleSelector from "./FightStyleSelector";
import TalentPicker from "./TalentPicker";

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

function AdvancedOptions() {
  const [open, setOpen] = useState(false);
  const { fightStyle, setFightStyle, targetCount, setTargetCount, fightLength, setFightLength, customSimc, setCustomSimc } =
    useSimContext();

  const isDefault = fightStyle === "Patchwerk" && targetCount === 1 && fightLength === 300 && !customSimc;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Advanced Options</span>
          {!open && !isDefault && (
            <span className="text-[11px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">
              Modified
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          <div className="pt-4">
            <label className="label-text mb-2 block">Fight Style</label>
            <FightStyleSelector value={fightStyle} onChange={setFightStyle} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="label-text">Number of Bosses</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="flex-1 accent-gold"
                />
                <span className="text-sm font-mono text-white tabular-nums w-6 text-right">{targetCount}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="label-text">Fight Length</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={30}
                  max={600}
                  step={30}
                  value={fightLength}
                  onChange={(e) => setFightLength(Number(e.target.value))}
                  className="flex-1 accent-gold"
                />
                <span className="text-sm font-mono text-white tabular-nums w-16 text-right">{Math.floor(fightLength / 60)}:{String(fightLength % 60).padStart(2, "0")}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="label-text">Custom SimC Input</label>
            <textarea
              value={customSimc}
              onChange={(e) => setCustomSimc(e.target.value)}
              placeholder="Paste custom SimC options here (e.g., dungeon route, APL overrides)…"
              className="input-field h-28 font-mono text-xs resize-y"
            />
            <p className="text-[11px] text-gray-600">
              Appended to the end of the SimC profile. Useful for dungeon routes, custom APL, or fight overrides.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SimSharedConfig() {
  const pathname = usePathname();
  const { simcInput, setSimcInput } = useSimContext();

  const showConfig = pathname === "/quick-sim" || pathname === "/top-gear" || pathname === "/drop-finder";
  if (!showConfig) return null;

  const detectedInfo = parseCharacterInfo(simcInput);

  return (
    <div className="space-y-6 mb-6">
      <div className="card p-5 space-y-3">
        <label className="label-text">SimC Addon Export</label>
        <textarea
          value={simcInput}
          onChange={(e) => setSimcInput(e.target.value)}
          placeholder="Paste your SimC addon export here…"
          className="input-field h-44 font-mono text-xs resize-y"
        />
        {detectedInfo && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gold">
              {detectedInfo.name} &middot; {detectedInfo.spec}{" "}
              {detectedInfo.className}
            </p>
            <TalentPicker />
          </div>
        )}
      </div>
      <AdvancedOptions />
    </div>
  );
}
