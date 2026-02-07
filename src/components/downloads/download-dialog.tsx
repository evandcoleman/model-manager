"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Link2, AlertCircle, Loader2 } from "lucide-react";
import { DownloadProgressItem } from "./download-progress";

interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: number;
  percent: number;
  eta: number;
}

interface DownloadJob {
  id: string;
  url: string;
  source: string;
  status: string;
  modelName?: string;
  fileName?: string;
  progress: DownloadProgress;
  error?: string;
}

interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  onDownloadComplete?: () => void;
}

type SourceType = "civarchive" | "civitai" | "huggingface" | null;

function detectSource(url: string): SourceType {
  if (/civarchive\.com\/models\/\d+/.test(url)) return "civarchive";
  if (/civitai\.com\/models\/\d+/.test(url)) return "civitai";
  if (/huggingface\.co\/[^/]+\/[^/]+/.test(url)) return "huggingface";
  return null;
}

const SOURCE_INFO: Record<string, { name: string; color: string }> = {
  civarchive: { name: "CivArchive", color: "text-purple-400" },
  civitai: { name: "CivitAI", color: "text-blue-400" },
  huggingface: { name: "HuggingFace", color: "text-yellow-400" },
};

export function DownloadDialog({
  open,
  onClose,
  onDownloadComplete,
}: DownloadDialogProps) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<SourceType>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);

  // Fetch active jobs on open
  useEffect(() => {
    if (open) {
      fetchJobs();
    }
  }, [open]);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/downloads");
      if (res.ok) {
        const data = await res.json();
        const active = data.jobs.filter(
          (j: DownloadJob) =>
            j.status === "pending" || j.status === "downloading"
        );
        setActiveJobs(active);

        // Subscribe to progress for active jobs
        for (const job of active) {
          subscribeToJob(job.id);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  const handleJobUpdate = useCallback((job: DownloadJob) => {
    setActiveJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id);
      if (idx === -1) return prev;

      const updated = [...prev];
      updated[idx] = job;

      // Remove completed/failed jobs after a delay
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        if (job.status === "completed") {
          onDownloadComplete?.();
        }
        setTimeout(() => {
          setActiveJobs((curr) => curr.filter((j) => j.id !== job.id));
        }, 3000);
      }

      return updated;
    });
  }, [onDownloadComplete]);

  function subscribeToJob(jobId: string) {
    const eventSource = new EventSource(`/api/downloads/${jobId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const job = JSON.parse(event.data);
        handleJobUpdate(job);
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setSource(detectSource(value));
    setError(null);
  }

  async function handleStartDownload() {
    if (!url.trim() || !source) return;

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start download");
      }

      // Add job to active list and subscribe
      setActiveJobs((prev) => [data.job, ...prev]);
      subscribeToJob(data.job.id);

      // Clear input
      setUrl("");
      setSource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start download");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCancel(jobId: string) {
    try {
      await fetch(`/api/downloads/${jobId}`, { method: "DELETE" });
    } catch {
      // Ignore errors
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && url.trim() && source && !isStarting) {
      handleStartDownload();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-medium">Download Model</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">
              Model URL
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://civarchive.com/models/... or https://civitai.com/models/..."
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent transition-colors"
                autoFocus
              />
            </div>

            {source && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Detected:</span>
                <span className={SOURCE_INFO[source].color}>
                  {SOURCE_INFO[source].name}
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <button
            onClick={handleStartDownload}
            disabled={!url.trim() || !source || isStarting}
            className="w-full h-11 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Start Download
              </>
            )}
          </button>

          {activeJobs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-xs font-medium text-muted uppercase tracking-wider">
                Active Downloads
              </div>
              {activeJobs.map((job) => (
                <DownloadProgressItem
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border bg-card-hover/30 rounded-b-xl">
          <p className="text-xs text-muted">
            Supported sources: CivArchive, CivitAI, HuggingFace. Add API tokens
            in{" "}
            <a
              href="/account"
              className="text-accent hover:underline"
              onClick={onClose}
            >
              Account Settings
            </a>{" "}
            for authenticated downloads.
          </p>
        </div>
      </div>
    </div>
  );
}
