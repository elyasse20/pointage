"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { Clock, CheckCircle2, XCircle, CalendarIcon } from "lucide-react";

const schema = z.object({
  dateDebut: z.string().min(10, "Date début requise"),
  dateFin: z.string().min(10, "Date fin requise"),
  type: z.enum(["annuel", "maladie", "exceptionnel", "maternite", "paternite", "sans_solde", "recuperation"]),
  motif: z.string().optional(),
});

type CongeRecord = {
  id: string;
  dateDebut: string;
  dateFin: string;
  type: string;
  statut: "en_attente" | "valide" | "refuse";
  motif?: string;
  motifRefus?: string;
};

export default function CongesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CongeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { dateDebut: "", dateFin: "", type: "annuel", motif: "" },
  });

  const fetchConges = async () => {
    try {
      setLoading(true);
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/conges", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      
      if (data.success) {
        setRows(data.data);
      } else {
        toast.error(data.error || "Erreur de chargement");
      }
    } catch (err) {
      toast.error("Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConges();
    }
  }, [user]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!user) return;

    if (new Date(values.dateFin) < new Date(values.dateDebut)) {
      form.setError("dateFin", { message: "La date de fin doit être après la date de début." });
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();

      const res = await fetch("/api/conges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success("Demande de congé envoyée avec succès.");
        form.reset({ dateDebut: "", dateFin: "", type: "annuel", motif: "" });
        fetchConges(); // Rafraîchir la liste
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "en_attente":
        return <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md text-xs font-medium border border-yellow-200"><Clock className="w-3 h-3"/> En attente</span>;
      case "valide":
        return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md text-xs font-medium border border-green-200"><CheckCircle2 className="w-3 h-3"/> Approuvé</span>;
      case "refuse":
        return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-medium border border-red-200"><XCircle className="w-3 h-3"/> Refusé</span>;
      default:
        return <span>{statut}</span>;
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mes Congés</h1>
        <p className="text-muted-foreground mt-2">Gérez vos demandes d'absence et consultez votre historique.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        
        {/* Formulaire */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nouvelle Demande</CardTitle>
            <CardDescription>Soumettez une demande de congé à votre manager.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateDebut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date début</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date fin</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de congé</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="annuel">Congé Annuel</option>
                          <option value="maladie">Congé Maladie</option>
                          <option value="exceptionnel">Congé Exceptionnel</option>
                          <option value="maternite">Congé de Maternité</option>
                          <option value="paternite">Congé de Paternité</option>
                          <option value="sans_solde">Congé Sans Solde</option>
                          <option value="recuperation">Congé de Récupération</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motif"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif / Justification (Optionnel)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Ex: Rendez-vous médical..." 
                          className="resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={submitting} className="w-full mt-2">
                  {submitting ? "Envoi en cours..." : "Soumettre la demande"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Historique */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des demandes</CardTitle>
            <CardDescription>
              {loading ? "Chargement de vos congés..." : `Vous avez ${rows.length} demande(s) enregistrée(s).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <span className="text-muted-foreground animate-pulse">Chargement...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-dashed">
                <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">Aucune demande de congé</p>
                <p className="text-sm text-muted-foreground/80 mt-1">Vos futures demandes apparaîtront ici.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rows.map((r) => (
                  <div key={r.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold capitalize">{r.type}</span>
                        <p className="text-sm text-muted-foreground">
                          Du {r.dateDebut} au {r.dateFin}
                        </p>
                      </div>
                      {getStatusBadge(r.statut)}
                    </div>
                    {r.motif && (
                      <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                        <span className="font-medium text-foreground/70">Motif :</span> {r.motif}
                      </p>
                    )}
                    {r.statut === "refuse" && r.motifRefus && (
                      <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-100">
                        <span className="font-semibold">Motif du refus :</span> {r.motifRefus}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
