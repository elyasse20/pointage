import { Firestore, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}

