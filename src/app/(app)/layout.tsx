import { AppShell } from "@/components/app/app-shell";
import { RequireAuth } from "@/components/app/require-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="employe">
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

