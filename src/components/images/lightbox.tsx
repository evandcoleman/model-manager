"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Copy, Check, ChevronDown, ChevronUp, Trash2, Calendar, Download, Loader2 } from "lucide-react";
import { cn, getImageUrl } from "../../lib/utils";
import { useNsfw } from "../providers/nsfw-provider";
import type { ImageInfo, GenerationParams } from "../../lib/types";
import { apiFetch } from "../../lib/api-client";
import JSZip from "jszip";

function ParamRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-sm text-foreground/90 break-all">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GenerationParamsPanel({
  params,
  prompt,
  isUserUpload,
  createdAt,
}: {
  params: GenerationParams | null;
  prompt: string | null;
  isUserUpload?: boolean;
  createdAt?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [workflowCopied, setWorkflowCopied] = useState(false);
  const displayPrompt = prompt ?? params?.prompt;

  const handleCopyPrompt = useCallback(() => {
    if (!displayPrompt) return;
    navigator.clipboard.writeText(displayPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayPrompt]);

  const handleCopyWorkflow = useCallback(() => {
    if (!params?.comfyWorkflow) return;
    navigator.clipboard.writeText(JSON.stringify(params.comfyWorkflow, null, 2));
    setWorkflowCopied(true);
    setTimeout(() => setWorkflowCopied(false), 2000);
  }, [params?.comfyWorkflow]);

  const handleDownloadWorkflow = useCallback(() => {
    if (!params?.comfyWorkflow) return;
    const blob = new Blob([JSON.stringify(params.comfyWorkflow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [params?.comfyWorkflow]);

  if (!params && !displayPrompt && !isUserUpload) return null;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card overflow-y-auto">
      <div className="p-4">
        {isUserUpload && (
          <div className="mb-4 pb-4 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-accent">
              <span className="px-2 py-0.5 rounded bg-accent/10">User Upload</span>
            </div>
            {createdAt && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
                <Calendar className="h-3 w-3" />
                <span>Uploaded {formatDate(createdAt)}</span>
              </div>
            )}
          </div>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
          Generation Parameters
        </h3>

        {displayPrompt && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted">Prompt</span>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed bg-background rounded-lg p-3 border border-border/50">
              {displayPrompt}
            </p>
          </div>
        )}

        {params && (
          <div className="space-y-2.5">
            <ParamRow label="Seed" value={params.seed} />
            <ParamRow label="Steps" value={params.steps} />
            <ParamRow label="Sampler" value={params.sampler} />
            <ParamRow label="CFG Scale" value={params.cfgScale} />
            <ParamRow label="Scheduler" value={params.scheduler} />
            <ParamRow label="Denoise" value={params.denoise} />

            {params.width && params.height && (
              <ParamRow
                label="Dimensions"
                value={`${params.width} × ${params.height}`}
              />
            )}

            {params.vaes && params.vaes.length > 0 && (
              <div>
                <span className="text-xs text-muted">VAEs</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {params.vaes.map((vae) => (
                    <span
                      key={vae}
                      className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300"
                    >
                      {vae}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {params.loras && params.loras.length > 0 && (
              <div>
                <span className="text-xs text-muted">LoRAs</span>
                <div className="mt-1 space-y-1">
                  {params.loras.map((lora, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded bg-zinc-800 px-2 py-1"
                    >
                      <span className="text-xs font-mono text-zinc-300 truncate">
                        {lora.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        str: {lora.strength}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {params.negativePrompt && (
              <div>
                <span className="text-xs text-muted mb-1.5 block">
                  Negative Prompt
                </span>
                <p className="text-sm text-foreground/60 leading-relaxed bg-background rounded-lg p-3 border border-border/50">
                  {params.negativePrompt}
                </p>
              </div>
            )}

            {params.comfyWorkflow && (
              <div>
                <button
                  onClick={() => setWorkflowExpanded(!workflowExpanded)}
                  className="flex items-center justify-between w-full text-xs text-muted hover:text-foreground transition-colors"
                >
                  <span>ComfyUI Workflow</span>
                  {workflowExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {workflowExpanded && (
                  <div className="mt-2">
                    <div className="flex justify-end gap-3 mb-1">
                      <button
                        onClick={handleDownloadWorkflow}
                        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        onClick={handleCopyWorkflow}
                        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                      >
                        {workflowCopied ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-xs text-foreground/60 bg-background rounded-lg p-3 border border-border/50 overflow-x-auto max-h-60 overflow-y-auto">
                      {JSON.stringify(params.comfyWorkflow, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface LightboxProps {
  images: ImageInfo[];
  initialIndex: number;
  onClose: () => void;
  modelId?: number;
  onDelete?: (imageId: number) => void;
}

export function Lightbox({ images, initialIndex, onClose, modelId, onDelete }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { isBlurred, revealedIds, toggleReveal } = useNsfw();

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom when changing images
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [index]);

  // Handle wheel events for zoom (pinch gesture on trackpad)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Pinch-to-zoom on trackpad reports as wheel with ctrlKey
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.01;
      setScale((prev) => Math.min(Math.max(0.5, prev + delta), 5));
    } else if (scale > 1) {
      // When zoomed in, allow panning with scroll
      e.preventDefault();
      setTranslate((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [scale]);

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [scale]);

  // Mouse drag for panning when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  }, [scale, translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, scale, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Also handle mouse leaving the container
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!modelId || !onDelete) {
      console.error("Delete failed: missing modelId or onDelete callback");
      return;
    }
    const current = images[index];
    if (!current?.isUserUpload) {
      console.error("Delete failed: image is not a user upload");
      return;
    }

    if (!confirm("Delete this image?")) return;

    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/v1/models/${modelId}/images/${current.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(current.id);
        // If this was the last image, close lightbox
        if (images.length === 1) {
          onClose();
        } else if (index >= images.length - 1) {
          setIndex(index - 1);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Delete failed:", res.status, data);
        alert(`Failed to delete image: ${data.error || res.statusText}`);
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
      alert(`Failed to delete image: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  }, [modelId, onDelete, images, index, onClose]);

  const handleDownload = useCallback(async () => {
    const current = images[index];
    if (!current) return;

    const imageUrl = getImageUrl(current, "full");
    if (!imageUrl) return;

    setIsDownloading(true);

    try {
      // Generate filename prefix based on image ID and timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const prefix = `image_${current.id}_${timestamp}`;

      // Fetch the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error("Failed to fetch image");
      const imageBlob = await imageResponse.blob();

      // Determine image extension from content type
      const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
      const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const ext = extMap[contentType] ?? "jpg";

      // Create metadata object
      const metadata = {
        id: current.id,
        width: current.width,
        height: current.height,
        nsfwLevel: current.nsfwLevel,
        prompt: current.prompt,
        generationParams: current.generationParams
          ? { ...current.generationParams, comfyWorkflow: undefined }
          : null,
        isUserUpload: current.isUserUpload,
        createdAt: current.createdAt,
        exportedAt: new Date().toISOString(),
      };

      // Create zip file
      const zip = new JSZip();
      zip.file(`${prefix}.${ext}`, imageBlob);
      zip.file(`${prefix}_metadata.json`, JSON.stringify(metadata, null, 2));

      // Add workflow if available
      if (current.generationParams?.comfyWorkflow) {
        zip.file(
          `${prefix}_workflow.json`,
          JSON.stringify(current.generationParams.comfyWorkflow, null, 2)
        );
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prefix}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsDownloading(false);
    }
  }, [images, index]);

  const current = images[index];
  const fullUrl = current ? getImageUrl(current, "full") : null;
  const shouldBlur =
    current && isBlurred(current.nsfwLevel) && !revealedIds.has(current.id);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (scale > 1) {
          // Reset zoom first, then close on second Escape
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }
      if (e.key === "ArrowLeft" && scale === 1) goPrev();
      if (e.key === "ArrowRight" && scale === 1) goNext();
      // Zoom with +/- or =/- keys
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setScale((prev) => Math.min(5, prev + 0.5));
      }
      if (e.key === "-") {
        e.preventDefault();
        setScale((prev) => Math.max(0.5, prev - 0.5));
      }
      // Reset zoom with 0
      if (e.key === "0") {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext, scale]);

  // Preload adjacent images for instant navigation
  useEffect(() => {
    for (const offset of [-1, 1, 2]) {
      const i = index + offset;
      if (i >= 0 && i < images.length) {
        const url = getImageUrl(images[i], "full");
        if (url) {
          const p = new Image();
          p.src = url;
        }
      }
    }
  }, [index, images]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-black/95">
      {/* Top right buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          title="Download image with metadata"
        >
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </button>
        {current?.isUserUpload && onDelete && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/80 text-red-400 hover:text-white hover:bg-red-800 transition-colors disabled:opacity-50"
            title="Delete image"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-[340px] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Image */}
      <div
        ref={imageContainerRef}
        className="flex flex-1 items-center justify-center p-8 overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {fullUrl && (
          <div
            className="relative max-h-full max-w-full"
            onDoubleClick={handleDoubleClick}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
          >
            <img
              src={fullUrl}
              alt={current.prompt?.slice(0, 80) ?? "Full resolution image"}
              className={cn(
                "max-h-[90vh] max-w-full object-contain select-none",
                shouldBlur && "blur-3xl scale-105"
              )}
              draggable={false}
              onError={(e) => {
                // Show error message for broken full-resolution images
                const target = e.currentTarget;
                console.error(`Failed to load full image ${current.id}:`, fullUrl);
                // Replace with error placeholder
                target.alt = "Failed to load image (possible auth error)";
                target.style.opacity = "0.3";
              }}
            />
            {shouldBlur && (
              <button
                onClick={() => toggleReveal(current.id)}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white/80">
                  Click to reveal
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Generation params panel */}
      <GenerationParamsPanel
        params={current.generationParams}
        prompt={current.prompt}
        isUserUpload={current.isUserUpload}
        createdAt={current.createdAt}
      />

      {/* Image counter and zoom indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-400">
          {index + 1} / {images.length}
        </div>
        {scale !== 1 && (
          <div className="rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-400">
            {Math.round(scale * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
