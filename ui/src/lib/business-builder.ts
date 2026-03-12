import type {
  ProjectModel,
  ProjectResourceModel,
  ResourceLowBehavior,
  ResourceType,
} from "./openclaw-types";

export type BusinessTypeOption =
  | "none"
  | "affiliate_marketing"
  | "content_creator"
  | "saas"
  | "custom";

export interface BusinessBuilderResourceDraft {
  id?: string;
  type: ResourceType;
  name: string;
  unit: string;
  remaining: number;
  limit: number;
  reserved?: number;
  trackerSkillId: string;
  refreshCadenceMinutes?: number;
  softLimit?: number;
  hardLimit?: number;
  whenLow: ResourceLowBehavior;
  metadata?: Record<string, string>;
}

export interface BusinessBuilderDraft {
  businessType: BusinessTypeOption;
  capabilitySkills: {
    measure: string;
    execute: string;
    distribute: string;
  };
  resources: BusinessBuilderResourceDraft[];
}

export interface BusinessReadinessIssue {
  code: string;
  message: string;
}

function defaultResourceDrafts(): BusinessBuilderResourceDraft[] {
  return [
    {
      type: "cash_budget",
      name: "Cash Budget",
      unit: "usd_cents",
      remaining: 5000,
      limit: 5000,
      reserved: 0,
      trackerSkillId: "resource-cash-tracker",
      refreshCadenceMinutes: 15,
      softLimit: 1500,
      hardLimit: 0,
      whenLow: "deprioritize_expensive_tasks",
      metadata: { currency: "USD" },
    },
    {
      type: "api_quota",
      name: "API Quota",
      unit: "requests",
      remaining: 1000,
      limit: 1000,
      reserved: 0,
      trackerSkillId: "resource-api-quota-tracker",
      refreshCadenceMinutes: 15,
      softLimit: 200,
      hardLimit: 0,
      whenLow: "warn",
    },
    {
      type: "distribution_slots",
      name: "Distribution Slots",
      unit: "posts_per_day",
      remaining: 10,
      limit: 10,
      reserved: 0,
      trackerSkillId: "resource-distribution-tracker",
      refreshCadenceMinutes: 60,
      softLimit: 2,
      hardLimit: 0,
      whenLow: "ask_pm_review",
      metadata: { platform: "tiktok" },
    },
  ];
}

export function createBusinessBuilderDraft(type: BusinessTypeOption): BusinessBuilderDraft {
  if (type === "none") {
    return {
      businessType: "none",
      capabilitySkills: { measure: "", execute: "", distribute: "" },
      resources: [],
    };
  }
  return {
    businessType: type,
    capabilitySkills: { measure: "", execute: "", distribute: "" },
    resources: defaultResourceDrafts(),
  };
}

export function projectToBusinessBuilderDraft(
  project: ProjectModel | null | undefined,
): BusinessBuilderDraft {
  if (!project?.businessConfig) return createBusinessBuilderDraft("none");
  const businessType = (project.businessConfig.type as BusinessTypeOption) || "custom";
  return {
    businessType:
      businessType === "affiliate_marketing" ||
      businessType === "content_creator" ||
      businessType === "saas" ||
      businessType === "custom"
        ? businessType
        : "custom",
    capabilitySkills: {
      measure: project.businessConfig.slots.measure.skillId,
      execute: project.businessConfig.slots.execute.skillId,
      distribute: project.businessConfig.slots.distribute.skillId,
    },
    resources: (project.resources ?? []).map((resource) => ({
      id: resource.id,
      type: resource.type,
      name: resource.name,
      unit: resource.unit,
      remaining: resource.remaining,
      limit: resource.limit,
      reserved: resource.reserved,
      trackerSkillId: resource.trackerSkillId,
      refreshCadenceMinutes: resource.refreshCadenceMinutes,
      softLimit: resource.policy.softLimit,
      hardLimit: resource.policy.hardLimit,
      whenLow: resource.policy.whenLow,
      metadata: resource.metadata,
    })),
  };
}

export function toProjectResources(
  projectId: string,
  resources: BusinessBuilderResourceDraft[],
): ProjectResourceModel[] {
  return resources.map((resource) => ({
    id:
      resource.id ??
      (resource.type === "cash_budget"
        ? `${projectId}:cash`
        : resource.type === "api_quota"
          ? `${projectId}:api`
          : resource.type === "distribution_slots"
            ? `${projectId}:distribution`
            : `${projectId}:custom-${Math.random().toString(36).slice(2, 8)}`),
    projectId,
    type: resource.type,
    name: resource.name,
    unit: resource.unit,
    remaining: resource.remaining,
    limit: resource.limit,
    ...(typeof resource.reserved === "number" ? { reserved: resource.reserved } : {}),
    trackerSkillId: resource.trackerSkillId,
    ...(typeof resource.refreshCadenceMinutes === "number"
      ? { refreshCadenceMinutes: resource.refreshCadenceMinutes }
      : {}),
    policy: {
      advisoryOnly: true,
      ...(typeof resource.softLimit === "number" ? { softLimit: resource.softLimit } : {}),
      ...(typeof resource.hardLimit === "number" ? { hardLimit: resource.hardLimit } : {}),
      whenLow: resource.whenLow,
    },
    ...(resource.metadata ? { metadata: resource.metadata } : {}),
  }));
}

export function computeBusinessReadinessIssues(
  draft: BusinessBuilderDraft,
): BusinessReadinessIssue[] {
  const issues: BusinessReadinessIssue[] = [];
  if (!draft.capabilitySkills.measure.trim())
    issues.push({ code: "missing_measure", message: "Measure skill is missing." });
  if (!draft.capabilitySkills.execute.trim())
    issues.push({ code: "missing_execute", message: "Execute skill is missing." });
  if (!draft.capabilitySkills.distribute.trim())
    issues.push({ code: "missing_distribute", message: "Distribute skill is missing." });
  const requiredTypes: ResourceType[] = ["cash_budget", "api_quota", "distribution_slots"];
  for (const resourceType of requiredTypes) {
    if (!draft.resources.some((resource) => resource.type === resourceType)) {
      issues.push({
        code: `missing_${resourceType}`,
        message: `Missing ${resourceType} resource.`,
      });
    }
  }
  for (const resource of draft.resources) {
    if (resource.limit < 0)
      issues.push({
        code: `invalid_limit_${resource.type}`,
        message: `${resource.name} has negative limit.`,
      });
    if (resource.remaining > resource.limit) {
      issues.push({
        code: `remaining_over_limit_${resource.type}`,
        message: `${resource.name} remaining exceeds limit.`,
      });
    }
  }
  return issues;
}
