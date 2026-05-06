import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import jwt from "jsonwebtoken";
import { differenceInMinutes, startOfDay, endOfDay } from "date-fns";
import { FieldValue } from "firebase-admin/firestore";

// Secret utilisé pour signer les QR Codes. Strictement privé côté serveur.
const QR_SECRET = process.env.JWT_SECRET_KEY || "CHANGE_ME_JWT_SECRET_KEY";

// Coordonnées de l'entreprise (à configurer idéalement dans .env)
const COMPANY_LAT = process.env.COMPANY_LATITUDE ? parseFloat(process.env.COMPANY_LATITUDE) : 33.5731; // Ex: Casablanca
const COMPANY_LNG = process.env.COMPANY_LONGITUDE ? parseFloat(process.env.COMPANY_LONGITUDE) : -7.5898;
const MAX_DISTANCE_METERS = 100; // Rayon autorisé

// Fonction utilitaire pour calculer la distance (Formule Haversine)
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Rayon de la terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function POST(req: Request) {
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

    const { qrToken, lat, lng } = await req.json();

    // 2. Validation du Token QR (JSON Web Token)
    if (!qrToken) {
      return NextResponse.json({ error: "QR Code manquant." }, { status: 400 });
    }

    let decodedQr: any;
    try {
      // Vérifie la signature et l'expiration (le token doit avoir été émis avec une durée de vie courte, ex: expiresIn: '5m')
      decodedQr = jwt.verify(qrToken, QR_SECRET);
    } catch (error) {
      console.error("Erreur vérification QR Code:", error);
      return NextResponse.json({ error: "QR Code invalide ou expiré." }, { status: 403 });
    }

    // 3. Validation de la géolocalisation (Geofencing strict)
    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ error: "Coordonnées GPS manquantes." }, { status: 400 });
    }

    const distance = getDistanceInMeters(lat, lng, COMPANY_LAT, COMPANY_LNG);
    if (distance > MAX_DISTANCE_METERS) {
      return NextResponse.json(
        { 
          error: "Échec : Vous n'êtes pas dans la zone autorisée de l'entreprise.",
          distance: Math.round(distance)
        }, 
        { status: 403 }
      );
    }

    // 4. Logique Métier : Entrée ou Sortie ?
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    
    // Récupérer le dernier pointage de l'employé aujourd'hui
    const pointagesRef = adminFirestore.collection("pointages");
    const snapshot = await pointagesRef
      .where("userId", "==", decodedAuth.uid)
      .where("createdAt", ">=", todayStart)
      .where("createdAt", "<=", todayEnd)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let type = "entree";
    let isRetard = false;

    if (!snapshot.empty) {
      const lastPointage = snapshot.docs[0].data();
      // S'il a déjà pointé une entrée, le prochain pointage est une sortie
      if (lastPointage.type === "entree") {
        type = "sortie";
      } else {
        type = "entree";
      }
    } else {
      // C'est le premier pointage de la journée : entree
      // Vérifions le retard (Exemple: heure prévue 09:00)
      const heurePrevue = new Date(now);
      heurePrevue.setHours(9, 0, 0, 0);
      
      if (now > heurePrevue) {
        const retardMinutes = differenceInMinutes(now, heurePrevue);
        if (retardMinutes > 15) {
          isRetard = true;
        }
      }
    }

    // 5. Enregistrement dans Firestore
    // Champs plats pour compatibilité avec le client SDK (pas de GeoPoint)
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const heureStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; // HH:MM
    const nouveauPointage = {
      userId: decodedAuth.uid,
      nom: decodedAuth.name || decodedAuth.email || "Employé",
      date: dateStr,
      heure: heureStr,
      type: type,                    // "entree" | "sortie"
      latitude: lat,
      longitude: lng,
      valide: !isRetard,
      status: isRetard ? "anomalie" : "valide",
      notes: isRetard ? "En retard" : "",
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await pointagesRef.add(nouveauPointage);

    const typeLabel = type === "entree" ? "Entrée" : "Sortie";
    return NextResponse.json({
      success: true,
      message: `Pointage validé avec succès (${typeLabel}).`,
      data: { id: docRef.id, type, isRetard }
    });

  } catch (error) {
    console.error("Erreur serveur Pointage API:", error);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
