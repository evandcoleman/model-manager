"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { TokenSettings } from "@/components/settings/token-settings";
import { isDesktop, isDesktopMode } from "@/lib/desktop";
import { apiFetch } from "@/lib/api-client";

export default function SettingsPage() {
  const router = useRouter();
  const [modelDir, setModelDir] = useState<string>("");
  const [autoScan, setAutoScan] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    if (!isDesktopMode) {
      router.replace("/account");
      return;
    }

    if (!isDesktop || !window.electronAPI) return;

    window.electronAPI.getSetting("modelDir").then((val) => {
      setModelDir((val as string) ?? "");
    });
    window.electronAPI.getSetting("autoScanOnStartup").then((val) => {
      setAutoScan(val as boolean);
    });
    window.electronAPI.getVersion().then(setAppVersion);
  }, [router]);

  async function handleChangeDirectory() {
    if (!isDesktop || !window.electronAPI) return;

    const dir = await window.electronAPI.openDirectory();
    if (dir) {
      setModelDir(dir);
      await window.electronAPI.setSetting("modelDir", dir);
      await window.electronAPI.restartServer();
    }
  }

  async function handleOpenInFinder() {
    if (!isDesktop || !window.electronAPI || !modelDir) return;
    await window.electronAPI.openInFinder(modelDir);
  }

  async function handleToggleAutoScan() {
    if (!isDesktop || !window.electronAPI) return;
    const newValue = !autoScan;
    setAutoScan(newValue);
    await window.electronAPI.setSetting("autoScanOnStartup", newValue);
  }

  async function handleRescan() {
    setIsScanning(true);
    try {
      await apiFetch("/api/v1/scan", { method: "POST" });
    } finally {
      setIsScanning(false);
    }
  }

  if (!isDesktopMode) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Preferences</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* Model Directory */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Model Directory</h2>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-10 rounded-lg border border-border bg-background px-3 flex items-center overflow-hidden">
              <Folder className="h-4 w-4 text-accent shrink-0 mr-2" />
              <span className="text-sm text-foreground truncate">
                {modelDir || "Not set"}
              </span>
            </div>
            <button
              onClick={handleChangeDirectory}
              className="h-10 px-4 rounded-lg border border-border bg-background text-sm text-foreground/80 hover:bg-card-hover transition-colors shrink-0"
            >
              Change
            </button>
          </div>

          {modelDir && (
            <button
              onClick={handleOpenInFinder}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open in Finder
            </button>
          )}
        </section>

        {/* API Tokens */}
        <TokenSettings />

        {/* Scanning */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">Scanning</h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">
                Scan models automatically on startup
              </span>
              <button
                onClick={handleToggleAutoScan}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  autoScan ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    autoScan ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>

            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center gap-2 h-10 rounded-lg border border-border px-4 text-sm text-foreground/80 hover:bg-card-hover disabled:opacity-50 transition-colors"
            >
              {isScanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isScanning ? "Scanning..." : "Re-scan Now"}
            </button>
          </div>
        </section>

        {/* About */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">About</h2>
          <div className="space-y-2 text-sm text-muted">
            <p>
              Model Manager Desktop{" "}
              {appVersion && (
                <span className="text-foreground/60">v{appVersion}</span>
              )}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
