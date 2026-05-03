"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandingView } from "@/components/marketing/landing-view";
import { useAuth } from "@/components/providers/auth-provider";

export function HomeGate() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (role === "admin") router.replace("/admin/dashboard");
    else router.replace("/pointage");
  }, [loading, user, role, router]);

  if (loading) return null;
  if (user) return null;

  return <LandingView />;
}

