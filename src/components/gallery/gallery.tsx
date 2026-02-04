"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TopBar } from "../layout/top-bar";
import { FilterBar, type ActiveFilters } from "../layout/filter-bar";
import { ModelGrid } from "../models/model-grid";
import type { ModelListItem, FilterOptions, PaginatedResult } from "../../lib/types";

interface GalleryProps {
  initialData: PaginatedResult<ModelListItem>;
  initialFilters: FilterOptions;
}

export function Gallery({ initialData, initialFilters }: GalleryProps) {
  const [models, setModels] = useState<ModelListItem[]>(initialData.items);
  const [total, setTotal] = useState(initialData.total);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialFilters);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>({
    tags: [],
    sort: "newest",
    showNoMetadata: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1);

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

        const res = await fetch(`/api/models?${params}`);
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

  // Re-fetch when filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchModels(1);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchModels]);

  const handleLoadMore = useCallback(() => {
    fetchModels(pageRef.current + 1, true);
  }, [fetchModels]);

  const handleRescan = useCallback(async () => {
    setIsScanning(true);
    try {
      await fetch("/api/scan", { method: "POST" });
      // Refresh filter options and models
      const filtersRes = await fetch("/api/models/filters");
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
