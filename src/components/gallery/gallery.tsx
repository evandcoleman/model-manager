"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "../layout/top-bar";
import { FilterBar, type ActiveFilters } from "../layout/filter-bar";
import { ModelGrid } from "../models/model-grid";
import type { ModelListItem, FilterOptions, PaginatedResult } from "../../lib/types";
import { apiFetch } from "../../lib/api-client";

interface GalleryProps {
  initialData: PaginatedResult<ModelListItem>;
  initialFilters: FilterOptions;
}

const SCROLL_KEY = "gallery-scroll-state";

export function Gallery({ initialData, initialFilters }: GalleryProps) {
  const searchParams = useSearchParams();

  const [models, setModels] = useState<ModelListItem[]>(initialData.items);
  const [total, setTotal] = useState(initialData.total);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialFilters);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filters, setFilters] = useState<ActiveFilters>({
    category: searchParams.get("category") ?? undefined,
    baseModel: searchParams.get("baseModel") ?? undefined,
    tags: searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
    sort: searchParams.get("sort") ?? "newest",
    showNoMetadata: searchParams.get("showNoMetadata") === "true",
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1);
  const isRestoringRef = useRef(false);

  const fetchModels = useCallback(
    async (pageNum: number, append: boolean = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (filters.category) params.set("category", filters.category);
        if (filters.baseModel) params.set("baseModel", filters.baseModel);
        if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
        if (filters.sort && filters.sort !== "newest")
          params.set("sort", filters.sort);
        if (!filters.showNoMetadata)
          params.set("hasMetadata", "true");
        params.set("page", String(pageNum));
        params.set("limit", "40");

        const res = await apiFetch(`/api/v1/models?${params}`);
        const data: PaginatedResult<ModelListItem> = await res.json();

        if (append) {
          setModels((prev) => [...prev, ...data.items]);
        } else {
          setModels(data.items);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(pageNum);
        pageRef.current = pageNum;
      } finally {
        setLoading(false);
      }
    },
    [search, filters]
  );

  // Sync filters → URL (no Next.js navigation, just URL bar update)
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filters.category) params.set("category", filters.category);
    if (filters.baseModel) params.set("baseModel", filters.baseModel);
    if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
    if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.showNoMetadata) params.set("showNoMetadata", "true");
    const qs = params.toString();
    const url = qs ? `/?${qs}` : "/";
    window.history.replaceState(window.history.state, "", url);
  }, [search, filters]);

  // Re-fetch when filters change (skip during scroll restoration)
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchModels(1);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchModels]);

  // Save scroll position + page to sessionStorage (throttled via rAF)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          sessionStorage.setItem(
            SCROLL_KEY,
            JSON.stringify({ scrollY: window.scrollY, page: pageRef.current })
          );
          ticking = false;
        });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Restore scroll position + pagination on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw) as { scrollY: number; page: number };
    if (saved.page > 1) {
      isRestoringRef.current = true;
      (async () => {
        for (let p = 2; p <= saved.page; p++) {
          await fetchModels(p, true);
        }
        isRestoringRef.current = false;
        requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
      })();
    } else {
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollY));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchModels(pageRef.current + 1, true);
  }, [fetchModels]);

  const handleRescan = useCallback(async () => {
    setIsScanning(true);
    try {
      await apiFetch("/api/v1/scan", { method: "POST" });
      // Refresh filter options and models
      const filtersRes = await apiFetch("/api/v1/models/filters");
      const newFilters: FilterOptions = await filtersRes.json();
      setFilterOptions(newFilters);
      await fetchModels(1);
    } finally {
      setIsScanning(false);
    }
  }, [fetchModels]);

  return (
    <div className="min-h-screen">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        onRescan={handleRescan}
        isScanning={isScanning}
      />
      <FilterBar
        filters={filters}
        options={filterOptions}
        total={total}
        onFilterChange={setFilters}
      />
      <main className="mx-auto max-w-[1800px] px-4 pt-[7.5rem] pb-8">
        <ModelGrid
          models={models}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          loading={loading}
        />
      </main>
    </div>
  );
}
