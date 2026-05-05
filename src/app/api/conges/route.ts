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

    // Récupérer le nom de l'utilisateur pour faciliter l'affichage admin
    const userDoc = await adminFirestore.collection("users").doc(decodedAuth.uid).get();
    const employeNom = userDoc.exists ? userDoc.data()?.nom : decodedAuth.name || decodedAuth.email;

    const nouveauConge = {
      userId: decodedAuth.uid,
      employeNom: employeNom,
      dateDebut,
      dateFin,
      type,
      motif: motif || "",
      statut: "en_attente",
      createdAt: adminFirestore.FieldValue.serverTimestamp(),
    };

    const docRef = await adminFirestore.collection("conges").add(nouveauConge);

    return NextResponse.json({ success: true, message: "Demande envoyée avec succès.", id: docRef.id });
  } catch (error) {
    console.error("Erreur POST /api/conges:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
