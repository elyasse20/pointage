"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { requestConge } from "@/lib/firestore-helpers";
import type { CongeDoc, CongeType } from "@/lib/data-model";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";

type Row = CongeDoc & { id: string };

const schema = z.object({
  dateDebut: z.string().min(10, "Date début requise"),
  dateFin: z.string().min(10, "Date fin requise"),
  type: z.enum(["annuel", "maladie", "exceptionnel"]),
});

export default function CongesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { dateDebut: "", dateFin: "", type: "annuel" },
  });

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseFirestore();
    if (!db) return;

    const q = query(
      collection(db, "conges"),
      where("userId", "==", user.uid),
      limit(100),
    );

    let first = true;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) })));
        if (first) {
          first = false;
          setLoading(false);
        }
      },
      (err) => {
        const msg =
          (err as { code?: string })?.code === "permission-denied"
            ? "Accès refusé (règles Firestore)."
            : "Impossible de charger les congés";
        toast.error(msg);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  const sorted = useMemo(() => rows, [rows]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!user) return;
    setSubmitting(true);
    try {
      await requestConge({
        userId: user.uid,
        dateDebut: values.dateDebut,
        dateFin: values.dateFin,
        type: values.type as CongeType,
      });
      toast.success("Demande envoyée");
      form.reset({ dateDebut: "", dateFin: "", type: "annuel" });
    } catch {
      toast.error("Erreur lors de la demande");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Congés</h1>
        <p className="text-muted-foreground">Créer une demande et suivre son statut.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demande de congé</CardTitle>
            <CardDescription>Choisis les dates et le type.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          {...field}
                        >
                          <option value="annuel">Annuel</option>
                          <option value="maladie">Maladie</option>
                          <option value="exceptionnel">Exceptionnel</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Envoi..." : "Envoyer la demande"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mes demandes</CardTitle>
            <CardDescription>{loading ? "Chargement..." : `${sorted.length} demande(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Début</th>
                    <th className="py-2 pr-4">Fin</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.dateDebut}</td>
                      <td className="py-2 pr-4">{r.dateFin}</td>
                      <td className="py-2 pr-4">{r.type}</td>
                      <td className="py-2 pr-4">{r.statut}</td>
                    </tr>
                  ))}
                  {!loading && sorted.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={4}>
                        Aucune demande.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

