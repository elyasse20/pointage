"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerQRProps {
  onScanSuccess: (decodedText: string) => void;
}

export function ScannerQR({ onScanSuccess }: ScannerQRProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameras, setHasCameras] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async () => {
    setIsScanning(true);
    setErrorMsg("");
    
    setTimeout(async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          setHasCameras(true);
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" }, // Préfère la caméra arrière
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              // Succès
              scanner.stop().then(() => {
                setIsScanning(false);
                onScanSuccess(decodedText);
              }).catch(err => console.error("Failed to stop scanner", err));
            },
            (errorMessage) => {
              // Échec du scan (ignoré car appelé très souvent)
            }
          );
        } else {
          setHasCameras(false);
          setErrorMsg("Aucune caméra trouvée sur cet appareil.");
          setIsScanning(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Veuillez autoriser l'accès à la caméra pour scanner le QR Code.");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Erreur lors de l'arrêt du scanner:", err);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 border rounded-xl shadow-sm bg-white dark:bg-zinc-900">
      {!isScanning ? (
        <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <Camera className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg">Prêt à pointer</h3>
          <p className="text-sm text-muted-foreground">
            Placez-vous devant la borne et scannez le QR Code pour valider votre présence.
          </p>
          <Button onClick={startScanner} className="w-full mt-4">
            Ouvrir la caméra
          </Button>
          {errorMsg && <p className="text-destructive text-sm mt-2">{errorMsg}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          {/* Conteneur requis par html5-qrcode */}
          <div id="reader" className="w-full overflow-hidden rounded-lg shadow-inner bg-black"></div>
          
          <Button variant="outline" onClick={stopScanner} className="w-full mt-4">
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
