"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { Filter, Download, AlertTriangle, CheckCircle } from "lucide-react";

type Pointage = {
  id: string;
  userId: string;
  employeNom: string;
  date: string;
  heure: string;
  type: "entree" | "sortie";
  isAnomaly: boolean;
};

type Employe = {
  id: string;
  nom: string;
  email: string;
};

export default function AdminRapportsPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);

  // Filtres
  const [filterDate, setFilterDate] = useState("");
  const [filterMois, setFilterMois] = useState("");
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear().toString());
  const [filterEmploye, setFilterEmploye] = useState("");

  useEffect(() => {
    if (!user || role !== "admin") return;
    fetchEmployes();
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    
    // Un debounce simple
    const delayDebounce = setTimeout(() => {
      fetchRapports();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [user, role, filterDate, filterMois, filterAnnee, filterEmploye]);

  const fetchEmployes = async () => {
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/admin/employes", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setEmployes(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRapports = async () => {
    try {
      setLoading(true);
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const params = new URLSearchParams();
      if (filterDate) params.append("date", filterDate);
      if (filterMois) params.append("mois", filterMois);
      if (filterAnnee) params.append("annee", filterAnnee);
      if (filterEmploye) params.append("employeId", filterEmploye);

      const res = await fetch(`/api/admin/rapports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPointages(data.data);
      } else {
        toast.error(data.error || "Erreur lors du chargement des rapports.");
      }
    } catch (err) {
      toast.error("Impossible de récupérer les rapports.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Nom de l'employé", "Date", "Heure", "Type", "Statut Anomalie"];
    const csvContent = [
      headers.join(","),
      ...pointages.map(p => 
        `"${p.employeNom}","${p.date}","${p.heure}","${p.type === 'entree' ? 'Entrée' : 'Sortie'}","${p.isAnomaly ? 'Oui (Retard)' : 'Non'}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `rapports_pointage_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || role !== "admin") return null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapports & Filtres</h1>
          <p className="text-muted-foreground mt-2">
            Consultez l'historique complet des pointages et exportez les données.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={pointages.length === 0}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Filtres avancés
          </CardTitle>
          <CardDescription>Affinez les résultats affichés dans le tableau.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date (Jour précis)</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  if (e.target.value) {
                    setFilterMois(""); // Réinitialiser le mois si une date précise est choisie
                  }
                }}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Mois</label>
              <select
                value={filterMois}
                onChange={(e) => {
                  setFilterMois(e.target.value);
                  if (e.target.value) {
                    setFilterDate(""); // Réinitialiser la date si un mois est choisi
                  }
                }}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Tous les mois</option>
                <option value="1">Janvier</option>
                <option value="2">Février</option>
                <option value="3">Mars</option>
                <option value="4">Avril</option>
                <option value="5">Mai</option>
                <option value="6">Juin</option>
                <option value="7">Juillet</option>
                <option value="8">Août</option>
                <option value="9">Septembre</option>
                <option value="10">Octobre</option>
                <option value="11">Novembre</option>
                <option value="12">Décembre</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Année</label>
              <select
                value={filterAnnee}
                onChange={(e) => setFilterAnnee(e.target.value)}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Toutes les années</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Employé</label>
              <select
                value={filterEmploye}
                onChange={(e) => setFilterEmploye(e.target.value)}
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Tous les employés</option>
                {employes.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nom}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted bg-muted/30">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nom de l'employé</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Heure</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Type</th>
                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                          Chargement des données...
                        </div>
                      </td>
                    </tr>
                  ) : pointages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Aucun pointage trouvé pour ces filtres.
                      </td>
                    </tr>
                  ) : (
                    pointages.map((p) => (
                      <tr key={p.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">{p.employeNom}</td>
                        <td className="p-4 align-middle">{p.date}</td>
                        <td className="p-4 align-middle">{p.heure}</td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            p.type === 'entree' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {p.type === 'entree' ? 'Entrée' : 'Sortie'}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-center">
                          {p.isAnomaly ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Retard
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
