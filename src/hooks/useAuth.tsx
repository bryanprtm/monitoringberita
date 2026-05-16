import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// Map username -> synthetic email for Supabase Auth
const USERNAME_DOMAIN = "ncc.local";
export const usernameToEmail = (u: string) =>
  `${u.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@${USERNAME_DOMAIN}`;

type Profile = { id: string; username: string; display_name: string | null };

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // defer the profile fetch to avoid deadlock inside the listener
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (id: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", id)
      .maybeSingle();
    setProfile(data ?? null);
  };

  const signIn: AuthCtx["signIn"] = async (username, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) throw error;
  };

  const signUp: AuthCtx["signUp"] = async (username, password, displayName) => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) throw new Error("Username minimal 3 karakter (a-z, 0-9, _)");
    if (password.length < 6) throw new Error("Password minimal 6 karakter");
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(clean),
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { username: clean, display_name: displayName?.trim() || clean },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}