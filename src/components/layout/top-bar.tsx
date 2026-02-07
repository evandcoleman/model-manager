"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Settings, RefreshCw, Eye, User, LogOut, Download } from "lucide-react";
import { useNsfw } from "../providers/nsfw-provider";
import { cn } from "../../lib/utils";
import { DownloadDialog } from "../downloads/download-dialog";

interface TopBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onRescan: () => void;
  isScanning: boolean;
}

const NSFW_OPTIONS = [
  { label: "Show All", value: 255 },
  { label: "Hide Extreme", value: 16 },
  { label: "Hide Explicit+", value: 8 },
  { label: "Hide Mature+", value: 4 },
  { label: "Hide Suggestive+", value: 2 },
  { label: "Safe Only", value: 1 },
];

export function TopBar({
  search,
  onSearchChange,
  onRescan,
  isScanning,
}: TopBarProps) {
  const router = useRouter();
  const { maxNsfwLevel, setMaxNsfwLevel } = useNsfw();
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      settingsRef.current &&
      !settingsRef.current.contains(e.target as Node)
    ) {
      setShowSettings(false);
    }
  }, []);

  useEffect(() => {
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings, handleClickOutside]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4">
        <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">
          Model Manager
        </h1>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDownloadDialog(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted hover:text-foreground hover:border-accent/50 transition-colors"
            title="Download Model"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-foreground hover:border-accent/50 transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-11 w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted uppercase tracking-wider">
                    <Eye className="h-3.5 w-3.5" />
                    Content Filter
                  </div>
                  <div className="space-y-1">
                    {NSFW_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMaxNsfwLevel(opt.value)}
                        className={cn(
                          "w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                          maxNsfwLevel === opt.value
                            ? "bg-accent text-white"
                            : "text-foreground/80 hover:bg-card-hover"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-1">
                  <button
                    onClick={() => {
                      onRescan();
                      setShowSettings(false);
                    }}
                    disabled={isScanning}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground/80 hover:bg-card-hover disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        isScanning && "animate-spin"
                      )}
                    />
                    {isScanning ? "Scanning..." : "Re-scan Models"}
                  </button>
                </div>

                <div className="border-t border-border pt-3 space-y-1">
                  <Link
                    href="/account"
                    onClick={() => setShowSettings(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground/80 hover:bg-card-hover transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    Account Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DownloadDialog
        open={showDownloadDialog}
        onClose={() => setShowDownloadDialog(false)}
        onDownloadComplete={onRescan}
      />
    </header>
  );
}
