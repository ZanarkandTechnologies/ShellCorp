import type { OfficeSettingsModel } from "@/lib/openclaw-types";
import type { EmployeeData, OfficeObject } from "@/lib/types";

type OfficeDataStabilityShape = {
  company: { _id: string; name: string } | null;
  teams: Array<Record<string, unknown>>;
  employees: EmployeeData[];
  officeObjects: OfficeObject[];
  desks: Array<{ id: string; deskIndex: number; team: string }>;
  officeSettings: OfficeSettingsModel;
  companyModel: unknown;
  workload: unknown;
  warnings: unknown;
  isLoading: boolean;
};

function buildPositionSignature(position: [number, number, number] | undefined): string {
  if (!position) return "";
  return position.join(",");
}

function buildCompanySignature(company: OfficeDataStabilityShape["company"]): string {
  if (!company) return "";
  return `${company._id}|${company.name}`;
}

function buildTeamSignature(teams: OfficeDataStabilityShape["teams"]): string {
  return teams.map((team) => JSON.stringify(team)).join("||");
}

function buildDeskSignature(desks: OfficeDataStabilityShape["desks"]): string {
  return desks.map((desk) => `${desk.id}|${desk.deskIndex}|${desk.team}`).join("||");
}

function buildHeartbeatBubbleSignature(
  bubbles: Array<{ label: string; weight?: number }> | undefined,
): string {
  return (bubbles ?? []).map((bubble) => `${bubble.label}:${bubble.weight ?? ""}`).join(",");
}

export function buildEmployeeSignature(employees: EmployeeData[]): string {
  return employees
    .map((employee) =>
      [
        employee._id,
        employee.companyId ?? "",
        employee.name,
        employee.teamId,
        employee.builtInRole ?? "",
        employee.jobTitle ?? "",
        employee.team ?? "",
        buildPositionSignature(employee.initialPosition),
        employee.status ?? "",
        employee.statusMessage ?? "",
        employee.isBusy ? "1" : "0",
        employee.isCEO ? "1" : "0",
        employee.isSupervisor ? "1" : "0",
        employee.gender ?? "",
        employee.deskId ?? "",
        employee.wantsToWander ? "1" : "0",
        employee.notificationCount ?? 0,
        employee.notificationPriority ?? 0,
        employee.heartbeatState ?? "",
        employee.profileImageUrl ?? "",
        buildHeartbeatBubbleSignature(employee.heartbeatBubbles),
        employee.activityTargetSkillId ?? "",
        buildPositionSignature(employee.activityTargetPosition),
        buildPositionSignature(employee.activityTargetObjectPosition),
        employee.activityEffectVariant ?? "",
      ].join("|"),
    )
    .join("||");
}

export function buildOfficeObjectSignature(officeObjects: OfficeObject[]): string {
  return officeObjects
    .map((officeObject) =>
      [
        officeObject._id,
        officeObject.meshType,
        buildPositionSignature(officeObject.position),
        buildPositionSignature(officeObject.rotation),
        buildPositionSignature(officeObject.scale),
        typeof officeObject.metadata?.displayName === "string"
          ? officeObject.metadata.displayName
          : "",
        typeof officeObject.metadata?.teamId === "string" ? officeObject.metadata.teamId : "",
        typeof officeObject.metadata?.meshPublicPath === "string"
          ? officeObject.metadata.meshPublicPath
          : "",
        typeof officeObject.metadata?.uiBinding?.kind === "string"
          ? officeObject.metadata.uiBinding.kind
          : "",
        typeof officeObject.metadata?.uiBinding?.title === "string"
          ? officeObject.metadata.uiBinding.title
          : "",
        typeof officeObject.metadata?.uiBinding?.url === "string"
          ? officeObject.metadata.uiBinding.url
          : "",
        typeof officeObject.metadata?.uiBinding?.aspectRatio === "string"
          ? officeObject.metadata.uiBinding.aspectRatio
          : "",
        typeof officeObject.metadata?.uiBinding?.openMode === "string"
          ? officeObject.metadata.uiBinding.openMode
          : "",
        typeof officeObject.metadata?.skillBinding?.skillId === "string"
          ? officeObject.metadata.skillBinding.skillId
          : "",
        typeof officeObject.metadata?.skillBinding?.label === "string"
          ? officeObject.metadata.skillBinding.label
          : "",
      ].join("|"),
    )
    .join("||");
}

function buildOfficeSettingsSignature(settings: OfficeSettingsModel): string {
  return [
    settings.meshAssetDir,
    settings.officeFootprint.width,
    settings.officeFootprint.depth,
    settings.officeLayout.version,
    settings.officeLayout.tileSize,
    settings.officeLayout.tiles.join(","),
    settings.decor.floorPatternId,
    settings.decor.wallColorId,
    settings.decor.backgroundId,
    settings.viewProfile,
    settings.orbitControlsEnabled ? "1" : "0",
    settings.cameraOrientation,
  ].join("|");
}

export function stabilizeOfficeData<T extends OfficeDataStabilityShape>(current: T, next: T): T {
  const stabilizedCompany =
    buildCompanySignature(current.company) === buildCompanySignature(next.company)
      ? current.company
      : next.company;
  const stabilizedTeams =
    buildTeamSignature(current.teams) === buildTeamSignature(next.teams)
      ? current.teams
      : next.teams;
  const stabilizedEmployees =
    buildEmployeeSignature(current.employees) === buildEmployeeSignature(next.employees)
      ? current.employees
      : next.employees;
  const stabilizedOfficeObjects =
    buildOfficeObjectSignature(current.officeObjects) ===
    buildOfficeObjectSignature(next.officeObjects)
      ? current.officeObjects
      : next.officeObjects;
  const stabilizedDesks =
    buildDeskSignature(current.desks) === buildDeskSignature(next.desks)
      ? current.desks
      : next.desks;
  const stabilizedOfficeSettings =
    buildOfficeSettingsSignature(current.officeSettings) ===
    buildOfficeSettingsSignature(next.officeSettings)
      ? current.officeSettings
      : next.officeSettings;

  if (
    current.isLoading === next.isLoading &&
    current.company === stabilizedCompany &&
    current.teams === stabilizedTeams &&
    current.employees === stabilizedEmployees &&
    current.officeObjects === stabilizedOfficeObjects &&
    current.desks === stabilizedDesks &&
    current.officeSettings === stabilizedOfficeSettings &&
    current.companyModel === next.companyModel &&
    current.workload === next.workload &&
    current.warnings === next.warnings
  ) {
    return current;
  }

  return {
    ...next,
    company: stabilizedCompany,
    teams: stabilizedTeams,
    employees: stabilizedEmployees,
    officeObjects: stabilizedOfficeObjects,
    desks: stabilizedDesks,
    officeSettings: stabilizedOfficeSettings,
  };
}
