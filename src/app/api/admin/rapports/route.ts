import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedAuth = await adminAuth.verifyIdToken(idToken);
    
    // Vérification Admin
    const adminDoc = await adminFirestore.collection("users").doc(decodedAuth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const mois = searchParams.get("mois");
    const annee = searchParams.get("annee");
    const employeId = searchParams.get("employeId");

    let query: FirebaseFirestore.Query = adminFirestore.collection("pointages");

    if (employeId) {
      query = query.where("userId", "==", employeId);
    }
    
    // Tri par défaut
    query = query.orderBy("createdAt", "desc");

    const snapshot = await query.get();

    // Récupérer les noms des utilisateurs
    const usersSnap = await adminFirestore.collection("users").get();
    const usersMap: Record<string, any> = {};
    usersSnap.docs.forEach(doc => {
      usersMap[doc.id] = doc.data();
    });

    let pointages = snapshot.docs.map((doc) => {
      const data = doc.data();
      // On considère une entrée après 09:15 comme une anomalie (retard)
      const isAnomaly = data.type === "entree" && data.heure > "09:15";
      
      return {
        id: doc.id,
        date: data.date as string,
        ...data,
        employeNom: usersMap[data.userId]?.nom || "Inconnu",
        isAnomaly,
        createdAt: data.createdAt?.toDate().toISOString(),
      };
    });

    // Filtrage en mémoire pour éviter les erreurs d'index Firestore complexes
    if (date) {
      pointages = pointages.filter(p => p.date === date);
    } else {
      if (annee) {
        pointages = pointages.filter(p => p.date.startsWith(annee));
      }
      if (mois) {
        const moisStr = mois.padStart(2, '0');
        pointages = pointages.filter(p => p.date.substring(5, 7) === moisStr);
      }
    }

    return NextResponse.json({ success: true, data: pointages });
  } catch (error) {
    console.error("Erreur GET /api/admin/rapports:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
