import type { FeedResult } from "@/lib/feeds";

function statusStyle(status: FeedResult["status"]) {
  if (status === "ONLINE") return { color: "text-success", glow: "", dot: "bg-success" };
  if (status === "DEGRADED") return { color: "text-warning glow-amber", glow: "", dot: "bg-warning" };
  return { color: "text-danger glow-danger", glow: "", dot: "bg-danger" };
}

export function SourcePanel({
  feed,
  active,
  onSelect,
}: {
  feed: FeedResult;
  active: boolean;
  onSelect: () => void;
}) {
  const s = statusStyle(feed.status);
  return (
    <button
      onClick={onSelect}
      className={`panel relative text-left p-3 transition-all hover:border-cyan group ${
        active ? "border-cyan shadow-[0_0_20px_oklch(0.82_0.18_195/0.25)]" : ""
      }`}
    >
      {active && (
        <>
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />
        </>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${s.dot} ${feed.status === "ONLINE" ? "blink" : ""}`} />
          <span className="text-[10px] font-bold tracking-widest text-foreground/90">{feed.sourceName}</span>
        </div>
        <span className="text-[9px] text-muted-foreground tracking-widest">{feed.category}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
        <div>
          <div className="text-muted-foreground">STATUS</div>
          <div className={`${s.color} font-bold`}>{feed.status}</div>
        </div>
        <div>
          <div className="text-muted-foreground">ITEMS</div>
          <div className="text-cyan font-bold">{String(feed.itemCount).padStart(3, "0")}</div>
        </div>
        <div>
          <div className="text-muted-foreground">PING</div>
          <div className="text-foreground">{feed.responseMs}ms</div>
        </div>
        <div>
          <div className="text-muted-foreground">SYNC</div>
          <div className="text-foreground">
            {new Date(feed.fetchedAt).toLocaleTimeString("en-GB", { hour12: false })}
          </div>
        </div>
      </div>
      {feed.error && (
        <div className="mt-2 text-[9px] text-danger truncate" title={feed.error}>
          ERR: {feed.error}
        </div>
      )}
    </button>
  );
}
