import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "LOGIN — News Command Center" },
      { name: "description", content: "Sign in to access the News Command Center dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, session, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/" });
  }, [session, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(username, password);
      } else {
        await signUp(username, password, displayName);
      }
      nav({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      // Translate common Supabase errors
      if (msg.includes("Invalid login")) setError("Username atau password salah");
      else if (msg.includes("already registered") || msg.includes("User already"))
        setError("Username sudah terdaftar");
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen scanline flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="panel relative p-8">
          <span className="corner-tl" />
          <span className="corner-tr" />
          <span className="corner-bl" />
          <span className="corner-br" />

          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 flex items-center justify-center bg-background/40 border border-amber/40 p-1 mb-3">
              <img
                src={logoUrl}
                alt="Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_6px_oklch(0.78_0.17_75/0.6)]"
              />
            </div>
            <h1 className="text-lg font-bold tracking-[0.25em] text-cyan glow-cyan text-center">
              NEWS COMMAND CENTER
            </h1>
            <p className="text-[10px] tracking-widest text-muted-foreground mt-1">
              SECURE ACCESS · AUTHORIZED PERSONNEL ONLY
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`text-[11px] tracking-widest py-1.5 border transition-colors ${
                  mode === m
                    ? "border-cyan text-cyan glow-cyan"
                    : "border-panel-border text-muted-foreground hover:text-cyan hover:border-cyan"
                }`}
              >
                {m === "login" ? "▸ LOGIN" : "▸ REGISTER"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-[10px] tracking-widest text-muted-foreground">USERNAME</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 32))}
                autoComplete="username"
                required
                placeholder="operator01"
                className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-3 py-2 text-sm font-mono tracking-wider transition-colors"
              />
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="text-[10px] tracking-widest text-muted-foreground">DISPLAY NAME (opsional)</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
                  placeholder="Operator 01"
                  className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-3 py-2 text-sm font-mono tracking-wider transition-colors"
                />
              </label>
            )}

            <label className="block">
              <span className="text-[10px] tracking-widest text-muted-foreground">PASSWORD</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                placeholder="••••••"
                className="mt-1 w-full bg-input/60 border border-panel-border focus:border-cyan outline-none px-3 py-2 text-sm font-mono tracking-wider transition-colors"
              />
            </label>

            {error && (
              <div className="text-[11px] text-danger glow-danger tracking-wider border border-danger/40 bg-danger/5 px-3 py-2">
                ✕ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full text-xs tracking-[0.25em] font-bold px-4 py-2.5 border border-cyan text-cyan glow-cyan hover:bg-cyan hover:text-background transition-colors disabled:opacity-50"
            >
              {busy ? "◌ AUTHENTICATING..." : mode === "login" ? "▶ ACCESS GRANTED" : "▶ REGISTER OPERATOR"}
            </button>
          </form>

          <div className="mt-6 text-center text-[10px] text-muted-foreground tracking-widest">
            <Link to="/" className="hover:text-cyan transition-colors">← BACK TO DASHBOARD</Link>
          </div>
        </div>
        <p className="text-center text-[9px] tracking-widest text-muted-foreground mt-4">
          ━━━ CLASSIFIED · ALL ACCESS LOGGED ━━━
        </p>
      </div>
    </div>
  );
}