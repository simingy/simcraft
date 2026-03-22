"use client";

import React, { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";

interface SimStatusProps {
  status: string;
  progress: number;
  progressStage?: string;
  progressDetail?: string;
  stagesCompleted?: string[];
  logs?: string[];
}

/**
 * Tracks server-reported progress. Only advances when the backend
 * reports a higher value (i.e. a profileset or stage actually completed).
 * The CSS transition on the bar handles visual smoothing.
 */
function useSmoothedProgress(serverProgress: number): number {
  const [display, setDisplay] = useState(serverProgress);

  useEffect(() => {
    setDisplay((prev) => Math.max(prev, serverProgress));
  }, [serverProgress]);

  return Math.round(display);
}

/** Poll CPU usage from the desktop backend while a sim is running. */
function useCpuUsage(isRunning: boolean): number | null {
  const [cpu, setCpu] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDesktop = useRef(false);

  useEffect(() => {
    isDesktop.current = !!window.electronAPI;
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!isRunning || !isDesktop.current) {
      setCpu(null);
      intervalRef.current = null;
      return;
    }

    function fetchCpu() {
      fetch(`${API_URL}/api/system-stats`)
        .then((r) => r.json())
        .then((d) => setCpu(d.cpu_usage ?? null))
        .catch(() => {});
    }

    fetchCpu();
    intervalRef.current = setInterval(fetchCpu, 1500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  return cpu;
}

export default function SimStatus({
  status,
  progress,
  progressStage,
  progressDetail,
  stagesCompleted,
  logs,
}: SimStatusProps) {
  const isRunning = status === "running";
  const displayProgress = useSmoothedProgress(progress);
  const cpuUsage = useCpuUsage(isRunning);
  const title = progressStage || (status === "pending" ? "Queued" : "Simulating");
  const hasStages = stagesCompleted && stagesCompleted.length > 0;
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="w-10 h-10 border-2 border-border border-t-gold rounded-full animate-spin" />

      <div className="text-center">
        <p className="text-base text-gray-100 font-medium">{title}</p>
        {progressDetail && (
          <p className="text-[13px] text-gray-400 mt-1.5">{progressDetail}</p>
        )}
      </div>

      <div className="w-72">
        <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gold h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(displayProgress, status === "pending" ? 2 : 5)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <p className="text-[13px] text-gray-400 font-mono tabular-nums">
            {displayProgress}%
          </p>
          {cpuUsage !== null && (
            <p className="text-[13px] text-gray-400 font-mono tabular-nums">
              CPU {Math.round(cpuUsage)}%
            </p>
          )}
        </div>
      </div>

      {hasStages && (
        <div className="w-72 space-y-1 pt-2">
          {stagesCompleted!.map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5L6.5 10.5L4 8" />
              </svg>
              <span className="text-[13px] text-gray-400">{stage}</span>
            </div>
          ))}
          {progressStage && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 bg-gold rounded-full animate-pulse" />
              </div>
              <span className="text-[13px] text-gray-400">
                {progressStage}
                {progressDetail && <span className="text-gray-500"> · {progressDetail}</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {logs !== undefined && (
        <div className="w-full max-w-4xl mt-10 transition-all duration-500 opacity-100 translate-y-0">
          <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-[#0a0a0a]">
            {/* Terminal Header */}
            <div className="flex items-center justify-center px-4 py-3 bg-[#111] border-b border-[#222]">
              <div className="font-sans text-xs text-gray-500 select-none opacity-80 uppercase tracking-widest font-semibold">
                Console
              </div>
            </div>
            {/* Terminal Body */}
            <div className="p-5 font-mono text-[12px] leading-relaxed text-gray-300 h-[32rem] overflow-y-auto whitespace-pre-wrap flex flex-col items-start text-left selection:bg-gray-700">
              {logs.length > 0 ? (
                logs.map(line => line.split('\r').pop()).filter(Boolean).join("\n")
              ) : (
                <span className="opacity-50 animate-pulse text-green-500">{">"} Waiting for simc stream...</span>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
