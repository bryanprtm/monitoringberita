import type { NewsItem } from "@/lib/feeds";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NewsRow({ item, index }: { item: NewsItem; index: number }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noreferrer"
      className="group block border-b border-panel-border/40 px-3 py-2.5 hover:bg-cyan/5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 text-[10px] font-mono text-muted-foreground pt-0.5">
          {String(index + 1).padStart(3, "0")}
        </div>
        <div className="flex-shrink-0 w-28">
          <div className="text-[10px] font-bold tracking-widest text-amber glow-amber">
            {item.sourceName}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">
            T-{timeAgo(item.pubTimestamp)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground group-hover:text-cyan group-hover:glow-cyan transition-colors leading-snug">
            {item.title}
          </div>
          {item.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-cyan opacity-0 group-hover:opacity-100 transition-opacity self-center">
          ▶
        </div>
      </div>
    </a>
  );
}
