"use client";

import { useEffect, useRef, useState } from "react";
import { useSimContext } from "./SimContext";
import { API_URL } from "../lib/api";

const PRESETS = [
  { label: "Balanced", pct: 0.3, desc: "30%" },
  { label: "Performance", pct: 0.6, desc: "60%" },
  { label: "Maximum", pct: 0.9, desc: "90%" },
] as const;

export default function SettingsPopover() {
  const { threads, setThreads, navStyle, setNavStyle } = useSimContext();
  const [open, setOpen] = useState(false);
  const [maxThreads, setMaxThreads] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktop = !!window.electronAPI;
    setIsDesktop(desktop);
    if (!desktop) return;

    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.threads) {
          setMaxThreads(data.threads);
          if (threads === 0) {
            // No saved preference — default to 60%
            setThreads(Math.max(1, Math.round(data.threads * 0.6)));
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — threads is intentionally captured once

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // If not desktop, we might not have maxThreads, but we still want the popover for UI settings
  // if (!isDesktop || !maxThreads) return null;

  const selectedIdx = PRESETS.findIndex(
    (p) => Math.max(1, Math.round(maxThreads * p.pct)) === threads
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-7 flex items-center gap-1.5 rounded-md px-2 text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="5" width="14" height="7" rx="1" />
          <rect x="1" y="5" width={14 * (selectedIdx >= 0 ? PRESETS[selectedIdx].pct : 0.6)} height="7" rx="1" fill="currentColor" opacity="0.25" />
          <path d="M4 1v4M8 1v4M12 1v4" />
        </svg>
        <span className="text-[13px] font-medium">
          Settings
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl shadow-black/40 p-4 z-[60] space-y-6">
          {/* Layout Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Navigation Style</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setNavStyle("sidebar")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                  navStyle === "sidebar"
                    ? "bg-white text-black border-white"
                    : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                }`}
              >
                Sidebar
              </button>
              <button
                onClick={() => setNavStyle("top")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                  navStyle === "top"
                    ? "bg-white text-black border-white"
                    : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                }`}
              >
                Top Tiles
              </button>
            </div>
          </div>

          {/* Performance Section (Desktop Only) */}
          {isDesktop && maxThreads > 0 && (
            <div className="space-y-3 border-t border-border pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">CPU Threads</span>
                <span className="text-[12px] font-mono bg-surface-2 border border-border px-2 py-0.5 rounded text-white tabular-nums">
                  {threads}/{maxThreads}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS.map((preset, idx) => {
                  const t = Math.max(1, Math.round(maxThreads * preset.pct));
                  const active = selectedIdx === idx;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setThreads(t)}
                      className={`py-2 px-1 rounded-lg text-center transition-all border ${
                        active
                          ? "bg-white text-black border-white"
                          : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-semibold block uppercase">{preset.label}</span>
                      <span className="text-[10px] block mt-0.5 opacity-60">
                        {t}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
