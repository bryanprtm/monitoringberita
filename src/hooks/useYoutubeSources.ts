import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type YoutubeSource = {
  id: string;
  name: string;
  url: string;
  category: string;
  createdBy: string | null;
};

type DbRow = {
  id: string;
  name: string;
  url: string;
  category: string;
  created_by: string | null;
};

function toModel(r: DbRow): YoutubeSource {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    category: r.category,
    createdBy: r.created_by,
  };
}

export function useYoutubeSources() {
  const { user } = useAuth();
  const [sources, setSources] = useState<YoutubeSource[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("youtube_sources")
      .select("id, name, url, category, created_by")
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      setSources([]);
    } else {
      setSources((data ?? []).map(toModel));
      setError(null);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const add = useCallback(
    async (src: { name: string; url: string; category: string }) => {
      if (!user) throw new Error("Login required");
      const { error } = await supabase.from("youtube_sources").insert({
        name: src.name,
        url: src.url,
        category: src.category,
        created_by: user.id,
      });
      if (error) throw error;
      await load();
    },
    [user, load]
  );

  const update = useCallback(
    async (id: string, patch: { name: string; url: string; category: string }) => {
      const { error } = await supabase
        .from("youtube_sources")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("youtube_sources").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  return { sources, hydrated, error, reload: load, add, update, remove };
}
