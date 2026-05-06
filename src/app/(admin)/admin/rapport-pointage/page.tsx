"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PointageDoc, UserDoc } from "@/lib/data-model";
import { listPointages } from "@/lib/firestore-helpers";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";

type Row = PointageDoc & { id: string };

function hoursBetween(entry: Row, exit: Row): number {
  const [eh, em] = entry.heure.split(":").map(Number);
  const [sh, sm] = exit.heure.split(":").map(Number);
  const entryMin = eh * 60 + em;
  const exitMin = sh * 60 + sm;
  return Math.max(0, (exitMin - entryMin) / 60);
}

function ymdToTime(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00`);
}

function formatPointageType(type: string): string {
  return (type === "entree" || type === "Entrée") ? "Entrée" : "Sortie";
}

export default function AdminRapportPointagePage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; nom: string; email: string; role: UserDoc["role"] }>>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [includeAdminsInPicker, setIncludeAdminsInPicker] = useState(false);

  const [filterMode, setFilterMode] = useState<"day" | "range">("day");
  const [employeeId, setEmployeeId] = useState(""); // "" = tous
  const [date, setDate] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const [pagePointages, setPagePointages] = useState(1);
  const [pageAnomalies, setPageAnomalies] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) {
      queueMicrotask(() => setEmployeesLoading(false));
      return;
    }

    queueMicrotask(() => setEmployeesLoading(true));
    void (async () => {
      try {
        const q = query(collection(db, "users"), limit(500));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data() as Partial<UserDoc>;
          return {
            id: d.id,
            nom: data.nom ?? "(sans nom)",
            email: data.email ?? "",
            role: (data.role === "admin" || data.role === "employe" ? data.role : "employe") as UserDoc["role"],
          };
        });
        list.sort((a, b) => a.nom.localeCompare(b.nom));
        setEmployees(list);
      } catch {
        toast.error("Impossible de charger la liste des employés");
      } finally {
        setEmployeesLoading(false);
      }
    })();
  }, []);

  const employeeOptions = useMemo(() => {
    if (includeAdminsInPicker) return employees;
    return employees.filter((u) => u.role === "employe");
  }, [employees, includeAdminsInPicker]);

  const userById = useMemo(() => {
    const map = new Map<string, { nom: string; email: string; role: UserDoc["role"] }>();
    for (const u of employees) map.set(u.id, { nom: u.nom, email: u.email, role: u.role });
    return map;
  }, [employees]);

  function renderUserCell(uid: string) {
    const u = userById.get(uid);
    const titleText = u?.email ? `${u.nom} · ${u.email}` : u?.nom ?? "";
    return (
      <div className="max-w-[120px]" title={titleText}>
        <div className="truncate font-medium">{u?.nom ?? "Utilisateur inconnu"}</div>
        {u?.email ? <div className="truncate text-xs text-muted-foreground">{u.email}</div> : null}
      </div>
    );
  }

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
    const emp = employeeId.trim();
    return rows.filter((r) => {
      if (emp && r.userId !== emp) return false;

      if (filterMode === "day") {
        const d = date.trim();
        if (d && r.date !== d) return false;
        return true;
      }

      const start = dateDebut.trim();
      const end = dateFin.trim();
      if (!start && !end) return true;

      const t = ymdToTime(r.date);
      if (start && t < ymdToTime(start)) return false;
      if (end && t > ymdToTime(end)) return false;
      return true;
    });
  }, [rows, employeeId, filterMode, date, dateDebut, dateFin]);

  const anomalies = useMemo(() => {
    const byUserDate = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = `${r.userId}|${r.date}`;
      const arr = byUserDate.get(key) ?? [];
      arr.push(r);
      byUserDate.set(key, arr);
    }

    const result: Array<{ key: string; userId: string; date: string; kind: string; details: string }> = [];
    for (const [key, arr] of byUserDate.entries()) {
      const parts = key.split("|");
      const userId = parts[0] ?? key;
      const date = parts[1] ?? "";
      const entries = arr.filter((x) => x.type === "entree" || (x.type as string) === "Entrée").sort((a, b) => a.heure.localeCompare(b.heure));
      const exits = arr.filter((x) => x.type === "sortie" || (x.type as string) === "Sortie").sort((a, b) => a.heure.localeCompare(b.heure));

      if (entries.length === 0 && exits.length > 0) {
        result.push({ key, userId, date, kind: "Absence", details: "Aucune entrée" });
      } else if (entries.length > 0) {
        const firstEntry = entries[0]!;
        if (firstEntry.heure > "09:15") {
          result.push({ key, userId, date, kind: "Retard", details: `Entrée à ${firstEntry.heure}` });
        }

        if (exits.length === 0) {
          result.push({ key, userId, date, kind: "Manquement", details: "Aucune sortie" });
        } else {
          const lastExit = exits[exits.length - 1]!;
          if (lastExit.heure < "17:00") {
            result.push({ key, userId, date, kind: "Sortie anticipée", details: `Sortie à ${lastExit.heure}` });
          }

          const h = hoursBetween(firstEntry, lastExit);
          if (h < 8) {
            result.push({ key, userId, date, kind: "Insuffisance", details: `${h.toFixed(2)}h (< 8h)` });
          }
        }
      }
    }
    return result;
  }, [filtered]);

  // Réinitialiser la pagination quand les filtres changent
  useEffect(() => {
    setPagePointages(1);
    setPageAnomalies(1);
  }, [filtered, anomalies]);

  const totalPagesPointages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginatedPointages = filtered.slice((pagePointages - 1) * ITEMS_PER_PAGE, pagePointages * ITEMS_PER_PAGE);

  const totalPagesAnomalies = Math.ceil(anomalies.length / ITEMS_PER_PAGE) || 1;
  const paginatedAnomalies = anomalies.slice((pageAnomalies - 1) * ITEMS_PER_PAGE, pageAnomalies * ITEMS_PER_PAGE);

  const selectedEmployee = employeeId ? userById.get(employeeId) : undefined;
  const selectedEmployeeLabel = selectedEmployee?.email
    ? `${selectedEmployee.nom} · ${selectedEmployee.email}`
    : selectedEmployee?.nom;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapport pointage</h1>
        <p className="text-muted-foreground">Filtres + détection d’anomalies (MVP).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>
            Analyse par <span className="font-medium">date</span>, <span className="font-medium">période</span> ou{" "}
            <span className="font-medium">employé</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Employé</div>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={employeesLoading}
              >
                <option value="">{includeAdminsInPicker ? "Tous les comptes" : "Tous les employés"}</option>
                {employeeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} {u.email ? `(${u.email})` : ""} · {u.role}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={includeAdminsInPicker ? "default" : "outline"}
                  onClick={() => {
                    setIncludeAdminsInPicker((v) => {
                      const next = !v;
                      const nextOptions = next ? employees : employees.filter((u) => u.role === "employe");
                      if (employeeId && !nextOptions.some((u) => u.id === employeeId)) setEmployeeId("");
                      return next;
                    });
                  }}
                  disabled={employeesLoading}
                >
                  {includeAdminsInPicker ? "Inclut admins" : "Employés seulement"}
                </Button>
              </div>
              {employeeId ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Filtre actif:{" "}
                  <span className="font-medium">
                    {selectedEmployeeLabel ?? "Utilisateur"}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3">
              <div>
                <div className="mb-1 text-sm text-muted-foreground">Mode</div>
                <div className="flex gap-2">
                  <Button type="button" variant={filterMode === "day" ? "default" : "outline"} onClick={() => setFilterMode("day")}>
                    Date
                  </Button>
                  <Button type="button" variant={filterMode === "range" ? "default" : "outline"} onClick={() => setFilterMode("range")}>
                    Période
                  </Button>
                </div>
              </div>

              {filterMode === "day" ? (
                <div>
                  <div className="mb-1 text-sm text-muted-foreground">Date</div>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Date début</div>
                    <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Date fin</div>
                    <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Astuce: clique <span className="font-medium">Charger</span> pour rafraîchir les données, puis joue avec les filtres (instantané).
            </div>
            <Button onClick={load} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Chargement..." : "Charger les pointages"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>Pointages</CardTitle>
            <CardDescription>{`${filtered.length} ligne(s)`}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Employé</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Date</th>
                    <th className="py-2 pr-4 whitespace-nowrap">Heure</th>
                    <th className="py-2 pr-4">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPointages.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 align-top">{renderUserCell(r.userId)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap align-top">{r.date}</td>
                      <td className="py-2 pr-4 whitespace-nowrap align-top">{r.heure}</td>
                      <td className="py-2 pr-4 align-top">{formatPointageType(r.type)}</td>
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

            <div className="flex items-center justify-between mt-auto pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Page {pagePointages} sur {totalPagesPointages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagePointages <= 1} onClick={() => setPagePointages(p => p - 1)}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={pagePointages >= totalPagesPointages} onClick={() => setPagePointages(p => p + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>Anomalies</CardTitle>
            <CardDescription>{`${anomalies.length} anomalie(s)`}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm table-fixed">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2 w-[35%]">Employé</th>
                    <th className="py-2 pr-2 w-[25%]">Date</th>
                    <th className="py-2 pr-2 w-[20%]">Anomalie</th>
                    <th className="py-2 pr-2 w-[20%]">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAnomalies.map((a) => (
                    <tr key={`${a.key}|${a.kind}`} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-top overflow-hidden">{renderUserCell(a.userId)}</td>
                      <td className="py-2 pr-2 align-top">{a.date}</td>
                      <td className="py-2 pr-2 align-top break-words whitespace-normal">{a.kind}</td>
                      <td className="py-2 pr-2 align-top break-words whitespace-normal">{a.details}</td>
                    </tr>
                  ))}
                  {!loading && anomalies.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={4}>
                        Aucune anomalie détectée.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Page {pageAnomalies} sur {totalPagesAnomalies}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pageAnomalies <= 1} onClick={() => setPageAnomalies(p => p - 1)}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" disabled={pageAnomalies >= totalPagesAnomalies} onClick={() => setPageAnomalies(p => p + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

