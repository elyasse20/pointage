import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { startOfDay, endOfDay, subDays, format, isWithinInterval, parseISO } from "date-fns";

// Vérifie si l'utilisateur est admin
async function isAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  try {
    const idToken = authHeader.split("Bearer ")[1];
    const decodedAuth = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminFirestore.collection("users").doc(decodedAuth.uid).get();
    return userDoc.exists && userDoc.data()?.role === "admin";
  } catch (error) {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // 1. Récupérer tous les utilisateurs (employés)
    const usersSnapshot = await adminFirestore.collection("users").where("role", "==", "employe").get();
    const totalEmployes = usersSnapshot.size;

    // 2. Récupérer les pointages du jour
    const pointagesTodaySnapshot = await adminFirestore.collection("pointages")
      .where("timestamp", ">=", todayStart)
      .where("timestamp", "<=", todayEnd)
      .get();

    // Calculer les présents (employés ayant pointé au moins une fois aujourd'hui)
    const presentsSet = new Set<string>();
    let retardsToday = 0;
    const anomaliesRecentes: any[] = [];

    pointagesTodaySnapshot.forEach((doc) => {
      const data = doc.data();
      presentsSet.add(data.employeId);
      
      if (data.status === "anomalie") {
        retardsToday++;
        anomaliesRecentes.push({
          id: doc.id,
          nom: data.nom,
          type: "Retard",
          heure: data.timestamp?.toDate ? format(data.timestamp.toDate(), "HH:mm") : "",
          notes: data.notes
        });
      }
    });

    const presentsToday = presentsSet.size;

    // 3. Récupérer les congés validés en cours
    // Note: Firestore n'a pas de requête facile pour "date est entre X et Y" sans index complexe
    // On récupère donc les congés valides récents et on filtre en mémoire.
    const congesSnapshot = await adminFirestore.collection("conges")
      .where("statut", "==", "valide")
      .get();

    let congesToday = 0;
    congesSnapshot.forEach((doc) => {
      const data = doc.data();
      try {
        const start = parseISO(data.dateDebut);
        const end = parseISO(data.dateFin);
        if (isWithinInterval(now, { start: startOfDay(start), end: endOfDay(end) })) {
          congesToday++;
          presentsSet.add(data.userId); // On considère qu'une personne en congé n'est pas "absente" sans motif
        }
      } catch (e) {
        // ignorer les dates mal formées
      }
    });

    // 4. Calculer les absents
    // Absents = Total - (Présents + En congé)
    const absentsToday = Math.max(0, totalEmployes - presentsSet.size);

    // 5. Calculer la donnée pour le graphique des 7 derniers jours
    const chartData = [];
    const sevenDaysAgoStart = startOfDay(subDays(now, 6));

    // On récupère tous les pointages des 7 derniers jours
    const pointagesSemaineSnapshot = await adminFirestore.collection("pointages")
      .where("timestamp", ">=", sevenDaysAgoStart)
      .get();

    // Groupement par jour (YYYY-MM-DD)
    const attendanceByDay: Record<string, Set<string>> = {};
    for (let i = 6; i >= 0; i--) {
      const dateString = format(subDays(now, i), "yyyy-MM-dd");
      attendanceByDay[dateString] = new Set<string>();
      chartData.push({ date: format(subDays(now, i), "dd MMM"), taux: 0, presents: 0 });
    }

    pointagesSemaineSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.timestamp?.toDate) {
        const dayStr = format(data.timestamp.toDate(), "yyyy-MM-dd");
        if (attendanceByDay[dayStr]) {
          attendanceByDay[dayStr].add(data.employeId);
        }
      }
    });

    // Remplir le chartData
    chartData.forEach((point, index) => {
      const dayStr = format(subDays(now, 6 - index), "yyyy-MM-dd");
      const presents = attendanceByDay[dayStr]?.size || 0;
      point.presents = presents;
      point.taux = totalEmployes > 0 ? Math.round((presents / totalEmployes) * 100) : 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalEmployes,
          presentsToday,
          absentsToday,
          retardsToday,
          congesToday
        },
        anomaliesRecentes: anomaliesRecentes.slice(0, 5), // Garder les 5 plus récentes
        chartData
      }
    });

  } catch (error) {
    console.error("Erreur GET /api/admin/stats:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
