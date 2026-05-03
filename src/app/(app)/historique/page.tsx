"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { listPointagesForUser } from "@/lib/firestore-helpers";
import type { PointageDoc } from "@/lib/data-model";

type Row = PointageDoc & { id: string };

export default function HistoriquePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => setLoading(true));
    listPointagesForUser(user.uid, 200)
      .then(setRows)
      .catch((err) => {
        const code = (err as { code?: string })?.code;
        toast.error(code === "permission-denied" ? "Accès refusé (règles Firestore)." : "Impossible de charger l'historique");
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.date} ${r.heure} ${r.type}`.toLowerCase().includes(q));
  }, [rows, queryText]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historique</h1>
        <p className="text-muted-foreground">Vos pointages récents.</p>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Pointages</CardTitle>
            <CardDescription>{loading ? "Chargement..." : `${filtered.length} élément(s)`}</CardDescription>
          </div>
          <div className="w-full md:w-80">
            <Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Filtrer (date, type…)" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Heure</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Latitude</th>
                  <th className="py-2 pr-4">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.date}</td>
                    <td className="py-2 pr-4">{r.heure}</td>
                    <td className="py-2 pr-4">{r.type === "entree" ? "Entrée" : "Sortie"}</td>
                    <td className="py-2 pr-4">{typeof r.latitude === "number" ? r.latitude.toFixed(5) : "-"}</td>
                    <td className="py-2 pr-4">{typeof r.longitude === "number" ? r.longitude.toFixed(5) : "-"}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={5}>
                      Aucun pointage pour le moment.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

