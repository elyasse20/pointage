"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import type { UserRole } from "@/lib/data-model";

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  const { user, role: currentRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;
    if (!role) return;
    if (user && currentRole !== role) router.replace("/");
  }, [loading, role, user, currentRole, router]);

  if (loading) return null;
  if (!user) return null;
  if (role && currentRole !== role) return null;

  return children;
}

