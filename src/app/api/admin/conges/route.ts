import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";

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

// GET: Lister les demandes "en_attente"
export async function GET(req: Request) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const congesRef = adminFirestore.collection("conges");
    const snapshot = await congesRef
      .where("statut", "==", "en_attente")
      .orderBy("createdAt", "desc")
      .get();

    // Enrichir chaque congé avec le nom depuis Firebase Auth (source fiable)
    const conges = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        let employeNom: string = data.employeNom || "";

        // Priorité 1 : utiliser le nom déjà stocké dans le document
        // Priorité 2 : Firebase Auth (toujours disponible — email garanti)
        if (!employeNom) {
          const uid = data.userId || data.uid || null;
          if (uid) {
            try {
              const authUser = await adminAuth.getUser(uid);
              employeNom = authUser.displayName || authUser.email || uid.slice(0, 8);
            } catch {
              // Priorité 3 : collection Firestore users
              try {
                const userDoc = await adminFirestore.collection("users").doc(uid).get();
                if (userDoc.exists) {
                  const d = userDoc.data()!;
                  employeNom = d.nom || d.email || uid.slice(0, 8);
                }
              } catch {
                employeNom = uid.slice(0, 8);
              }
            }
          }
        }

        return {
          id: doc.id,
          ...data,
          employeNom: employeNom || "Inconnu",
          createdAt: data.createdAt?.toDate().toISOString(),
        };
      })
    );

    return NextResponse.json({ success: true, data: conges });
  } catch (error) {
    console.error("Erreur GET /api/admin/conges:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}


// PUT: Valider ou Refuser une demande
export async function PUT(req: Request) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const body = await req.json();
    const { id, statut, motifRefus } = body;

    if (!id || !["valide", "refuse"].includes(statut)) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    const congeRef = adminFirestore.collection("conges").doc(id);
    const docSnap = await congeRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    const updateData: any = { statut };
    if (statut === "refuse" && motifRefus) {
      updateData.motifRefus = motifRefus;
    }

    await congeRef.update(updateData);

    return NextResponse.json({ success: true, message: `Demande de congé ${statut} avec succès.` });
  } catch (error) {
    console.error("Erreur PUT /api/admin/conges:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
