import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported } from "firebase/analytics";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
};

function readFirebaseConfigFromEnv(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = readFirebaseConfigFromEnv();
  if (!config) return null;

  if (getApps().length) return getApps()[0]!;
  return initializeApp(config);
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;

  const config = readFirebaseConfigFromEnv();
  if (!config?.measurementId) return null;

  if (!(await isSupported())) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  return getAnalytics(app);
}
