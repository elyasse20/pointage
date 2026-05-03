import { RequireAuth } from "@/components/app/require-auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}

