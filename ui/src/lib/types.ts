import type { StatusType } from "@/features/nav-system/components/status-indicator";

export type OfficeId<T extends string = string> = string & { __type?: T };

export interface Company {
  _id: OfficeId<"companies">;
  name: string;
}

export interface Team {
  _id: OfficeId<"teams">;
  companyId?: OfficeId<"companies">;
  name: string;
  description: string;
  deskCount?: number;
  clusterPosition?: [number, number, number];
  services?: string[];
  wanderLockUntil?: number;
}

export interface Employee {
  _id: OfficeId<"employees">;
  companyId?: OfficeId<"companies">;
  teamId: OfficeId<"teams">;
  name: string;
  jobTitle?: string;
  status?: StatusType | string;
  statusMessage?: string;
  builtInRole?: string | null;
  isSupervisor?: boolean;
  isCEO?: boolean;
  gender?: string;
  profileImageUrl?: string;
  deskId?: OfficeId<"desks">;
}

export interface OfficeObject {
  _id: OfficeId<"officeObjects">;
  companyId?: OfficeId<"companies">;
  meshType: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number];
  metadata?: Record<string, unknown>;
}

export type CompanyData = {
  company: Company | null;
  teams: Team[];
  employees: Employee[];
  officeObjects?: OfficeObject[];
  desks?: Array<{ _id: OfficeId<"desks">; teamId: OfficeId<"teams">; deskIndex: number }>;
};

export interface EmployeeData extends Employee {
  initialPosition: [number, number, number];
  isBusy: boolean;
  deskId?: OfficeId<"desks">;
  team: string;
  wantsToWander?: boolean;
  status?: StatusType;
  statusMessage?: string;
  hasActiveComputerSession?: boolean;
  notificationCount?: number;
  notificationPriority?: number;
}

export interface TeamData extends Team {
  employees: OfficeId<"employees">[];
}

export type DeskLayoutData = {
  id: string;
  deskIndex: number;
  team: string;
};
