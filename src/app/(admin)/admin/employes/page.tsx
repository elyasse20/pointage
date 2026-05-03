"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { UserDoc } from "@/lib/data-model";

type Row = UserDoc & { id: string };

export default function AdminEmployesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtext, setQtext] = useState("");

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
        setLoading(false);
      },
      () => {
        toast.error("Impossible de charger les employés");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = qtext.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.nom} ${r.email} ${r.role}`.toLowerCase().includes(q));
  }, [rows, qtext]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employés</h1>
        <p className="text-muted-foreground">Liste des comptes (Firestore `users`).</p>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Comptes</CardTitle>
            <CardDescription>{loading ? "Chargement..." : `${filtered.length} employé(s)`}</CardDescription>
          </div>
          <div className="w-full md:w-80">
            <Input value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder="Rechercher (nom, email…)" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.nom}</td>
                    <td className="py-2 pr-4">{r.email}</td>
                    <td className="py-2 pr-4">{r.role}</td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={3}>
                      Aucun résultat.
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

