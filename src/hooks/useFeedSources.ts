import { useEffect, useState, useCallback } from "react";
import { DEFAULT_FEED_SOURCES, type FeedSource } from "@/lib/feeds";

const STORAGE_KEY = "ncc.customFeeds.v1";
const REMOVED_KEY = "ncc.removedDefaults.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useFeedSources() {
  const [custom, setCustom] = useState<FeedSource[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCustom(safeParse<FeedSource[]>(localStorage.getItem(STORAGE_KEY), []));
    setRemoved(safeParse<string[]>(localStorage.getItem(REMOVED_KEY), []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }, [custom, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(REMOVED_KEY, JSON.stringify(removed));
  }, [removed, hydrated]);

  const sources: FeedSource[] = [
    ...DEFAULT_FEED_SOURCES.filter((s) => !removed.includes(s.id)),
    ...custom,
  ];

  const addCustom = useCallback((src: Omit<FeedSource, "id"> & { id?: string }) => {
    const id = (src.id || `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`).replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
    setCustom((prev) => [...prev, { ...src, id }]);
  }, []);

  const remove = useCallback((id: string) => {
    const isDefault = DEFAULT_FEED_SOURCES.some((s) => s.id === id);
    if (isDefault) {
      setRemoved((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setCustom((prev) => prev.filter((s) => s.id !== id));
    }
  }, []);

  const restoreDefault = useCallback((id: string) => {
    setRemoved((prev) => prev.filter((x) => x !== id));
  }, []);

  const resetAll = useCallback(() => {
    setCustom([]);
    setRemoved([]);
  }, []);

  return { sources, custom, removed, hydrated, addCustom, remove, restoreDefault, resetAll };
}
