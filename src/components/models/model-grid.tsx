"use client";

import { useRef, useEffect, useMemo } from "react";
import { ModelCard } from "./model-card";
import { Spinner } from "../ui/spinner";
import type { ModelListItem } from "../../lib/types";

interface ModelGridProps {
  models: ModelListItem[];
  hasMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
}

function useColumns() {
  // Return column count based on breakpoints matching tailwind's sm/lg/xl
  // We read once on mount and listen for resize
  const getCount = () => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  };

  const ref = useRef(getCount());

  useEffect(() => {
    const handler = () => {
      ref.current = getCount();
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return getCount();
}

export function ModelGrid({
  models,
  hasMore,
  onLoadMore,
  loading,
}: ModelGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumns();

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  // Distribute models into fixed columns round-robin so appending
  // new items never causes existing items to shift columns.
  const columns = useMemo(() => {
    const cols: ModelListItem[][] = Array.from(
      { length: columnCount },
      () => []
    );
    models.forEach((model, i) => {
      cols[i % columnCount].push(model);
    });
    return cols;
  }, [models, columnCount]);

  if (models.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted">
        <p className="text-lg">No models found</p>
        <p className="mt-1 text-sm">Try adjusting your filters or search</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-4">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex-1 min-w-0">
            {col.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
