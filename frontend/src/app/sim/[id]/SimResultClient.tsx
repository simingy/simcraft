"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ResultsChart from "../../components/ResultsChart";
import SimStatus from "../../components/SimStatus";
import StatWeightsTable from "../../components/StatWeightsTable";
import TopGearResults from "../../components/TopGearResults";

import { API_URL } from "../../lib/api";

interface JobData {
  id: string;
  status: string;
  progress: number;
  progress_stage?: string;
  progress_detail?: string;
  stages_completed?: string[];
  logs?: string[];
  simc_input?: string;
  sim_type?: string;
  result: Record<string, unknown> | null;
  error: string | null;
}

export default function SimResultClient() {
  const params = useParams();
  const paramId = params.id as string;

  // In static export, useParams() may initially return "_" (the generateStaticParams
  // placeholder) before the router reconciles with the actual URL. Fall back to the URL.
  let id = paramId;
  if ((!paramId || paramId === "_") && typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/sim\/(.+)/);
    if (match) id = match[1];
  }

  const [job, setJob] = useState<JobData | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  useEffect(() => {
    if (!id || id === "_") return;
    setFetchError("");
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`${API_URL}/api/sim/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobData = await res.json();
        if (active) setJob(data);
        if (data.status === "pending" || data.status === "running") {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (active)
          setFetchError(
            err instanceof Error ? err.message : "Failed to fetch status"
          );
      }
    }
    poll();
    return () => { active = false; };
  }, [id]);

  if (fetchError) {
    return (
      <div className="card border-red-500/20 p-6">
        <p className="text-sm font-medium text-red-400 mb-1">Error</p>
        <p className="text-sm text-red-400/70">{fetchError}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-border border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="card border-red-500/20 p-6">
        <p className="text-sm font-medium text-red-400 mb-2">
          Simulation Failed
        </p>
        <p className="font-mono text-xs text-red-400/60 whitespace-pre-wrap">
          {job.error || "Unknown error"}
        </p>
      </div>
    );
  }

  if (job.status === "pending" || job.status === "running") {
    return (
      <SimStatus
        status={job.status}
        progress={job.progress}
        progressStage={job.progress_stage}
        progressDetail={job.progress_detail}
        stagesCompleted={job.stages_completed}
        logs={job.logs}
      />
    );
  }

  if (!job.result) {
    return <p className="text-sm text-muted">No result data available.</p>;
  }

  const r = job.result;
  const isTopGear = r.type === "top_gear";

  return (
    <div className="space-y-6">
      {isTopGear ? (
        <TopGearResults
          playerName={r.player_name as string}
          playerClass={r.player_class as string}
          baseDps={r.base_dps as number}
          results={
            r.results as Array<{
              name: string;
              items: Array<{
                slot: string;
                item_id: number;
                ilevel: number;
                name: string;
                bonus_ids?: number[];
                enchant_id?: number;
                gem_id?: number;
                is_kept?: boolean;
                encounter?: string;
              }>;
              dps: number;
              delta: number;
            }>
          }
          equippedGear={r.equipped_gear as Record<string, {
            slot: string;
            item_id: number;
            ilevel: number;
            name: string;
            bonus_ids?: number[];
            enchant_id?: number;
            gem_id?: number;
          }>}
        />
      ) : (
        <>
          <ResultsChart
            dps={r.dps as number}
            dpsError={r.dps_error as number}
            fightLength={r.fight_length as number}
            playerName={r.player_name as string}
            playerClass={r.player_class as string}
            abilities={
              (r.abilities as Array<{
                name: string;
                portion_dps: number;
                school: string;
              }>) || []
            }
          />
          {r.stat_weights && (
            <StatWeightsTable
              statWeights={r.stat_weights as Record<string, number>}
            />
          )}
        </>
      )}

      {job.simc_input && (
        <div className="card p-5 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted uppercase tracking-widest">
              Simulation Input
            </h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsInputExpanded(!isInputExpanded)}
                className="text-xs text-muted hover:text-white transition-colors"
              >
                {isInputExpanded ? "Hide input" : "Show input"}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(job.simc_input!)}
                className="text-xs text-gold hover:text-white transition-colors"
              >
                Copy configuration
              </button>
            </div>
          </div>
          {isInputExpanded && (
            <pre className="mt-4 font-mono text-[11px] leading-relaxed text-gray-300 bg-[#0a0a0a] border border-[#222] p-4 rounded-lg overflow-x-auto whitespace-pre">
              {job.simc_input}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 text-xs text-muted pb-4">
        {typeof r.simc_version === "string" && (
          <>
            <span>{r.simc_version as string}</span>
            <span className="w-px h-3 bg-border" />
          </>
        )}
        <a
          href={`${API_URL}/api/sim/${id}/raw`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          View raw JSON
        </a>
      </div>
    </div>
  );
}
