import { Auth, getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

