"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ChevronDown } from "lucide-react";
import { cn, formatFileSize } from "../../lib/utils";
import type { ModelDetail, VersionDetail } from "../../lib/types";

function VersionSelector({
  versions,
  selected,
  onSelect,
}: {
  versions: VersionDetail[];
  selected: VersionDetail;
  onSelect: (v: VersionDetail) => void;
}) {
  const [open, setOpen] = useState(false);

  if (versions.length <= 1) {
    return (
      <span className="text-sm text-muted">
        Version: {selected.name}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:border-accent/50 transition-colors"
      >
        {selected.name}
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-30 w-64 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                onSelect(v);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-card-hover transition-colors",
                v.id === selected.id && "text-accent"
              )}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModelPlaceholder({ model }: { model: ModelDetail }) {
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(
    model.versions[0] ?? null
  );

  return (
    <div className="min-h-screen pb-12">
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to gallery
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <span className="rounded-md bg-zinc-700/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {model.type}
            </span>
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
              No metadata
            </span>
          </div>

          <h1 className="text-2xl font-bold">{model.name}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        {/* Version selector */}
        {model.versions.length > 1 && selectedVersion && (
          <div className="mb-6">
            <VersionSelector
              versions={model.versions}
              selected={selectedVersion}
              onSelect={setSelectedVersion}
            />
          </div>
        )}

        {/* Gradient placeholder */}
        <div className="mb-8 aspect-video rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 flex items-center justify-center border border-border">
          <div className="text-center text-muted">
            <FileText className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-600">
              No preview images available
            </p>
            <p className="mt-1 text-sm text-zinc-700">
              This model was imported without CivitAI metadata
            </p>
          </div>
        </div>

        {/* File info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            File Information
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted">Filename</span>
              <span className="font-mono text-foreground/80">
                {(selectedVersion?.localPath ?? model.filePath).split("/").pop()}
              </span>
            </div>
            {(selectedVersion?.localFileSize ?? model.fileSize) && (
              <div className="flex items-center gap-3">
                <span className="w-24 text-muted">Size</span>
                <span className="text-foreground/80">
                  {formatFileSize(selectedVersion?.localFileSize ?? model.fileSize ?? 0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted">Category</span>
              <span className="text-foreground/80">{model.category}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted">Path</span>
              <span className="font-mono text-xs text-foreground/60 break-all">
                {selectedVersion?.localPath ?? model.filePath}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
