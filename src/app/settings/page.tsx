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
  Eye,
  EyeOff,
  Copy,
  Check,
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
  const [apiKey, setApiKey] = useState("");
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

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

    fetch("/api/auth/api-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setApiKey(data.key);
          setMaskedApiKey(data.maskedKey);
        }
      });
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

  async function handleRegenerateApiKey() {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
        setMaskedApiKey(data.maskedKey);
        setShowApiKey(true);
      }
    } finally {
      setIsRegenerating(false);
      setShowRegenerateConfirm(false);
    }
  }

  function handleCopyApiKey() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

        {/* API Key */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium mb-4">API Key</h2>
          <p className="text-sm text-muted mb-4">
            Use this key to authenticate REST API requests with the
            Authorization header:{" "}
            <code className="text-xs bg-background px-1.5 py-0.5 rounded">
              Bearer YOUR_KEY
            </code>
          </p>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-10 rounded-lg border border-border bg-background px-3 flex items-center">
              <code className="text-sm font-mono text-foreground/90">
                {showApiKey ? apiKey : maskedApiKey || "Loading..."}
              </code>
            </div>

            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
              title={showApiKey ? "Hide" : "Show"}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={handleCopyApiKey}
              className="h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          {showRegenerateConfirm ? (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
              <p className="text-sm text-yellow-400 mb-3">
                Are you sure? This will invalidate the current API key.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerateApiKey}
                  disabled={isRegenerating}
                  className="h-9 rounded-lg bg-yellow-600 px-3 text-white text-sm font-medium hover:bg-yellow-500 disabled:opacity-50 transition-colors"
                >
                  {isRegenerating ? "Regenerating..." : "Yes, Regenerate"}
                </button>
                <button
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="h-9 rounded-lg border border-border px-3 text-sm text-foreground/80 hover:bg-card-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="flex items-center gap-2 h-9 rounded-lg border border-border px-3 text-sm text-foreground/80 hover:bg-card-hover transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate Key
            </button>
          )}
        </section>

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
