"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Image as ImageIcon, Box, LayoutGrid, List } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn, getImageUrl } from "@/lib/utils";
import { useNsfw } from "@/components/providers/nsfw-provider";
import { Lightbox } from "@/components/images/lightbox";
import { subscribeToUploads } from "@/lib/upload-events";
import type { ImageInfo } from "@/lib/types";

type ViewMode = "feed" | "grid";

interface FeedImage extends ImageInfo {
  modelId: number;
  versionId: number | null;
  modelName: string | null;
  modelType: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function ImagesFeed() {
  const [images, setImages] = useState<FeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const { isBlurred, revealedIds, toggleReveal } = useNsfw();

  useEffect(() => {
    const saved = localStorage.getItem("uploads-view-mode") as ViewMode | null;
    if (saved === "feed" || saved === "grid") {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("uploads-view-mode", mode);
  };

  const fetchImages = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await apiFetch(`/api/v1/images/recent?limit=50&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setImages((prev) => [...prev, ...data.images]);
        } else {
          setImages(data.images);
        }
        setHasMore(data.hasMore);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Auto-refresh when a new image is uploaded (works across tabs)
  useEffect(() => {
    return subscribeToUploads(() => {
      // Refresh the feed to show the new image
      fetchImages();
    });
  }, [fetchImages]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchImages(images.length, true);
    }
  };

  const handleImageDeleted = (imageId: number) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  // Convert to ImageInfo array for lightbox
  const lightboxImages: ImageInfo[] = images.map((img) => ({
    id: img.id,
    width: img.width,
    height: img.height,
    nsfwLevel: img.nsfwLevel,
    prompt: img.prompt,
    generationParams: img.generationParams,
    blurhash: img.blurhash,
    sortOrder: 0,
    isUserUpload: true,
    createdAt: img.createdAt,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Gallery
          </Link>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-semibold tracking-tight">Recent Uploads</h1>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => handleViewModeChange("feed")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                viewMode === "feed"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              )}
              title="Feed view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewModeChange("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className={cn(
        "mx-auto px-4 py-6",
        viewMode === "feed" ? "max-w-2xl" : "max-w-[1800px]"
      )}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="mx-auto h-12 w-12 text-muted mb-4" />
            <p className="text-muted">No uploaded images yet</p>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View - row by row */
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {images.map((img, index) => {
                // All images in the feed are user uploads
                const thumbUrl = getImageUrl({ ...img, isUserUpload: true }, "thumb");
                const shouldBlur =
                  isBlurred(img.nsfwLevel) && !revealedIds.has(img.id);

                if (!thumbUrl) return null;

                return (
                  <div key={img.id} className="group">
                    <button
                      onClick={() => {
                        if (shouldBlur) {
                          toggleReveal(img.id);
                        } else {
                          setLightboxIndex(index);
                        }
                      }}
                      className="relative block w-full aspect-square overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <img
                        src={thumbUrl}
                        alt={img.prompt?.slice(0, 80) ?? "Uploaded image"}
                        className={cn(
                          "w-full h-full object-cover transition-all duration-300",
                          shouldBlur && "blur-2xl scale-110",
                          !shouldBlur && "group-hover:scale-105"
                        )}
                        loading="lazy"
                      />
                      {shouldBlur && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white/80">
                            Click to reveal
                          </span>
                        </div>
                      )}
                      {!shouldBlur && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/models/${img.modelId}${img.versionId ? `?version=${img.versionId}` : ""}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-white/90 hover:text-white font-medium truncate block"
                          >
                            {img.modelName || "Unknown Model"}
                          </Link>
                          {img.createdAt && (
                            <span className="text-[10px] text-white/60">
                              {formatDate(img.createdAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium hover:bg-card-hover transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          /* Feed View - social network style */
          <div className="space-y-6">
            {images.map((img, index) => {
              // All images in the feed are user uploads
              const fullUrl = getImageUrl({ ...img, isUserUpload: true }, "full");
              const shouldBlur =
                isBlurred(img.nsfwLevel) && !revealedIds.has(img.id);

              if (!fullUrl) return null;

              return (
                <article
                  key={img.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <Box className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/models/${img.modelId}${img.versionId ? `?version=${img.versionId}` : ""}`}
                        className="font-medium text-foreground hover:text-accent transition-colors truncate block"
                      >
                        {img.modelName || "Unknown Model"}
                      </Link>
                      {img.modelType && (
                        <span className="text-xs text-muted">{img.modelType}</span>
                      )}
                    </div>
                    {img.createdAt && (
                      <span className="text-xs text-muted whitespace-nowrap">
                        {formatDate(img.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Image */}
                  <button
                    onClick={() => {
                      if (shouldBlur) {
                        toggleReveal(img.id);
                      } else {
                        setLightboxIndex(index);
                      }
                    }}
                    className="relative block w-full focus:outline-none"
                  >
                    <img
                      src={fullUrl}
                      alt={img.prompt?.slice(0, 80) ?? "Uploaded image"}
                      className={cn(
                        "w-full transition-all duration-300",
                        shouldBlur && "blur-2xl scale-105"
                      )}
                      loading="lazy"
                      style={{
                        aspectRatio:
                          img.width && img.height
                            ? `${img.width}/${img.height}`
                            : undefined,
                      }}
                    />
                    {shouldBlur && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="rounded-lg bg-black/60 px-3 py-1.5 text-sm text-white/90">
                          Click to reveal
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Footer - Prompt */}
                  {img.prompt && (
                    <div className="px-4 py-3 border-t border-border/50">
                      <p className="text-sm text-foreground/80 line-clamp-3">
                        {img.prompt}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}

            {hasMore && (
              <div className="pt-4 pb-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium hover:bg-card-hover transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {lightboxIndex != null && images[lightboxIndex] && (
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          modelId={images[lightboxIndex].modelId}
          onDelete={handleImageDeleted}
        />
      )}
    </div>
  );
}
