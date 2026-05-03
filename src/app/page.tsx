import type { Metadata } from "next";
import { HomeGate } from "@/components/marketing/home-gate";

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "TimeTrack Pro — pointage numérique, géolocalisation, QR code, congés et rapports pour les équipes RH.",
};

export default function HomePage() {
  return <HomeGate />;
}
