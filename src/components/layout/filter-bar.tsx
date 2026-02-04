"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import { useNsfw } from "../providers/nsfw-provider";
import type { FilterOptions } from "../../lib/types";

export interface ActiveFilters {
  category?: string;
  baseModel?: string;
  tags: string[];
  sort: string;
  showNoMetadata: boolean;
}

interface FilterBarProps {
  filters: ActiveFilters;
  options: FilterOptions;
  total: number;
  onFilterChange: (filters: ActiveFilters) => void;
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors",
          value
            ? "border-accent/50 bg-accent/10 text-accent"
            : "border-border bg-card text-muted hover:text-foreground"
        )}
      >
        {value || label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-40 max-h-64 w-48 overflow-auto rounded-xl border border-border bg-card shadow-xl">
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={cn(
              "w-full px-3 py-2 text-left text-sm hover:bg-card-hover transition-colors",
              !value ? "text-accent" : "text-foreground/80"
            )}
          >
            All {label}s
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-card-hover transition-colors",
                value === opt ? "text-accent" : "text-foreground/80"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
  { value: "downloads", label: "Downloads" },
  { value: "likes", label: "Likes" },
];

export function FilterBar({
  filters,
  options,
  total,
  onFilterChange,
}: FilterBarProps) {
  const { revealAll, setRevealAll } = useNsfw();
  const hasActiveFilters =
    filters.category || filters.baseModel || filters.tags.length > 0 || filters.showNoMetadata;

  return (
    <div className="sticky top-14 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-2.5">
        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => onFilterChange({ ...filters, category: undefined })}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm transition-colors",
              !filters.category
                ? "bg-accent text-white"
                : "bg-card text-muted hover:text-foreground border border-border"
            )}
          >
            All
          </button>
          {options.categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                onFilterChange({
                  ...filters,
                  category: filters.category === cat ? undefined : cat,
                })
              }
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-sm transition-colors",
                filters.category === cat
                  ? "bg-accent text-white"
                  : "bg-card text-muted hover:text-foreground border border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Base model dropdown */}
        <Dropdown
          label="Base Model"
          value={filters.baseModel ?? ""}
          options={options.baseModels}
          onChange={(val) =>
            onFilterChange({ ...filters, baseModel: val || undefined })
          }
        />

        {/* Sort dropdown */}
        <Dropdown
          label="Sort"
          value={
            SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ??
            "Newest"
          }
          options={SORT_OPTIONS.map((o) => o.label)}
          onChange={(val) => {
            const opt = SORT_OPTIONS.find((o) => o.label === val);
            onFilterChange({
              ...filters,
              sort: opt?.value ?? "newest",
            });
          }}
        />

        <div className="h-5 w-px bg-border shrink-0" />

        {/* NSFW reveal toggle */}
        <button
          onClick={() => setRevealAll(!revealAll)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors",
            revealAll
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border bg-card text-muted hover:text-foreground"
          )}
        >
          {revealAll ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          NSFW
        </button>

        {/* Show models without metadata */}
        <button
          onClick={() =>
            onFilterChange({
              ...filters,
              showNoMetadata: !filters.showNoMetadata,
            })
          }
          className={cn(
            "shrink-0 rounded-lg border px-3 py-1 text-sm transition-colors",
            filters.showNoMetadata
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border bg-card text-muted hover:text-foreground"
          )}
        >
          No metadata
        </button>

        <div className="flex-1" />

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5">
            {filters.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
              >
                {tag}
                <button
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      tags: filters.tags.filter((t) => t !== tag),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() =>
                onFilterChange({
                  category: undefined,
                  baseModel: undefined,
                  tags: [],
                  sort: filters.sort,
                  showNoMetadata: false,
                })
              }
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        <span className="text-xs text-muted shrink-0">
          {total} model{total !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
