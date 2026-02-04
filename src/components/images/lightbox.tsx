"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNsfw } from "../providers/nsfw-provider";
import type { ImageInfo, GenerationParams } from "../../lib/types";

function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/images${path}`;
}

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

function GenerationParamsPanel({
  params,
  prompt,
}: {
  params: GenerationParams | null;
  prompt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const displayPrompt = prompt ?? params?.prompt;

  const handleCopyPrompt = useCallback(() => {
    if (!displayPrompt) return;
    navigator.clipboard.writeText(displayPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayPrompt]);

  if (!params && !displayPrompt) return null;

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card overflow-y-auto">
      <div className="p-4">
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
}

export function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const { isBlurred, revealedIds, toggleReveal } = useNsfw();

  const current = images[index];
  const fullUrl = imageUrl(current?.localPath);
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
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  // Preload adjacent images for instant navigation
  useEffect(() => {
    for (const offset of [-1, 1, 2]) {
      const i = index + offset;
      if (i >= 0 && i < images.length) {
        const url = imageUrl(images[i].localPath);
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
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

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
      <div className="flex flex-1 items-center justify-center p-8">
        {fullUrl && (
          <div className="relative max-h-full max-w-full">
            <img
              src={fullUrl}
              alt={current.prompt?.slice(0, 80) ?? "Full resolution image"}
              className={cn(
                "max-h-[90vh] max-w-full object-contain transition-all duration-300",
                shouldBlur && "blur-3xl scale-105"
              )}
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
      />

      {/* Image counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800/80 px-3 py-1 text-xs text-zinc-400">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}
