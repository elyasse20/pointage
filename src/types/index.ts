import type { Role, CongeType, CongeStatut, PointageType } from "@prisma/client";

export type { Role, CongeType, CongeStatut, PointageType };

export type NavItem = {
  title: string;
  href: string;
  icon?: string;
  roles?: Role[];
};
