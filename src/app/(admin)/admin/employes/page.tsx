"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { Users, Shield, User, Edit } from "lucide-react";

type Employe = {
  id: string;
  nom: string;
  email: string;
  role: "admin" | "employe";
  createdAt: string;
};

export default function AdminEmployesPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employes, setEmployes] = useState<Employe[]>([]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    fetchEmployes();
  }, [user, role]);

  const fetchEmployes = async () => {
    try {
      setLoading(true);
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/admin/employes", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setEmployes(data.data);
      } else {
        toast.error(data.error || "Erreur lors du chargement des employés.");
      }
    } catch (err) {
      toast.error("Impossible de récupérer la liste.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (employeId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "employe" : "admin";
    
    if (!confirm(`Voulez-vous vraiment changer le rôle de cet utilisateur en ${newRole.toUpperCase()} ?`)) {
      return;
    }

    try {
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/admin/employes", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ employeId, newRole }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        // Mettre à jour la liste localement
        setEmployes(employes.map(emp => emp.id === employeId ? { ...emp, role: newRole as any } : emp));
      } else {
        toast.error(data.error || "Erreur lors de la modification.");
      }
    } catch (err) {
      toast.error("Erreur serveur.");
    }
  };

  if (!user || role !== "admin") return null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Liste des Employés</h1>
        <p className="text-muted-foreground mt-2">
          Gérez le personnel et leurs droits d'accès à la plateforme.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Personnel ({employes.length})
          </CardTitle>
          <CardDescription>Tous les utilisateurs enregistrés dans le système.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted bg-muted/30">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Nom Complet</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rôle actuel</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Inscrit le</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        <div className="flex justify-center items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                          Chargement du personnel...
                        </div>
                      </td>
                    </tr>
                  ) : employes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Aucun employé trouvé.
                      </td>
                    </tr>
                  ) : (
                    employes.map((emp) => (
                      <tr key={emp.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {emp.nom ? emp.nom.substring(0, 2).toUpperCase() : '?'}
                            </div>
                            {emp.nom || 'Inconnu'}
                          </div>
                        </td>
                        <td className="p-4 align-middle">{emp.email}</td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            emp.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {emp.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            {emp.role === 'admin' ? 'Administrateur' : 'Employé'}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground">
                          {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                        </td>
                        <td className="p-4 align-middle text-right">
                          <button
                            onClick={() => handleRoleChange(emp.id, emp.role)}
                            disabled={emp.id === user?.uid}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                            title={emp.id === user?.uid ? "Vous ne pouvez pas modifier votre propre rôle" : "Modifier le rôle"}
                          >
                            <Edit className="w-4 h-4" />
                            {emp.role === 'admin' ? 'Rétrograder' : 'Promouvoir'}
                          </button>
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
