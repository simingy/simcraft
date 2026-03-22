"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "./lib/api";

type SimSummary = {
  id: string;
  status: string;
  sim_type: string;
  character_name: string;
  created_at: string;
};

export default function Home() {
  const [sims, setSims] = useState<SimSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSims() {
      try {
        const res = await fetch(`${API_URL}/api/sims`);
        if (res.ok) {
          const data = await res.json();
          setSims(data);
        }
      } catch (e) {
        console.error("Failed to load past sims", e);
      } finally {
        setLoading(false);
      }
    }
    loadSims();
  }, []);

  return (
    <div className="py-8 w-full max-w-3xl mx-auto space-y-12">
      <div className="text-center">
        <p className="text-sm text-muted">
           Select a simulation type above to get started.
        </p>
      </div>

      {!loading && sims.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-4 border-b border-border pb-2 px-1">
            Recent Simulations
          </h2>
          <div className="grid gap-3">
            {sims.slice(0, 15).map((sim) => (
              <Link
                key={sim.id}
                href={`/sim/${sim.id}`}
                className="card p-4 hover:border-gray-500 hover:bg-surface-2 transition flex md:flex-row flex-col items-start md:items-center justify-between gap-4 group"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span 
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        sim.status === "done" ? "bg-emerald-500" :
                        sim.status === "failed" ? "bg-red-500" :
                        "bg-blue-500 animate-pulse"
                      }`}
                    />
                    <span className="font-medium text-gray-200 group-hover:text-white capitalize truncate max-w-[200px]">
                      {sim.character_name}
                    </span>
                    <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface-2 border border-border shrink-0 capitalize">
                      {sim.sim_type.replace("_", " ")}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto">
                  <div className="text-[13px] text-gray-400 font-mono">
                    {new Date(sim.created_at).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted/60 opacity-0 group-hover:opacity-100 transition translate-y-1 group-hover:translate-y-0 hidden md:block">
                    View Results →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
