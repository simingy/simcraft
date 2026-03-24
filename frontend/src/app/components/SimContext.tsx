"use client";

import React, { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface SimContextType {
  simcInput: string;
  setSimcInput: (v: string) => void;
  fightStyle: string;
  setFightStyle: (v: string) => void;
  threads: number;
  setThreads: (v: number) => void;
  selectedTalent: string;
  setSelectedTalent: (v: string) => void;
  targetCount: number;
  setTargetCount: (v: number) => void;
  fightLength: number;
  setFightLength: (v: number) => void;
  customSimc: string;
  setCustomSimc: (v: string) => void;
  navStyle: "sidebar" | "top";
  setNavStyle: (v: "sidebar" | "top") => void;
}

const SimContext = createContext<SimContextType | null>(null);

export function useSimContext() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSimContext must be used within SimProvider");
  return ctx;
}

function readStoredThreads(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem("simhammer_threads");
  if (v == null) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readStoredNavStyle(): "sidebar" | "top" {
  if (typeof window === "undefined") return "sidebar";
  const v = localStorage.getItem("simhammer_nav_style");
  return v === "top" ? "top" : "sidebar";
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [simcInput, setSimcInput] = useState("");
  const [fightStyle, setFightStyle] = useState("Patchwerk");
  const [threads, _setThreads] = useState(readStoredThreads);
  const [selectedTalent, setSelectedTalent] = useState("");
  const [targetCount, setTargetCount] = useState(1);
  const [fightLength, setFightLength] = useState(300);
  const [customSimc, setCustomSimc] = useState("");
  const [navStyle, _setNavStyle] = useState<"sidebar" | "top">(readStoredNavStyle);

  const setThreads = useCallback((v: number) => {
    _setThreads(v);
    try { localStorage.setItem("simhammer_threads", String(v)); } catch {}
  }, []);

  const setNavStyle = useCallback((v: "sidebar" | "top") => {
    _setNavStyle(v);
    try { localStorage.setItem("simhammer_nav_style", v); } catch {}
  }, []);

  return (
    <SimContext.Provider
      value={{ simcInput, setSimcInput, fightStyle, setFightStyle, threads, setThreads, selectedTalent, setSelectedTalent, targetCount, setTargetCount, fightLength, setFightLength, customSimc, setCustomSimc, navStyle, setNavStyle }}
    >
      {children}
    </SimContext.Provider>
  );
}
