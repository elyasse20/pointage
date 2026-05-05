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

    const snapshot = await adminFirestore.collection("users").orderBy("createdAt", "desc").get();
    const employes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
    }));

    return NextResponse.json({ success: true, data: employes });
  } catch (error) {
    console.error("Erreur GET /api/admin/employes:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
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

    const body = await req.json();
    const { employeId, newRole } = body;

    if (!employeId || !newRole) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    await adminFirestore.collection("users").doc(employeId).update({
      role: newRole
    });

    return NextResponse.json({ success: true, message: "Rôle mis à jour avec succès." });
  } catch (error) {
    console.error("Erreur PATCH /api/admin/employes:", error);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
