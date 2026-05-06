import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedAuth = await adminAuth.verifyIdToken(idToken);

    const congesRef = adminFirestore.collection("conges");
    const snapshot = await congesRef
      .where("userId", "==", decodedAuth.uid)
      .orderBy("createdAt", "desc")
      .get();

    const conges = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convertir le timestamp Firestore en ISO string si nécessaire
      createdAt: doc.data().createdAt?.toDate().toISOString(),
    }));

    return NextResponse.json({ success: true, data: conges });
  } catch (error) {
    console.error("Erreur GET /api/conges:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedAuth = await adminAuth.verifyIdToken(idToken);

    const body = await req.json();
    const { dateDebut, dateFin, type, motif } = body;

    if (!dateDebut || !dateFin || !type) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }

    // Récupérer le nom de l'employé depuis Firebase Auth (email garanti)
    // puis depuis Firestore users, puis depuis le token décodé
    let employeNom: string = "";
    try {
      const authUser = await adminAuth.getUser(decodedAuth.uid);
      employeNom = authUser.displayName || authUser.email || "";
    } catch {/* ignore */}

    if (!employeNom) {
      try {
        const userDoc = await adminFirestore.collection("users").doc(decodedAuth.uid).get();
        if (userDoc.exists) {
          const d = userDoc.data()!;
          employeNom = d.nom || d.email || "";
        }
      } catch {/* ignore */}
    }

    if (!employeNom) {
      employeNom = decodedAuth.email || decodedAuth.name || decodedAuth.uid.slice(0, 8);
    }

    const nouveauConge = {
      userId: decodedAuth.uid,
      employeNom,
      dateDebut,
      dateFin,
      type,
      motif: motif || "",
      statut: "en_attente",
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminFirestore.collection("conges").add(nouveauConge);

    return NextResponse.json({ success: true, message: "Demande envoyée avec succès.", id: docRef.id });
  } catch (error) {
    console.error("Erreur POST /api/conges:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
