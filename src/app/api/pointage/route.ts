import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import jwt from "jsonwebtoken";
import { differenceInMinutes, startOfDay, endOfDay } from "date-fns";

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
      .where("employeId", "==", decodedAuth.uid)
      .where("timestamp", ">=", todayStart)
      .where("timestamp", "<=", todayEnd)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    let type = "Entrée";
    let isRetard = false;

    if (!snapshot.empty) {
      const lastPointage = snapshot.docs[0].data();
      // S'il a déjà pointé une Entrée, le prochain pointage est une Sortie
      if (lastPointage.type === "Entrée") {
        type = "Sortie";
      } else {
        // S'il a déjà une sortie, on peut le laisser re-rentrer, etc.
        type = "Entrée";
      }
    } else {
      // C'est le premier pointage de la journée : Entrée
      // Vérifions le retard (Exemple: heure prévue 09:00)
      const heurePrevue = new Date(now);
      heurePrevue.setHours(9, 0, 0, 0);
      
      if (now > heurePrevue) {
        // Tolérance de 15 minutes par exemple
        const retardMinutes = differenceInMinutes(now, heurePrevue);
        if (retardMinutes > 15) {
          isRetard = true;
        }
      }
    }

    // 5. Enregistrement dans Firestore
    const nouveauPointage = {
      employeId: decodedAuth.uid,
      nom: decodedAuth.name || decodedAuth.email || "Employé",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: type,
      location: new admin.firestore.GeoPoint(lat, lng),
      status: isRetard ? "anomalie" : "valide",
      notes: isRetard ? "En retard" : "",
    };

    const docRef = await pointagesRef.add(nouveauPointage);

    return NextResponse.json({
      success: true,
      message: `Pointage validé avec succès (${type}).`,
      data: { id: docRef.id, type, isRetard }
    });

  } catch (error) {
    console.error("Erreur serveur Pointage API:", error);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
