"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { RefreshCw, ShieldAlert, Clock, Info } from "lucide-react";

export default function AdminQRCodePage() {
  const { user, role } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNewToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const auth = getFirebaseAuth();
      const idToken = await auth?.currentUser?.getIdToken();

      if (!idToken) throw new Error("Session invalide.");

      const res = await fetch("/api/admin/qr-generate", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur de génération du QR Code.");
      }

      setQrToken(data.qrToken);
      // On déclenche le rafraîchissement un peu avant l'expiration (ex: 290 secondes = 4m50s)
      setTimeLeft(290);
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Timer pour le compte à rebours
  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Quand le temps est écoulé, on refetch un nouveau token
          fetchNewToken();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, fetchNewToken]);

  // Initial fetch
  useEffect(() => {
    if (user && role === "admin") {
      fetchNewToken();
    }
  }, [user, role, fetchNewToken]);

  // Formatage du temps restant (MM:SS)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!user || role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Accès Restreint</h2>
        <p className="text-muted-foreground mt-2">Vous devez être administrateur pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Borne de Pointage</h1>
        <p className="text-muted-foreground mt-2">
          Affichez cet écran à l'entrée de l'entreprise. Les employés le scanneront pour pointer.
        </p>
      </div>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Scannez pour Pointer</CardTitle>
          <CardDescription>Ouvrez l'application employée et sélectionnez "Pointer"</CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center pt-6 pb-12 space-y-8">
          {error ? (
            <div className="text-destructive flex flex-col items-center p-6 bg-destructive/10 rounded-xl">
              <ShieldAlert className="w-10 h-10 mb-2" />
              <p className="font-semibold">{error}</p>
              <button onClick={fetchNewToken} className="mt-4 text-sm underline flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> Réessayer
              </button>
            </div>
          ) : isLoading && !qrToken ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground">Génération du QR Code sécurisé...</p>
            </div>
          ) : qrToken ? (
            <>
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <QRCodeSVG 
                  value={qrToken} 
                  size={320}
                  level="H" // Haute correction d'erreur
                  includeMargin={false}
                />
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-primary font-medium bg-primary/10 px-4 py-2 rounded-full">
                  <Clock className="w-4 h-4" />
                  Actualisation dans {formatTime(timeLeft)}
                </div>
                
                <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-2 rounded-full">
                  <Info className="w-4 h-4" />
                  QR Code Dynamique Sécurisé
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
