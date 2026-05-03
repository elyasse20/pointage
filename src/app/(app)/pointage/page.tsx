"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { addPointage, getLatestPointageForUser, toHM, toYMD } from "@/lib/firestore-helpers";
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

  const refreshNextTypeRef = useRef<() => Promise<PointageType>>(async () => "entree");

  useEffect(() => {
    refreshNextTypeRef.current = async () => {
      if (!user) return "entree";
      const latest = await getLatestPointageForUser(user.uid);
      if (!latest) return "entree";
      return latest.type === "entree" ? "sortie" : "entree";
    };
  }, [user]);

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
      const now = new Date();
      const type = await refreshNextTypeRef.current();
      const g = geo ?? (await getCurrentPosition().catch(() => null));

      await addPointage({
        userId: user.uid,
        date: toYMD(now),
        heure: toHM(now),
        type,
        latitude: g?.latitude ?? null,
        longitude: g?.longitude ?? null,
        valide: true,
      });

      toast.success(type === "entree" ? "Pointage d'entrée enregistré" : "Pointage de sortie enregistré");
      setQr("");
      setScanning(false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        toast.error("Accès refusé (règles Firestore) أثناء تسجيل الحضور");
      } else if (code === "failed-precondition") {
        toast.error("Index Firestore manquant pour la requête (ou Firestore non prêt)");
      } else {
        toast.error(`Erreur lors du pointage${code ? ` (${code})` : ""}`);
      }
    } finally {
      setSaving(false);
    }
  }, [geo, user]);

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
              MVP: le QR n’est pas encore validé côté serveur; il sert de preuve de scan côté UI.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

