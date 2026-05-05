import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import jwt from "jsonwebtoken";

const QR_SECRET = process.env.JWT_SECRET_KEY || "CHANGE_ME_JWT_SECRET_KEY";

export async function GET(req: Request) {
  try {
    // 1. Vérification de l'authentification Firebase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé. Token manquant." }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedAuth;
    try {
      decodedAuth = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Erreur vérification token Firebase:", error);
      return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
    }

    // 2. Vérification du rôle Administrateur
    const userDoc = await adminFirestore.collection("users").doc(decodedAuth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé. Rôle administrateur requis." }, { status: 403 });
    }

    // 3. Génération du Token QR Dynamique (valide 5 minutes)
    // Le payload peut contenir un identifiant de session ou un timestamp
    const payload = {
      type: "pointage",
      generatedAt: Date.now(),
      issuer: decodedAuth.uid
    };

    const qrToken = jwt.sign(payload, QR_SECRET, { expiresIn: '5m' });

    return NextResponse.json({
      success: true,
      qrToken,
      expiresIn: 300 // 5 minutes en secondes
    });

  } catch (error) {
    console.error("Erreur serveur QR Generate API:", error);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
