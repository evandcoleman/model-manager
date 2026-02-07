"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ChevronDown, Pencil, Check, X, Upload } from "lucide-react";
import { cn, formatFileSize } from "../../lib/utils";
import { NotesEditor } from "./notes-editor";
import { ImageGallery } from "../images/image-gallery";
import { UploadButton } from "../images/upload-button";
import { UploadDialog } from "../images/upload-dialog";
import type { ModelDetail, VersionDetail } from "../../lib/types";
import { apiFetch } from "../../lib/api-client";

const BASE_MODEL_OPTIONS = [
  "ZImageTurbo",
  "Qwen",
  "SDXL 1.0",
  "SD 1.5",
  "Flux.1",
  "Pony",
  "Wan",
];

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get initial version from URL or default to first
  const getInitialVersion = useCallback((): VersionDetail | null => {
    const versionParam = searchParams.get("version");
    if (versionParam) {
      const versionId = parseInt(versionParam, 10);
      const found = model.versions.find((v) => v.id === versionId);
      if (found) return found;
    }
    return model.versions[0] ?? null;
  }, [searchParams, model.versions]);

  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(getInitialVersion);
  const [editing, setEditing] = useState(false);
  const [baseModel, setBaseModel] = useState(model.baseModel ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Update URL when version changes
  const handleVersionSelect = useCallback((v: VersionDetail) => {
    setSelectedVersion(v);
    const url = new URL(window.location.href);
    if (v.id === model.versions[0]?.id) {
      url.searchParams.delete("version");
    } else {
      url.searchParams.set("version", String(v.id));
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, [model.versions]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/v1/models/${model.id}`, {
        method: "PATCH",
        body: JSON.stringify({ baseModel: baseModel || null }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const handleUploadSuccess = () => {
    setUploadFile(null);
    router.refresh();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setUploadFile(file);
    }
  }, []);

  // Get user-uploaded images from first version
  const displayImages = selectedVersion?.images.filter(img => img.isUserUpload) ?? [];

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
            {model.baseModel && (
              <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
                {model.baseModel}
              </span>
            )}
            <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
              No metadata
            </span>
          </div>

          <h1 className="text-2xl font-bold">{model.name}</h1>

          {/* Edit metadata */}
          <div className="mt-4">
            {editing ? (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted">Base Model:</label>
                <select
                  value={baseModel}
                  onChange={(e) => setBaseModel(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select...</option>
                  {BASE_MODEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setBaseModel(model.baseModel ?? "");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit metadata
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        {/* Version selector */}
        {model.versions.length > 1 && selectedVersion && (
          <div className="mb-6">
            <VersionSelector
              versions={model.versions}
              selected={selectedVersion}
              onSelect={handleVersionSelect}
            />
          </div>
        )}

        {/* Image gallery or dropzone */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Images
            </h2>
            <UploadButton onFileSelect={setUploadFile} />
          </div>

          {displayImages.length > 0 ? (
            <ImageGallery images={displayImages} modelId={model.id} onImageDeleted={() => router.refresh()} />
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "aspect-video rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 flex items-center justify-center border-2 border-dashed transition-colors cursor-pointer",
                isDragging ? "border-accent bg-accent/5" : "border-border hover:border-zinc-600"
              )}
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
            >
              <div className="text-center text-muted">
                <Upload className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
                <p className="text-lg font-medium text-zinc-600">
                  {isDragging ? "Drop image here" : "Drop images or click to upload"}
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  Add your own preview images for this model
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <NotesEditor modelId={model.id} initialNotes={model.notes ?? null} />

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

      {/* Upload dialog */}
      {uploadFile && (
        <UploadDialog
          file={uploadFile}
          modelId={model.id}
          onClose={() => setUploadFile(null)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
