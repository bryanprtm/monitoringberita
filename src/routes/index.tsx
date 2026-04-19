import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAllFeeds, fetchFeeds, FEED_SOURCES, type FeedsPayload } from "@/lib/feeds";
import { LiveClock } from "@/components/LiveClock";
import { Ticker } from "@/components/Ticker";
import { SourcePanel } from "@/components/SourcePanel";
import { NewsRow } from "@/components/NewsRow";
import { ManageFeedsModal } from "@/components/ManageFeedsModal";
import { useFeedSources } from "@/hooks/useFeedSources";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEWS COMMAND CENTER — Live RSS Monitoring Dashboard" },
      {
        name: "description",
        content:
          "Real-time aggregated news monitoring from multiple RSS sources. Command-center style dashboard with custom feed support.",
      },
      { property: "og:title", content: "NEWS COMMAND CENTER" },
      { property: "og:description", content: "Live RSS news monitoring dashboard." },
    ],
  }),
  loader: () => fetchAllFeeds(),
  component: Dashboard,
});

const REFRESH_MS = 60_000;

function Dashboard() {
  const initial = Route.useLoaderData() as FeedsPayload;
  const { sources: configuredSources, removed, hydrated, addCustom, remove, restoreDefault, resetAll } =
    useFeedSources();

  const [data, setData] = useState<FeedsPayload>(initial);
  const [activeSource, setActiveSource] = useState<string | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [isFetching, setIsFetching] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const lastSigRef = useRef<string>("");

  const refresh = async (sources: typeof configuredSources) => {
    if (sources.length === 0) {
      setData({ fetchedAt: Date.now(), sources: [] });
      return;
    }
    setIsFetching(true);
    try {
      const next = await fetchFeeds({ data: { sources } });
      setData(next);
    } finally {
      setIsFetching(false);
    }
  };

  // Re-fetch when source list changes (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    const sig = JSON.stringify(configuredSources.map((s) => s.id + s.url));
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    // First hydration with no customizations: keep loader data
    const defaultSig = JSON.stringify(FEED_SOURCES.map((s) => s.id + s.url));
    if (sig === defaultSig && data === initial) {
      setCountdown(REFRESH_MS / 1000);
      return;
    }
    refresh(configuredSources);
    setCountdown(REFRESH_MS / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, configuredSources]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refresh(configuredSources);
          return REFRESH_MS / 1000;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredSources]);

  const allItems = useMemo(() => {
    return data.sources
      .flatMap((s) => s.items)
      .sort((a, b) => b.pubTimestamp - a.pubTimestamp);
  }, [data]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (activeSource !== "ALL") list = list.filter((i) => i.sourceId === activeSource);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 200);
  }, [allItems, activeSource, query]);

  const onlineCount = data.sources.filter((s) => s.status === "ONLINE").length;
  const totalItems = allItems.length;
  const avgPing = Math.round(
    data.sources.reduce((a, s) => a + s.responseMs, 0) / Math.max(1, data.sources.length)
  );
  const offlineCount = data.sources.filter((s) => s.status === "OFFLINE").length;

  const systemStatus = offlineCount === 0 ? "NOMINAL" : offlineCount < 3 ? "DEGRADED" : "CRITICAL";
  const statusColor =
    systemStatus === "NOMINAL"
      ? "text-success"
      : systemStatus === "DEGRADED"
        ? "text-warning glow-amber"
        : "text-danger glow-danger";

  return (
    <div className="min-h-screen scanline">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">
        {/* HEADER */}
        <header className="panel relative px-5 py-3 flex items-center justify-between">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-cyan flex items-center justify-center">
                <span className="text-cyan glow-cyan text-lg font-bold">◉</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-[0.25em] text-cyan glow-cyan">
                  NEWS COMMAND CENTER
                </h1>
                <p className="text-[10px] tracking-widest text-muted-foreground mt-0.5">
                  RSS AGGREGATION · MULTI-SOURCE INTEL · v1.0.0
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-xs">
              <div className="text-muted-foreground tracking-widest text-[10px]">SYSTEM</div>
              <div className={`font-bold tracking-widest ${statusColor}`}>{systemStatus}</div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground tracking-widest text-[10px]">REFRESH IN</div>
              <div className="text-amber glow-amber font-bold tracking-widest">
                T-{String(Math.floor(countdown)).padStart(2, "0")}s
              </div>
            </div>
            <LiveClock />
          </div>
        </header>

        {/* TICKER */}
        <Ticker items={allItems} />

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "FEEDS ONLINE", value: `${onlineCount}/${data.sources.length}`, accent: "text-success" },
            { label: "TOTAL ARTICLES", value: String(totalItems).padStart(4, "0"), accent: "text-cyan glow-cyan" },
            { label: "AVG LATENCY", value: `${avgPing}ms`, accent: "text-amber glow-amber" },
            { label: "OFFLINE", value: String(offlineCount).padStart(2, "0"), accent: offlineCount > 0 ? "text-danger glow-danger" : "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="panel relative px-4 py-3">
              <div className="text-[10px] tracking-widest text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold font-mono mt-1 ${s.accent}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-12 gap-4">
          {/* SOURCES */}
          <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-[11px] tracking-widest text-cyan glow-cyan font-bold">
                ▍ SOURCES [{data.sources.length}]
                {isFetching && <span className="ml-2 text-amber blink">◌ SYNC</span>}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setManageOpen(true)}
                  className="text-[10px] tracking-widest px-2 py-0.5 border border-amber text-amber glow-amber hover:bg-amber hover:text-background transition-colors"
                  title="Add or remove RSS sources"
                >
                  + MANAGE
                </button>
                <button
                  onClick={() => setActiveSource("ALL")}
                  className={`text-[10px] tracking-widest px-2 py-0.5 border ${
                    activeSource === "ALL"
                      ? "border-cyan text-cyan glow-cyan"
                      : "border-panel-border text-muted-foreground hover:text-cyan hover:border-cyan"
                  } transition-colors`}
                >
                  SHOW ALL
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {data.sources.map((feed) => (
                <SourcePanel
                  key={feed.sourceId}
                  feed={feed}
                  active={activeSource === feed.sourceId}
                  onSelect={() =>
                    setActiveSource(activeSource === feed.sourceId ? "ALL" : feed.sourceId)
                  }
                />
              ))}
            </div>
          </aside>

          {/* FEED */}
          <section className="col-span-12 lg:col-span-8 xl:col-span-9">
            <div className="panel relative">
              <span className="corner-tl" />
              <span className="corner-tr" />
              <div className="panel-header px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h2 className="text-[11px] tracking-widest text-cyan glow-cyan font-bold">
                    ▍ INTEL FEED
                  </h2>
                  <span className="text-[10px] text-muted-foreground tracking-widest">
                    {activeSource === "ALL"
                      ? "ALL SOURCES"
                      : configuredSources.find((s) => s.id === activeSource)?.name ?? activeSource}{" "}
                    · {filtered.length} items
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <span className="text-cyan text-xs">{">"}</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SEARCH INTEL..."
                    className="flex-1 bg-transparent border-b border-panel-border focus:border-cyan outline-none text-xs font-mono tracking-wider text-foreground placeholder:text-muted-foreground/60 py-1 px-1 transition-colors"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="text-[10px] text-muted-foreground hover:text-danger tracking-widest"
                    >
                      CLR
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[calc(100vh-360px)] min-h-[500px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground tracking-widest text-xs">
                    ◇ NO INTEL MATCHES CURRENT FILTERS ◇
                  </div>
                ) : (
                  filtered.map((item, i) => <NewsRow key={item.id} item={item} index={i} />)
                )}
              </div>
              <div className="panel-header border-t border-b-0 px-4 py-2 flex items-center justify-between text-[10px] tracking-widest text-muted-foreground">
                <span>
                  LAST SYNC{" "}
                  <span className="text-cyan">
                    {new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour12: false })}
                  </span>
                </span>
                <span>EOF · END OF TRANSMISSION</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="text-center text-[10px] tracking-widest text-muted-foreground py-2">
          ━━━━━ NEWS COMMAND CENTER · CLASSIFIED FEED · AUTHORIZED ACCESS ONLY ━━━━━
        </footer>
      </div>

      <ManageFeedsModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        sources={configuredSources}
        removed={removed}
        onAdd={addCustom}
        onRemove={remove}
        onRestore={restoreDefault}
        onResetAll={resetAll}
      />
    </div>
  );
}
