"use client";

import { useEffect, useState } from "react";

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState("");
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Listen for update notifications from main process
    const unlisten = api.onUpdateAvailable((ver) => {
      setUpdateAvailable(true);
      setVersion(ver);
    });

    // Also actively check
    api.checkForUpdate().then((result) => {
      if (result) {
        setUpdateAvailable(true);
        setVersion(result.version);
      }
    }).catch(() => {});

    const unlistenProgress = api.onDownloadProgress((percent) => {
      setProgress(Math.round(percent));
    });

    return () => { unlisten(); unlistenProgress(); };
  }, []);

  async function handleInstall() {
    const api = window.electronAPI;
    if (!api) return;
    setInstalling(true);
    setError("");
    try {
      await api.downloadAndInstall();
    } catch (e: any) {
      setError(e?.message || "Update failed");
      setInstalling(false);
    }
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm bg-[#1a1a2e] border border-gold/40 rounded-lg shadow-lg shadow-black/40 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-gray-200">
            Update available
          </p>
          <p className="text-[13px] text-gray-400 mt-0.5">
            SimHammer v{version} is ready to install.
          </p>
          {error && (
            <p className="text-[13px] text-red-400 mt-1">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="px-3 py-1.5 text-[13px] font-medium rounded bg-gold text-black hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {installing ? `Downloading ${progress}%` : "Install & restart"}
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              disabled={installing}
              className="px-3 py-1.5 text-[13px] font-medium rounded text-gray-400 hover:text-gray-200 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
