"use client";

import Link from "next/link";
import { Download, ThumbsUp } from "lucide-react";
import { cn, formatNumber } from "../../lib/utils";
import { useNsfw } from "../providers/nsfw-provider";
import type { ModelListItem } from "../../lib/types";

const TYPE_COLORS: Record<string, string> = {
  LORA: "bg-purple-500/20 text-purple-400",
  LoRA: "bg-purple-500/20 text-purple-400",
  Checkpoint: "bg-blue-500/20 text-blue-400",
  VAE: "bg-green-500/20 text-green-400",
  ControlNet: "bg-orange-500/20 text-orange-400",
  Embedding: "bg-pink-500/20 text-pink-400",
  Upscaler: "bg-teal-500/20 text-teal-400",
};

function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/images${path}`;
}

export function ModelCard({ model }: { model: ModelListItem }) {
  const { isBlurred, revealedIds, toggleReveal } = useNsfw();
  const heroNsfwLevel = model.heroImage?.nsfwLevel ?? model.nsfwLevel;
  const shouldBlur =
    isBlurred(heroNsfwLevel) && !revealedIds.has(model.id);

  const thumbUrl = imageUrl(model.heroImage?.thumbPath);
  const typeColor =
    TYPE_COLORS[model.type] ?? "bg-zinc-500/20 text-zinc-400";

  return (
    <Link
      href={`/models/${model.id}`}
      className="group block break-inside-avoid mb-4"
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 hover:scale-[1.02]">
        {/* Hero image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
          {thumbUrl ? (
            <>
              <img
                src={thumbUrl}
                alt={model.name}
                className={cn(
                  "h-full w-full object-cover object-top transition-all duration-300",
                  shouldBlur && "blur-2xl scale-110"
                )}
                loading="lazy"
              />
              {shouldBlur && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleReveal(model.id);
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <span className="rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white/80">
                    Click to reveal
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
              <span className="text-2xl font-bold text-zinc-700">
                {model.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                typeColor
              )}
            >
              {model.type}
            </span>
            {model.baseModel && (
              <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 backdrop-blur-sm">
                {model.baseModel}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-medium leading-snug line-clamp-2 text-foreground group-hover:text-accent transition-colors">
            {model.name}
          </h3>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted">
              {model.stats.downloadCount != null && (
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {formatNumber(model.stats.downloadCount)}
                </span>
              )}
              {model.stats.thumbsUpCount != null && (
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {formatNumber(model.stats.thumbsUpCount)}
                </span>
              )}
            </div>

            {model.creatorName && (
              <div className="flex items-center gap-1.5">
                {model.creatorAvatar && (
                  <img
                    src={model.creatorAvatar}
                    alt=""
                    className="h-4 w-4 rounded-full"
                    loading="lazy"
                  />
                )}
                <span className="text-xs text-muted truncate max-w-[100px]">
                  {model.creatorName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
