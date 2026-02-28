"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    }).catch((err) => {
      console.error("getUser failed:", err);
      setUser(null);
      setLoading(false);
    });

    // Listen for auth changes.
    // Wrapped in try-catch: iOS Safari PWA can throw "WebSocket: The operation
    // is insecure" synchronously inside onAuthStateChange.
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
      subscription = data.subscription;
    } catch (err) {
      console.warn("[AuthContext] onAuthStateChange WebSocket unavailable:", err);
      setLoading(false);
    }

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
