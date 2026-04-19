import type { NewsItem } from "@/lib/feeds";

export function Ticker({ items }: { items: NewsItem[] }) {
  const slice = items.slice(0, 30);
  if (slice.length === 0) return null;
  const doubled = [...slice, ...slice];

  return (
    <div className="panel relative overflow-hidden h-9 flex items-center">
      <div className="shrink-0 px-3 h-full flex items-center bg-cyan/10 border-r border-panel-border">
        <span className="text-[10px] font-bold tracking-widest text-cyan glow-cyan blink">● LIVE FEED</span>
      </div>
      <div className="overflow-hidden flex-1">
        <div className="ticker-track flex whitespace-nowrap">
          {doubled.map((item, i) => (
            <a
              key={`${item.id}-${i}`}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="px-6 text-xs font-mono text-foreground/90 hover:text-cyan transition-colors flex items-center gap-3"
            >
              <span className="text-amber text-[10px] tracking-widest">[{item.sourceName}]</span>
              <span>{item.title}</span>
              <span className="text-muted-foreground">◆</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
