export type UserRole = "admin" | "employe";

export type UserDoc = {
  nom: string;
  email: string;
  role: UserRole;
  createdAt?: unknown;
};

export type PointageType = "entree" | "sortie";

export type PointageDoc = {
  userId: string;
  date: string; // YYYY-MM-DD
  heure: string; // HH:MM
  type: PointageType;
  latitude?: number | null;
  longitude?: number | null;
  valide?: boolean;
  createdAt?: unknown;
};

export type CongeType = "annuel" | "maladie" | "exceptionnel";
export type CongeStatut = "en_attente" | "valide" | "refuse";

export type CongeDoc = {
  userId: string;
  dateDebut: string; // YYYY-MM-DD
  dateFin: string; // YYYY-MM-DD
  type: CongeType;
  statut: CongeStatut;
  createdAt?: unknown;
};

