"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc, CongeStatut } from "@/lib/data-model";
import { updateCongeStatut } from "@/lib/firestore-helpers";

type Row = CongeDoc & { id: string };

export default function AdminCongesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const q = query(
      collection(db, "conges"),
      where("statut", "==", "en_attente"),
      limit(200),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) })));
        setLoading(false);
      },
      (err) => {
        const msg =
          (err as { code?: string })?.code === "permission-denied"
            ? "Accès refusé (vérifie users/{uid}.role = admin + rules)"
            : (err as { code?: string })?.code === "failed-precondition"
              ? "Index Firestore manquant (ou requête non supportée)."
              : "Impossible de charger les congés";
        toast.error(msg);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const sorted = useMemo(() => rows, [rows]);

  async function setStatut(id: string, statut: CongeStatut) {
    setUpdatingId(id);
    try {
      await updateCongeStatut(id, statut);
      toast.success(statut === "valide" ? "Congé validé" : "Congé refusé");
    } catch {
      toast.error("Impossible de mettre à jour le statut");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestion des congés</h1>
        <p className="text-muted-foreground">Valider ou refuser les demandes en attente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>En attente</CardTitle>
          <CardDescription>{loading ? "Chargement..." : `${sorted.length} demande(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">UserId</th>
                  <th className="py-2 pr-4">Début</th>
                  <th className="py-2 pr-4">Fin</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{r.userId}</td>
                    <td className="py-2 pr-4">{r.dateDebut}</td>
                    <td className="py-2 pr-4">{r.dateFin}</td>
                    <td className="py-2 pr-4">{r.type}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={updatingId === r.id}
                          onClick={() => setStatut(r.id, "valide")}
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === r.id}
                          onClick={() => setStatut(r.id, "refuse")}
                        >
                          Refuser
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={5}>
                      Aucun congé en attente.
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

