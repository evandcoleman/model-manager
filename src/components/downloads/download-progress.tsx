"use client";

import { X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface DownloadProgressProps {
  job: DownloadJob;
  onCancel?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function DownloadProgressItem({
  job,
  onCancel,
}: DownloadProgressProps) {
  const isActive = job.status === "downloading" || job.status === "pending";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed" || job.status === "cancelled";

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isCompleted && "border-green-500/30 bg-green-500/5",
        isFailed && "border-red-500/30 bg-red-500/5",
        isActive && "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isActive && (
            <Loader2 className="h-5 w-5 text-accent animate-spin" />
          )}
          {isCompleted && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          {isFailed && <XCircle className="h-5 w-5 text-red-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm truncate">
              {job.modelName ?? "Loading..."}
            </div>
            {isActive && onCancel && (
              <button
                onClick={() => onCancel(job.id)}
                className="flex-shrink-0 p-1 rounded text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-muted truncate mt-0.5">
            {job.fileName ?? job.source}
          </div>

          {isActive && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-card-hover overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${job.progress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted">
                <span>
                  {formatBytes(job.progress.downloaded)}
                  {job.progress.total > 0 &&
                    ` / ${formatBytes(job.progress.total)}`}
                </span>
                <span>
                  {job.progress.speed > 0 &&
                    `${formatBytes(job.progress.speed)}/s`}
                  {job.progress.eta > 0 &&
                    job.progress.speed > 0 &&
                    ` · ${formatDuration(job.progress.eta)} left`}
                </span>
              </div>
            </div>
          )}

          {isFailed && job.error && (
            <div className="text-xs text-red-400 mt-1">{job.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
