"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { Users, UserCheck, UserX, AlertTriangle, CalendarDays, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Kpis = {
  totalEmployes: number;
  presentsToday: number;
  absentsToday: number;
  retardsToday: number;
  congesToday: number;
};

type Anomaly = {
  id: string;
  nom: string;
  type: string;
  heure: string;
  notes: string;
};

type ChartData = {
  date: string;
  taux: number;
  presents: number;
};

export default function AdminDashboardPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    if (!user || role !== "admin") return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const auth = getFirebaseAuth();
        const idToken = await auth?.currentUser?.getIdToken();

        if (!idToken) return;

        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        const data = await res.json();

        if (data.success) {
          setKpis(data.data.kpis);
          setAnomalies(data.data.anomaliesRecentes);
          setChartData(data.data.chartData);
        } else {
          toast.error(data.error || "Erreur lors du chargement des statistiques.");
        }
      } catch (error) {
        toast.error("Impossible de récupérer les statistiques.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, role]);

  if (!user || role !== "admin") return null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vue d'ensemble</h1>
        <p className="text-muted-foreground mt-2">Analysez l'assiduité de l'équipe et les indicateurs clés en temps réel.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Employés</p>
                <p className="text-3xl font-bold">{loading ? "..." : kpis?.totalEmployes}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Présents Aujourd'hui</p>
                <p className="text-3xl font-bold">{loading ? "..." : kpis?.presentsToday}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Absents</p>
                <p className="text-3xl font-bold">{loading ? "..." : kpis?.absentsToday}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                <UserX className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Retards (Anomalies)</p>
                <p className="text-3xl font-bold">{loading ? "..." : kpis?.retardsToday}</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">En Congé</p>
                <p className="text-3xl font-bold">{loading ? "..." : kpis?.congesToday}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                <CalendarDays className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        {/* Graphique */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Taux de présence (7 derniers jours)
            </CardTitle>
            <CardDescription>
              Évolution du pourcentage d'employés présents sur site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground animate-pulse">
                Chargement du graphique...
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTaux" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#6b7280' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number, name: string) => [
                        name === 'taux' ? `${value}%` : value, 
                        name === 'taux' ? 'Taux de présence' : 'Employés présents'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="taux"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTaux)"
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anomalies récentes */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Anomalies du jour
            </CardTitle>
            <CardDescription>
              Employés ayant pointé en retard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded-md"></div>
                ))}
              </div>
            ) : anomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg bg-green-50/50 border-green-100">
                <CheckCircle2 className="w-10 h-10 text-green-500 mb-2" />
                <p className="font-medium text-green-700">Aucune anomalie</p>
                <p className="text-xs text-green-600/80">Tous les pointages sont normaux aujourd'hui.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {anomalies.map((anomalie) => (
                  <div key={anomalie.id} className="flex items-start justify-between p-3 border rounded-lg bg-orange-50/50 border-orange-100">
                    <div>
                      <p className="font-semibold text-sm">{anomalie.nom}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{anomalie.notes}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 text-[10px] font-bold text-orange-700 bg-orange-100 rounded-full mb-1">
                        {anomalie.type}
                      </span>
                      <p className="text-xs font-medium text-muted-foreground">{anomalie.heure}</p>
                    </div>
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

// Composant icône pour CheckCircle2 (pour le fallback d'anomalies)
function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
