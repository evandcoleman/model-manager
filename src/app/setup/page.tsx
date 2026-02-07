"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Folder, Loader2, ArrowRight } from "lucide-react";
import { isDesktop, isDesktopMode } from "@/lib/desktop";

export default function SetupPage() {
  const router = useRouter();
  const [modelDir, setModelDir] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopMode) {
      router.replace("/");
    }
  }, [router]);

  async function handlePickDirectory() {
    if (!isDesktop || !window.electronAPI) return;

    const dir = await window.electronAPI.openDirectory();
    if (dir) {
      setModelDir(dir);
      setError(null);
    }
  }

  async function handleStart() {
    if (!modelDir || !isDesktop || !window.electronAPI) return;

    setIsStarting(true);
    setError(null);

    try {
      await window.electronAPI.setSetting("modelDir", modelDir);
      await window.electronAPI.restartServer();

      // Trigger an initial scan
      try {
        await fetch("/api/v1/scan", { method: "POST" });
      } catch {
        // Non-critical if scan fails on first run
      }

      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start. Please try again."
      );
      setIsStarting(false);
    }
  }

  if (!isDesktopMode) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome to Model Manager
          </h1>
          <p className="text-sm text-muted mt-2">
            Choose the directory where your AI models are stored.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              Model Directory
            </label>

            {modelDir ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-10 rounded-lg border border-border bg-background px-3 flex items-center overflow-hidden">
                  <Folder className="h-4 w-4 text-accent shrink-0 mr-2" />
                  <span className="text-sm text-foreground truncate">
                    {modelDir}
                  </span>
                </div>
                <button
                  onClick={handlePickDirectory}
                  className="h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground/80 hover:bg-card-hover transition-colors shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={handlePickDirectory}
                className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-2 text-muted hover:text-foreground transition-colors"
              >
                <Folder className="h-6 w-6" />
                <span className="text-sm">Choose Directory</span>
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!modelDir || isStarting}
            className="w-full h-11 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Scanning
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
