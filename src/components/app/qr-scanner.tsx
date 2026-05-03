"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function QrScanner({ onDecoded }: { onDecoded: (text: string) => void }) {
  const [elementId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `qr_${crypto.randomUUID()}`;
    return `qr_${Date.now().toString(16)}`;
  });
  const qrRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const id = elementId;
    const qr = new Html5Qrcode(id);
    qrRef.current = qr;

    void qr
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => onDecoded(decodedText),
        () => {},
      )
      .then(() => {
        startedRef.current = true;
      })
      .catch(() => {
        startedRef.current = false;
      });

    return () => {
      const current = qrRef.current;
      qrRef.current = null;
      if (!current) return;

      const stopSafely = async () => {
        try {
          if (startedRef.current) await current.stop();
        } catch {
          // ignore
        } finally {
          startedRef.current = false;
        }

        try {
          await current.clear();
        } catch {
          // ignore
        }
      };

      void stopSafely();
    };
  }, [elementId, onDecoded]);

  return <div id={elementId} />;
}

