import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { LiveClock } from "@/components/LiveClock";
import { useAuth } from "@/hooks/useAuth";
import { useYoutubeSources, type YoutubeSource } from "@/hooks/useYoutubeSources";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "LIVE MONITORING — YouTube News Streams" },
      {
        name: "description",
        content:
          "Live monitoring dashboard for YouTube news streams. Add, edit, and remove streams in a 6-column grid.",
      },
      { property: "og:title", content: "LIVE MONITORING — YouTube News Streams" },
      { property: "og:description", content: "6-column live YouTube news monitoring dashboard." },
    ],
  }),
  component: LivePage,
});

const formSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(64),
  url: z
    .string()
    .trim()
    .url("Invalid URL")
    .max(500)
    .refine((u) => /youtube\.com|youtu\.be/i.test(u), "Must be a YouTube URL"),
  category: z.string().trim().min(1).max(16),
});

function toEmbed(url: string): string | null {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.youtube.com";
  const make = (id: string, muted = true) =>
    `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? make(id, true) : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        return v ? make(v, true) : null;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/")[2];
        return id ? make(id, true) : null;
      }
      if (u.pathname.startsWith("/live/")) {
        const id = u.pathname.split("/")[2];
        return id ? make(id, true) : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? make(id, true) : null;
      }
      // /@handle/live requires channel id we don't have; fall through
    }
  } catch {
    return null;
  }
  return null;
}

function toEmbedUnmuted(url: string): string | null {
  const base = toEmbed(url);
  return base ? base.replace("mute=1", "mute=0") : null;
}

function LivePage() {
  const { session, profile, loading: authLoading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!authLoading && !session) nav({ to: "/login" });
  }, [authLoading, session, nav]);

  const { sources, hydrated, add, update, remove } = useYoutubeSources();
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<YoutubeSource | null>(null);

  const cells = useMemo(() => sources, [sources]);

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
              <div className="w-12 h-12 flex items-center justify-center bg-background/40 border border-amber/40 p-1">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain drop-shadow-[0_0_6px_oklch(0.78_0.17_75/0.6)]"
                />
              </div>
              <div className="w-10 h-10 border-2 border-danger flex items-center justify-center">
                <span className="text-danger glow-danger text-lg font-bold blink">●</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-[0.25em] text-danger glow-danger">
                  LIVE MONITORING
                </h1>
                <p className="text-[10px] tracking-widest text-muted-foreground mt-0.5">
                  YOUTUBE STREAM GRID · 6-COLUMN MATRIX · v1.0.0
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2">
              <Link
                to="/"
                className="text-[10px] tracking-widest px-2 py-1 border border-panel-border text-muted-foreground hover:text-cyan hover:border-cyan transition-colors"
              >
                ◂ RSS FEED
              </Link>
              <Link
                to="/live"
                className="text-[10px] tracking-widest px-2 py-1 border border-danger text-danger glow-danger"
              >
                LIVE TV
              </Link>
            </nav>
            <LiveClock />
            {session && (
              <div className="flex items-center gap-2 border-l border-panel-border pl-4">
                <div className="text-xs">
                  <div className="text-muted-foreground tracking-widest text-[10px]">OPERATOR</div>
                  <div className="text-cyan font-bold tracking-widest">
                    {profile?.display_name || profile?.username || "—"}
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-[10px] tracking-widest px-2 py-1 border border-danger/60 text-danger hover:bg-danger hover:text-background transition-colors"
                >
                  LOGOUT
                </button>
              </div>
            )}
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="panel relative px-4 py-2 flex items-center justify-between">
          <span className="corner-tl" />
          <span className="corner-br" />
          <h2 className="text-[11px] tracking-widest text-cyan glow-cyan font-bold">
            ▍ ACTIVE STREAMS [{cells.length}]
            {!hydrated && <span className="ml-2 text-amber blink">◌ LOADING</span>}
          </h2>
          <button
            onClick={() => {
              setEditing(null);
              setManageOpen(true);
            }}
            className="text-[10px] tracking-widest px-3 py-1 border border-amber text-amber glow-amber hover:bg-amber hover:text-background transition-colors"
          >
            + ADD STREAM
          </button>
        </div>

        {/* 6-COLUMN GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cells.length === 0 && hydrated && (
            <div className="col-span-full panel relative p-12 text-center text-muted-foreground tracking-widest text-xs">
              ◇ NO STREAMS · ADD A YOUTUBE URL TO BEGIN ◇
            </div>
          )}
          {cells.map((s) => {
            const embed = toEmbed(s.url);
            return (
              <div key={s.id} className="panel relative overflow-hidden group">
                <span className="corner-tl" />
                <span className="corner-tr" />
                <span className="corner-bl" />
                <span className="corner-br" />
                <div className="panel-header px-2 py-1 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[9px] text-danger glow-danger blink shrink-0">●</span>
                    <span className="text-[9px] tracking-widest text-cyan shrink-0">
                      [{s.category}]
                    </span>
                    <span
                      className="text-[10px] font-bold tracking-wider text-foreground truncate"
                      title={s.name}
                    >
                      {s.name}
                    </span>
                  </div>
                </div>
                <div className="relative bg-black aspect-video">
                  {embed ? (
                    <iframe
                      src={embed}
                      title={s.name}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-danger tracking-widest p-2 text-center">
                      ✕ INVALID URL
                    </div>
                  )}
                </div>
                <div className="px-2 py-1 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] tracking-widest text-muted-foreground hover:text-cyan"
                  >
                    OPEN ↗
                  </a>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing(s);
                        setManageOpen(true);
                      }}
                      className="text-[9px] tracking-widest px-1.5 py-0.5 border border-amber/60 text-amber hover:bg-amber hover:text-background transition-colors"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Remove "${s.name}"?`)) {
                          try {
                            await remove(s.id);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Failed");
                          }
                        }
                      }}
                      className="text-[9px] tracking-widest px-1.5 py-0.5 border border-danger/60 text-danger hover:bg-danger hover:text-background transition-colors"
                    >
                      DEL
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="text-center text-[10px] tracking-widest text-muted-foreground py-2">
          ━━━━━ LIVE MONITORING · YOUTUBE STREAM MATRIX · AUTHORIZED ACCESS ONLY ━━━━━
        </footer>
      </div>

      {manageOpen && (
        <StreamModal
          initial={editing}
          onClose={() => {
            setManageOpen(false);
            setEditing(null);
          }}
          onSubmit={async (vals) => {
            if (editing) await update(editing.id, vals);
            else await add(vals);
          }}
        />
      )}
    </div>
  );
}

function StreamModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: YoutubeSource | null;
  onClose: () => void;
  onSubmit: (vals: { name: string; url: string; category: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [category, setCategory] = useState(initial?.category ?? "LIVE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = formSchema.safeParse({ name, url, category });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel relative w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="corner-tl" />
        <span className="corner-tr" />
        <span className="corner-bl" />
        <span className="corner-br" />
        <div className="panel-header px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm tracking-[0.25em] text-cyan glow-cyan font-bold">
            ▍ {initial ? "EDIT STREAM" : "ADD STREAM"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-danger text-xs tracking-widest border border-panel-border hover:border-danger px-2 py-1 transition-colors"
          >
            [ ESC ] CLOSE
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] tracking-widest text-muted-foreground">NAME</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 64))}
                placeholder="e.g. CNN INDONESIA"
                maxLength={64}
                className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-widest text-muted-foreground">CATEGORY</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value.slice(0, 16).toUpperCase())}
                placeholder="LIVE / NEWS / SPORT"
                maxLength={16}
                className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[10px] tracking-widest text-muted-foreground">YOUTUBE URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value.slice(0, 500))}
              placeholder="https://www.youtube.com/watch?v=..."
              maxLength={500}
              className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-2 py-1.5 text-xs font-mono tracking-wider transition-colors"
            />
            <span className="text-[9px] text-muted-foreground tracking-wider mt-1 block">
              Supports watch, youtu.be, /live/ and /embed/ URLs.
            </span>
          </label>
          {error && (
            <div className="text-[11px] text-danger glow-danger tracking-wider border border-danger/40 bg-danger/5 px-2 py-1.5">
              ✕ {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] tracking-widest font-bold px-4 py-1.5 border border-panel-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={busy}
              className="text-[11px] tracking-widest font-bold px-4 py-1.5 border border-cyan text-cyan glow-cyan hover:bg-cyan hover:text-background transition-colors disabled:opacity-50"
            >
              {busy ? "◌ SAVING..." : initial ? "✓ UPDATE" : "+ DEPLOY"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
