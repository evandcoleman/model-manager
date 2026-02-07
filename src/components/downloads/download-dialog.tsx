"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Link2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
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
  retryCount?: number;
}

interface PreviewMetadata {
  source: string;
  modelName: string;
  modelType: string;
  baseModel?: string;
  versionName?: string;
  files: { name: string; sizeKB?: number }[];
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

const MODEL_TYPES = [
  "Diffusion Model",
  "LORA",
  "VAE",
  "ControlNet",
  "TextualInversion",
  "Upscaler",
];

// Normalize "Checkpoint" from APIs to "Diffusion Model"
function normalizeModelType(type: string): string {
  if (type === "Checkpoint") return "Diffusion Model";
  return type;
}

const BASE_MODELS = [
  "Flux.1 S",
  "Flux.1 D",
  "SDXL 1.0",
  "SD 3.5",
  "SD 3",
  "SD 2.1",
  "SD 1.5",
  "Pony",
  "Illustrious",
  "ZImageTurbo",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DownloadDialog({
  open,
  onClose,
  onDownloadComplete,
}: DownloadDialogProps) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<SourceType>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);

  // Preview step state
  const [preview, setPreview] = useState<PreviewMetadata | null>(null);
  const [modelType, setModelType] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [customBaseModel, setCustomBaseModel] = useState("");

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
        const relevant = data.jobs.filter(
          (j: DownloadJob) =>
            j.status === "pending" ||
            j.status === "downloading" ||
            j.status === "failed" ||
            j.status === "cancelled"
        );
        setActiveJobs(relevant);

        for (const job of relevant) {
          if (job.status === "pending" || job.status === "downloading") {
            subscribeToJob(job.id);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  const handleJobUpdate = useCallback(
    (job: DownloadJob) => {
      setActiveJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        if (idx === -1) {
          if (job.status !== "completed") {
            return [job, ...prev];
          }
          return prev;
        }

        const updated = [...prev];
        updated[idx] = job;

        if (job.status === "completed") {
          onDownloadComplete?.();
          setTimeout(() => {
            setActiveJobs((curr) => curr.filter((j) => j.id !== job.id));
          }, 3000);
        }

        return updated;
      });
    },
    [onDownloadComplete]
  );

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
    setPreview(null);
  }

  async function handleFetchPreview() {
    if (!url.trim() || !source) return;

    setIsFetching(true);
    setError(null);

    try {
      const res = await fetch("/api/downloads/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch metadata");
      }

      setPreview(data);
      setModelType(normalizeModelType(data.modelType) || "Diffusion Model");
      setBaseModel(data.baseModel || "");
      setCustomBaseModel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metadata");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleStartDownload() {
    if (!url.trim() || !source) return;

    setIsStarting(true);
    setError(null);

    const effectiveBaseModel =
      baseModel === "__custom__" ? customBaseModel : baseModel;

    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          modelType: modelType || undefined,
          baseModel: effectiveBaseModel || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start download");
      }

      setActiveJobs((prev) => [data.job, ...prev]);
      subscribeToJob(data.job.id);

      // Reset form
      setUrl("");
      setSource(null);
      setPreview(null);
      setModelType("");
      setBaseModel("");
      setCustomBaseModel("");
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

  async function handleRetry(jobId: string) {
    try {
      const res = await fetch(`/api/downloads/${jobId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        handleJobUpdate(data.job);
        subscribeToJob(jobId);
      }
    } catch {
      // Ignore errors
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && url.trim() && source && !isFetching && !preview) {
      handleFetchPreview();
    }
  }

  function handleBack() {
    setPreview(null);
    setError(null);
  }

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const needsReview =
    preview && (!preview.baseModel || preview.baseModel === "unknown");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {preview && (
              <button
                onClick={handleBack}
                className="p-1 rounded text-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <Download className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-medium">
              {preview ? "Review Download" : "Download Model"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {!preview ? (
            <>
              {/* URL Input Step */}
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
                    placeholder="https://civarchive.com/models/... or https://huggingface.co/..."
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
                onClick={handleFetchPreview}
                disabled={!url.trim() || !source || isFetching}
                className="w-full h-11 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </>
          ) : (
            <>
              {/* Preview Step */}
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="font-medium">{preview.modelName}</div>
                  <div className="text-sm text-muted">
                    {preview.files[0]?.name}
                    {preview.files[0]?.sizeKB && (
                      <span className="ml-2">
                        ({formatBytes(preview.files[0].sizeKB * 1024)})
                      </span>
                    )}
                  </div>
                </div>

                {needsReview && (
                  <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Could not auto-detect base model. Please select below.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted uppercase tracking-wider">
                      Model Type
                    </label>
                    <div className="relative">
                      <select
                        value={modelType}
                        onChange={(e) => setModelType(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-8 text-sm text-foreground outline-none focus:border-accent transition-colors appearance-none"
                      >
                        {MODEL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted uppercase tracking-wider">
                      Base Model
                    </label>
                    <div className="relative">
                      <select
                        value={baseModel}
                        onChange={(e) => setBaseModel(e.target.value)}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-8 text-sm text-foreground outline-none focus:border-accent transition-colors appearance-none"
                      >
                        <option value="">Auto-detect</option>
                        {BASE_MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                        <option value="__custom__">Custom...</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                    </div>
                  </div>
                </div>

                {baseModel === "__custom__" && (
                  <input
                    type="text"
                    value={customBaseModel}
                    onChange={(e) => setCustomBaseModel(e.target.value)}
                    placeholder="Enter base model name..."
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent transition-colors"
                    autoFocus
                  />
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
                disabled={isStarting}
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
            </>
          )}

          {activeJobs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-xs font-medium text-muted uppercase tracking-wider">
                Downloads
              </div>
              {activeJobs.map((job) => (
                <DownloadProgressItem
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
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
    </div>,
    document.body
  );
}
