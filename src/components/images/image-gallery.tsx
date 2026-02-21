"use client";

import { useState } from "react";
import { cn, getImageUrl } from "../../lib/utils";
import { useNsfw } from "../providers/nsfw-provider";
import { Lightbox } from "./lightbox";
import type { ImageInfo } from "../../lib/types";

interface ImageGalleryProps {
  images: ImageInfo[];
  modelId?: number;
  onImageDeleted?: () => void;
}

export function ImageGallery({ images, modelId, onImageDeleted }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [localImages, setLocalImages] = useState(images);
  const { isBlurred, revealedIds, toggleReveal } = useNsfw();

  // Update local images when prop changes
  if (images !== localImages && images.length !== localImages.length) {
    setLocalImages(images);
  }

  const handleDelete = (imageId: number) => {
    setLocalImages((prev) => prev.filter((img) => img.id !== imageId));
    onImageDeleted?.();
  };

  if (localImages.length === 0) return null;

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {localImages.map((img, index) => {
          const thumbUrl = getImageUrl(img, "thumb");
          const shouldBlur =
            isBlurred(img.nsfwLevel) && !revealedIds.has(img.id);

          if (!thumbUrl) return null;

          return (
            <button
              key={img.id}
              onClick={() => {
                if (shouldBlur) {
                  toggleReveal(img.id);
                } else {
                  setLightboxIndex(index);
                }
              }}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <img
                src={thumbUrl}
                alt={img.prompt?.slice(0, 80) ?? "Model image"}
                className={cn(
                  "w-full transition-all duration-300",
                  shouldBlur && "blur-2xl scale-110",
                  !shouldBlur &&
                    "group-hover:brightness-110 group-hover:scale-[1.02]"
                )}
                loading="lazy"
                style={{
                  aspectRatio:
                    img.width && img.height
                      ? `${img.width}/${img.height}`
                      : undefined,
                }}
                onError={(e) => {
                  // Hide broken images gracefully (e.g., auth errors)
                  const target = e.currentTarget;
                  target.style.display = "none";
                  console.warn(`Failed to load image ${img.id}:`, thumbUrl);
                }}
              />
              {shouldBlur && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white/80">
                    Click to reveal
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {lightboxIndex != null && (
        <Lightbox
          images={localImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          modelId={modelId}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
