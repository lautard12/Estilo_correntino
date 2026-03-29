import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole, type AppRole } from "@/lib/auth-store";

interface AuthCtx {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  isEncargado: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, role: null, loading: true, isEncargado: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async (userId: string) => {
      try {
        const r = await fetchUserRole(userId);
        if (isMounted) setRole(r);
      } catch {
        if (isMounted) setRole(null);
      }
    };

    // Listener for ONGOING auth changes — never await inside callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setTimeout(() => loadRole(u.id), 0);
      } else {
        setRole(null);
      }
    });

    // INITIAL load — controls loading state
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await loadRole(u.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{ user, role, loading, isEncargado: role === "encargado" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
