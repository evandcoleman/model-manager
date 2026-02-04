"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

interface NsfwContextValue {
  maxNsfwLevel: number;
  setMaxNsfwLevel: (level: number) => void;
  isBlurred: (nsfwLevel: number) => boolean;
  revealedIds: Set<number>;
  toggleReveal: (id: number) => void;
  revealAll: boolean;
  setRevealAll: (val: boolean) => void;
}

const NsfwContext = createContext<NsfwContextValue | null>(null);

const STORAGE_KEY = "model-manager-nsfw-level";
const DEFAULT_MAX_LEVEL = 2; // blur Mature (8) and above by default

export function NsfwProvider({ children }: { children: ReactNode }) {
  const [maxNsfwLevel, setMaxNsfwLevelState] = useState(DEFAULT_MAX_LEVEL);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      setMaxNsfwLevelState(parseInt(stored, 10));
    }
    setLoaded(true);
  }, []);

  const setMaxNsfwLevel = useCallback((level: number) => {
    setMaxNsfwLevelState(level);
    localStorage.setItem(STORAGE_KEY, String(level));
  }, []);

  const isBlurred = useCallback(
    (nsfwLevel: number) => {
      if (revealAll) return false;
      if (!loaded) return true;
      return nsfwLevel > maxNsfwLevel;
    },
    [maxNsfwLevel, loaded, revealAll]
  );

  const toggleReveal = useCallback((id: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ maxNsfwLevel, setMaxNsfwLevel, isBlurred, revealedIds, toggleReveal, revealAll, setRevealAll }),
    [maxNsfwLevel, setMaxNsfwLevel, isBlurred, revealedIds, toggleReveal, revealAll, setRevealAll]
  );

  return (
    <NsfwContext.Provider value={contextValue}>
      {children}
    </NsfwContext.Provider>
  );
}

export function useNsfw() {
  const ctx = useContext(NsfwContext);
  if (!ctx) throw new Error("useNsfw must be used within NsfwProvider");
  return ctx;
}
