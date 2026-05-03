"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";

type Kpi = { label: string; value: string };

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<{ users: number; pointages: number; congesPending: number }>({
    users: 0,
    pointages: 0,
    congesPending: 0,
  });

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    void (async () => {
      try {
        const users = await getCountFromServer(collection(db, "users"));
        const pointages = await getCountFromServer(collection(db, "pointages"));
        const congesPending = await getCountFromServer(query(collection(db, "conges"), where("statut", "==", "en_attente")));
        setCounts({
          users: users.data().count,
          pointages: pointages.data().count,
          congesPending: congesPending.data().count,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = useMemo<Kpi[]>(
    () => [
      { label: "Employés", value: loading ? "…" : String(counts.users) },
      { label: "Pointages", value: loading ? "…" : String(counts.pointages) },
      { label: "Congés en attente", value: loading ? "…" : String(counts.congesPending) },
    ],
    [counts, loading],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Indicateurs globaux (MVP).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytique</CardTitle>
          <CardDescription>Les graphiques (Recharts) arrivent dans l’étape suivante.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          MVP: on affiche déjà des compteurs; on ajoutera heures/retards/absences avec agrégation Firestore.
        </CardContent>
      </Card>
    </div>
  );
}

