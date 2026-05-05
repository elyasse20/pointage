"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { Check, X, Calendar, User, SearchX } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

type CongeRecord = {
  id: string;
  userId: string;
  employeNom?: string;
  dateDebut: string;
  dateFin: string;
  type: string;
  statut: "en_attente" | "valide" | "refuse";
  motif?: string;
  createdAt: string;
};

export default function AdminCongesPage() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState<CongeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal de refus
  const [refusModalOpen, setRefusModalOpen] = useState(false);
  const [selectedCongeId, setSelectedCongeId] = useState<string | null>(null);
  const [motifRefus, setMotifRefus] = useState("");

  const fetchPendingConges = async () => {
    try {
      setLoading(true);
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/admin/conges", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      
      if (data.success) {
        setRows(data.data);
      } else {
        toast.error(data.error || "Erreur de chargement");
      }
    } catch (err) {
      toast.error("Impossible de charger les congés.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === "admin") {
      fetchPendingConges();
    }
  }, [user, role]);

  const setStatut = async (id: string, statut: "valide" | "refuse", motif?: string) => {
    setUpdatingId(id);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();

      const res = await fetch("/api/admin/conges", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ id, statut, motifRefus: motif }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Le congé a été ${statut === "valide" ? "approuvé" : "refusé"}.`);
        setRows((prev) => prev.filter((r) => r.id !== id));
        if (statut === "refuse") {
          setRefusModalOpen(false);
          setMotifRefus("");
          setSelectedCongeId(null);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le statut.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenRefusModal = (id: string) => {
    setSelectedCongeId(id);
    setRefusModalOpen(true);
  };

  const submitRefus = () => {
    if (!selectedCongeId) return;
    if (!motifRefus.trim()) {
      toast.error("Veuillez indiquer un motif de refus.");
      return;
    }
    setStatut(selectedCongeId, "refuse", motifRefus);
  };

  if (!user || role !== "admin") return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validation des Congés</h1>
        <p className="text-muted-foreground mt-2">Gérez les demandes d'absence en attente de l'équipe.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demandes en attente</CardTitle>
          <CardDescription>
            {loading ? "Chargement..." : `${rows.length} demande(s) nécessitant votre attention.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-12 flex justify-center text-muted-foreground animate-pulse">Chargement des données...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-xl bg-muted/10">
              <SearchX className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">Aucune demande en attente</p>
              <p className="text-muted-foreground mt-1 text-sm">Tout est à jour ! L'équipe est au complet.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <Card key={r.id} className="overflow-hidden border border-muted-foreground/20 hover:border-primary/30 transition-colors shadow-sm">
                  <div className="bg-muted/30 px-4 py-3 border-b flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{r.employeNom || r.userId.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.type}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        <span className="font-medium text-foreground">Du</span> {r.dateDebut} <span className="font-medium text-foreground">au</span> {r.dateFin}
                      </span>
                    </div>

                    {r.motif && (
                      <div className="bg-muted/50 p-3 rounded-md text-sm border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Motif invoqué :</p>
                        <p className="italic text-foreground/80">"{r.motif}"</p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={updatingId === r.id}
                        onClick={() => setStatut(r.id, "valide")}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approuver
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        disabled={updatingId === r.id}
                        onClick={() => handleOpenRefusModal(r.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Refuser
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de motif de refus */}
      <Dialog open={refusModalOpen} onOpenChange={setRefusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motif du refus</DialogTitle>
            <DialogDescription>
              Veuillez expliquer à l'employé pourquoi sa demande de congé est refusée. Ce motif lui sera visible.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="Ex: Effectif insuffisant sur cette période..." 
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={submitRefus} disabled={updatingId === selectedCongeId}>
              {updatingId === selectedCongeId ? "Refus en cours..." : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
