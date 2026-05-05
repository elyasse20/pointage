"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { ScannerQR } from "@/components/pointage/ScannerQR";
import { useGeolocation } from "@/hooks/useGeolocation";
import { MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase-auth";

export default function PointagePage() {
  const { user } = useAuth();
  const { coordinates, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScanSuccess = useCallback((decodedText: string) => {
    setQrToken(decodedText);
    toast.success("QR Code scanné avec succès !");
    // On déclenche automatiquement la récupération GPS si elle n'est pas déjà faite
    if (!coordinates) {
      getLocation();
    }
  }, [coordinates, getLocation]);

  const handleSubmitPointage = async () => {
    if (!qrToken) {
      toast.error("Veuillez scanner le QR Code d'abord.");
      return;
    }
    if (!coordinates) {
      toast.error("Veuillez autoriser la géolocalisation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();

      if (!idToken) {
        throw new Error("Session invalide.");
      }

      const res = await fetch("/api/pointage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          qrToken,
          lat: coordinates.lat,
          lng: coordinates.lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du pointage.");
      }

      if (data.data.isRetard) {
        toast.warning(`Pointage validé (${data.data.type}), mais marqué en retard.`);
      } else {
        toast.success(data.message);
      }
      
      // Réinitialiser pour le prochain pointage
      setQrToken(null);
      
    } catch (err: any) {
      toast.error(err.message || "Impossible d'enregistrer le pointage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pointage Intelligent</h1>
        <p className="text-muted-foreground mt-2">
          Scannez le QR Code de la borne et validez votre position pour pointer.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Étape 1 : QR Code */}
        <Card className={qrToken ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              1. Scan du QR Code
              {qrToken && <CheckCircle2 className="text-green-500 w-5 h-5" />}
            </CardTitle>
            <CardDescription>
              Scannez le QR Code affiché à l'entrée de l'entreprise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!qrToken ? (
              <ScannerQR onScanSuccess={handleScanSuccess} />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-900/30">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
                <p className="font-medium text-green-600 dark:text-green-400">QR Code valide enregistré</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-4 text-muted-foreground"
                  onClick={() => setQrToken(null)}
                >
                  Scanner à nouveau
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Étape 2 : GPS & Validation */}
        <Card className={coordinates ? "border-blue-500/50 bg-blue-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              2. Validation & GPS
              {coordinates && <CheckCircle2 className="text-blue-500 w-5 h-5" />}
            </CardTitle>
            <CardDescription>
              Votre position est requise pour confirmer que vous êtes sur site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* GPS Status */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${coordinates ? "text-blue-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="font-medium text-sm">Position GPS</p>
                  <p className="text-xs text-muted-foreground">
                    {geoLoading ? "Recherche en cours..." : 
                     coordinates ? `Précision: Haute` : "Non acquise"}
                  </p>
                </div>
              </div>
              {!coordinates && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={getLocation} 
                  disabled={geoLoading}
                >
                  Obtenir
                </Button>
              )}
            </div>

            {geoError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{geoError}</p>
              </div>
            )}

            {/* Action finale */}
            <div className="pt-4 border-t">
              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleSubmitPointage}
                disabled={!qrToken || !coordinates || isSubmitting}
              >
                {isSubmitting ? "Validation en cours..." : "Valider mon pointage"}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-3">
                Vous devez valider les deux étapes pour pointer.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
