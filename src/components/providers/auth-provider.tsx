"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { getUserRole } from "@/lib/firestore-helpers";
import type { UserRole } from "@/lib/data-model";

type AuthState = {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getFirebaseAuth()?.currentUser ?? null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getFirebaseAuth()));

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const r = await getUserRole(u.uid);
        setRole(r);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, role, loading }), [user, role, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

