"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PointageDoc } from "@/lib/data-model";
import { listPointages } from "@/lib/firestore-helpers";

type Row = PointageDoc & { id: string };

function hoursBetween(entry: Row, exit: Row): number {
  const [eh, em] = entry.heure.split(":").map(Number);
  const [sh, sm] = exit.heure.split(":").map(Number);
  const entryMin = eh * 60 + em;
  const exitMin = sh * 60 + sm;
  return Math.max(0, (exitMin - entryMin) / 60);
}

export default function AdminRapportPointagePage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [employee, setEmployee] = useState("");
  const [date, setDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listPointages(400);
      setRows(data);
    } catch {
      toast.error("Impossible de charger les pointages");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const emp = employee.trim();
    const d = date.trim();
    return rows.filter((r) => {
      if (emp && r.userId !== emp) return false;
      if (d && r.date !== d) return false;
      return true;
    });
  }, [rows, employee, date]);

  const anomalies = useMemo(() => {
    const byUserDate = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = `${r.userId}|${r.date}`;
      const arr = byUserDate.get(key) ?? [];
      arr.push(r);
      byUserDate.set(key, arr);
    }

    const result: Array<{ key: string; kind: string; details: string }> = [];
    for (const [key, arr] of byUserDate.entries()) {
      const entries = arr.filter((x) => x.type === "entree").sort((a, b) => a.heure.localeCompare(b.heure));
      const exits = arr.filter((x) => x.type === "sortie").sort((a, b) => a.heure.localeCompare(b.heure));

      if (entries.length === 0) {
        result.push({ key, kind: "Absence", details: "Aucune entrée" });
        continue;
      }

      const firstEntry = entries[0]!;
      if (firstEntry.heure > "09:00") {
        result.push({ key, kind: "Retard", details: `Entrée à ${firstEntry.heure}` });
      }

      if (exits.length === 0) {
        result.push({ key, kind: "Manquement", details: "Aucune sortie" });
        continue;
      }

      const lastExit = exits[exits.length - 1]!;
      if (lastExit.heure < "17:00") {
        result.push({ key, kind: "Sortie anticipée", details: `Sortie à ${lastExit.heure}` });
      }

      const h = hoursBetween(firstEntry, lastExit);
      if (h < 8) {
        result.push({ key, kind: "Insuffisance", details: `${h.toFixed(2)}h (< 8h)` });
      }
    }
    return result;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapport pointage</h1>
        <p className="text-muted-foreground">Filtres + détection d’anomalies (MVP).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Filtrer par employé (UID) et/ou par jour.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm text-muted-foreground">Employé (userId)</div>
            <Input value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="UID Firebase" />
          </div>
          <div>
            <div className="mb-1 text-sm text-muted-foreground">Date</div>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={load} disabled={loading} className="w-full">
              {loading ? "Chargement..." : "Charger"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pointages</CardTitle>
            <CardDescription>{`${filtered.length} ligne(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">UserId</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Heure</th>
                    <th className="py-2 pr-4">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{r.userId}</td>
                      <td className="py-2 pr-4">{r.date}</td>
                      <td className="py-2 pr-4">{r.heure}</td>
                      <td className="py-2 pr-4">{r.type}</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={4}>
                        Aucune donnée.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anomalies</CardTitle>
            <CardDescription>{`${anomalies.length} anomalie(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">UserId|Date</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a) => (
                    <tr key={`${a.key}|${a.kind}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{a.key}</td>
                      <td className="py-2 pr-4">{a.kind}</td>
                      <td className="py-2 pr-4">{a.details}</td>
                    </tr>
                  ))}
                  {!loading && anomalies.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={3}>
                        Aucune anomalie détectée.
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

