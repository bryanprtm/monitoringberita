import { useState } from "react";
import { z } from "zod";
import { DEFAULT_FEED_SOURCES, type FeedSource } from "@/lib/feeds";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(64, "Max 64 chars"),
  url: z
    .string()
    .trim()
    .url("Invalid URL")
    .max(500, "Max 500 chars")
    .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://"),
  category: z.string().trim().min(1).max(16, "Max 16 chars"),
});

type Props = {
  open: boolean;
  onClose: () => void;
  sources: FeedSource[];
  removed: string[];
  onAdd: (src: { name: string; url: string; category: string }) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onResetAll: () => void;
};

export function ManageFeedsModal({
  open,
  onClose,
  sources,
  removed,
  onAdd,
  onRemove,
  onRestore,
  onResetAll,
}: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("CUSTOM");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = formSchema.safeParse({ name, url, category });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (sources.some((s) => s.url.toLowerCase() === parsed.data.url.toLowerCase())) {
      setError("Feed URL already exists");
      return;
    }
    onAdd(parsed.data);
    setName("");
    setUrl("");
    setCategory("CUSTOM");
  };

  const removedDefaults = DEFAULT_FEED_SOURCES.filter((s) => removed.includes(s.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="corner-tl" />
        <span className="corner-tr" />
        <span className="corner-bl" />
        <span className="corner-br" />

        <div className="panel-header px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm tracking-[0.25em] text-cyan glow-cyan font-bold">
            ▍ MANAGE RSS SOURCES
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-danger text-xs tracking-widest border border-panel-border hover:border-danger px-2 py-1 transition-colors"
          >
            [ ESC ] CLOSE
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* ADD FORM */}
          <section>
            <h3 className="text-[11px] tracking-widest text-amber glow-amber font-bold mb-3">
              ▸ ADD NEW SOURCE
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] tracking-widest text-muted-foreground">NAME</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 64))}
                    placeholder="e.g. BBC NEWS"
                    maxLength={64}
                    className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] tracking-widest text-muted-foreground">CATEGORY</span>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value.slice(0, 16).toUpperCase())}
                    placeholder="INTL / NAT / TECH"
                    maxLength={16}
                    className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] tracking-widest text-muted-foreground">RSS / ATOM URL</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value.slice(0, 500))}
                  placeholder="https://example.com/feed.xml"
                  maxLength={500}
                  className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
                />
              </label>
              {error && (
                <div className="text-[11px] text-danger glow-danger tracking-wider border border-danger/40 bg-danger/5 px-2 py-1.5">
                  ✕ {error}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="text-[11px] tracking-widest font-bold px-4 py-1.5 border border-cyan text-cyan glow-cyan hover:bg-cyan hover:text-background transition-colors"
                >
                  + DEPLOY SOURCE
                </button>
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  Saved locally · synced on next refresh
                </span>
              </div>
            </form>
          </section>

          {/* ACTIVE SOURCES */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] tracking-widest text-amber glow-amber font-bold">
                ▸ ACTIVE SOURCES [{sources.length}]
              </h3>
              <button
                onClick={() => {
                  if (confirm("Reset all sources to defaults? Custom feeds will be lost.")) onResetAll();
                }}
                className="text-[10px] tracking-widest text-muted-foreground hover:text-danger border border-panel-border hover:border-danger px-2 py-1 transition-colors"
              >
                RESET ALL
              </button>
            </div>
            <ul className="space-y-1.5">
              {sources.map((s) => {
                const isDefault = DEFAULT_FEED_SOURCES.some((d) => d.id === s.id);
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 text-xs font-mono border border-panel-border/60 px-2 py-1.5 hover:border-cyan/60 transition-colors"
                  >
                    <span className="text-[10px] text-cyan w-14 shrink-0">[{s.category}]</span>
                    <span className="font-bold text-foreground w-36 shrink-0 truncate">{s.name}</span>
                    <span className="text-muted-foreground truncate flex-1" title={s.url}>
                      {s.url}
                    </span>
                    <span className="text-[9px] text-muted-foreground tracking-widest shrink-0">
                      {isDefault ? "DEFAULT" : "CUSTOM"}
                    </span>
                    <button
                      onClick={() => onRemove(s.id)}
                      className="text-[10px] text-danger hover:bg-danger hover:text-background border border-danger/60 px-2 py-0.5 tracking-widest shrink-0 transition-colors"
                    >
                      REMOVE
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* REMOVED DEFAULTS */}
          {removedDefaults.length > 0 && (
            <section>
              <h3 className="text-[11px] tracking-widest text-muted-foreground font-bold mb-3">
                ▸ DISABLED DEFAULTS [{removedDefaults.length}]
              </h3>
              <ul className="space-y-1.5">
                {removedDefaults.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 text-xs font-mono border border-panel-border/40 px-2 py-1.5 opacity-60"
                  >
                    <span className="text-[10px] w-14 shrink-0">[{s.category}]</span>
                    <span className="font-bold w-36 shrink-0 truncate">{s.name}</span>
                    <span className="truncate flex-1">{s.url}</span>
                    <button
                      onClick={() => onRestore(s.id)}
                      className="text-[10px] text-success hover:bg-success hover:text-background border border-success/60 px-2 py-0.5 tracking-widest shrink-0 transition-colors"
                    >
                      RESTORE
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
