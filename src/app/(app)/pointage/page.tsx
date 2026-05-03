"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseFunctions } from "@/lib/firebase-functions";
import type { PointageType } from "@/lib/data-model";

type Geo = { latitude: number; longitude: number };

const Html5QrcodeScanner = dynamic(async () => (await import("@/components/app/qr-scanner")).QrScanner, {
  ssr: false,
});

function getCurrentPosition(): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function PointagePage() {
  const { user } = useAuth();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [qr, setQr] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGetGeo = useCallback(async () => {
    try {
      const g = await getCurrentPosition();
      setGeo(g);
      toast.success("Position récupérée");
    } catch {
      toast.error("Impossible de récupérer la géolocalisation");
    }
  }, []);

  const handleQrDecoded = useCallback((text: string) => {
    setQr(text);
    toast.success("QR détecté");
    setScanning(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const functions = getFirebaseFunctions();
      if (!functions) {
        toast.error("Firebase n'est pas configuré");
        return;
      }

      const qrToken = process.env.NEXT_PUBLIC_POINTAGE_QR_TOKEN?.trim() ?? "";
      if (!qrToken) {
        toast.error("QR token manquant: définissez NEXT_PUBLIC_POINTAGE_QR_TOKEN dans .env.local");
        return;
      }

      const scanned = qr.trim();
      if (!scanned) {
        toast.error("Scannez le QR code (ou collez le token) avant de pointer");
        return;
      }

      const g = geo ?? (await getCurrentPosition().catch(() => null));
      if (!g) {
        toast.error("La géolocalisation est obligatoire pour pointer");
        return;
      }

      const createPointage = httpsCallable(functions, "createPointage");
      const res = await createPointage({ latitude: g.latitude, longitude: g.longitude, qr: scanned });
      const payload = res.data as { type?: PointageType };

      const type = payload.type;
      toast.success(type === "sortie" ? "Pointage de sortie enregistré" : "Pointage d'entrée enregistré");
      setQr("");
      setScanning(false);
    } catch (err) {
      const anyErr = err as { code?: string; message?: string; details?: unknown };
      const code = anyErr?.code;
      const msg = typeof anyErr?.message === "string" ? anyErr.message : "";

      if (code === "functions/unauthenticated") {
        toast.error("Session expirée: reconnectez-vous");
      } else if (
        code === "functions/permission-denied" ||
        msg.toLowerCase().includes("outside allowed area") ||
        msg.toLowerCase().includes("invalid qr")
      ) {
        toast.error("Pointage refusé: zone ou QR invalide");
      } else if (code === "functions/invalid-argument") {
        toast.error("Données invalides");
      } else if (code === "functions/failed-precondition") {
        toast.error("Configuration serveur incomplète (token/zone).");
      } else {
        toast.error(msg || "Erreur lors du pointage");
      }
    } finally {
      setSaving(false);
    }
  }, [geo, user, qr]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pointage</h1>
        <p className="text-muted-foreground">Géolocalisation + QR code, puis enregistrement du pointage.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1) Géolocalisation</CardTitle>
            <CardDescription>Récupère votre position actuelle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGetGeo} variant="outline">
              Récupérer ma position
            </Button>
            <div className="text-sm text-muted-foreground">
              {geo ? (
                <div>
                  Latitude: {geo.latitude.toFixed(6)} <br />
                  Longitude: {geo.longitude.toFixed(6)}
                </div>
              ) : (
                "Aucune position."
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) QR Code</CardTitle>
            <CardDescription>Scannez le QR code de l’entreprise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={() => setScanning((s) => !s)} variant="outline">
                {scanning ? "Arrêter le scan" : "Scanner"}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Enregistrement..." : "Pointer"}
              </Button>
            </div>

            {scanning ? (
              <div className="rounded-md border p-3">
                <Html5QrcodeScanner onDecoded={handleQrDecoded} />
              </div>
            ) : null}

            <Input value={qr} onChange={(e) => setQr(e.target.value)} placeholder="QR (auto après scan)" />
            <p className="text-xs text-muted-foreground">
              Le QR est validé côté serveur (Callable Function) avec le token configuré dans l’environnement.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

