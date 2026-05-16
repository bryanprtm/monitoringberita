import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FeedSource } from "@/lib/feeds";
import { useAuth } from "@/hooks/useAuth";

type DbRow = {
  id: string;
  slug: string;
  name: string;
  url: string;
  category: string;
  is_default: boolean;
  created_by: string | null;
};

function toFeedSource(r: DbRow): FeedSource & { dbId: string; isDefault: boolean; createdBy: string | null } {
  return {
    id: r.slug,
    name: r.name,
    url: r.url,
    category: r.category,
    dbId: r.id,
    isDefault: r.is_default,
    createdBy: r.created_by,
  };
}

export function useFeedSources() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReturnType<typeof toFeedSource>[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("rss_sources")
      .select("id, slug, name, url, category, is_default, created_by")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []).map(toFeedSource));
      setError(null);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const addCustom = useCallback(
    async (src: { name: string; url: string; category: string }) => {
      if (!user) throw new Error("Login required");
      const slug =
        "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      const { error } = await supabase.from("rss_sources").insert({
        slug,
        name: src.name,
        url: src.url,
        category: src.category,
        is_default: false,
        created_by: user.id,
      });
      if (error) throw error;
      await load();
    },
    [user, load]
  );

  const remove = useCallback(
    async (slug: string) => {
      const row = rows.find((r) => r.id === slug);
      if (!row) return;
      const { error } = await supabase.from("rss_sources").delete().eq("id", row.dbId);
      if (error) throw error;
      await load();
    },
    [rows, load]
  );

  // No-op stubs to keep ManageFeedsModal API compatible
  const restoreDefault = useCallback(async (_id: string) => {}, []);
  const resetAll = useCallback(async () => {}, []);

  return {
    sources: rows as FeedSource[],
    removed: [] as string[],
    hydrated,
    error,
    reload: load,
    addCustom,
    remove,
    restoreDefault,
    resetAll,
  };
}
