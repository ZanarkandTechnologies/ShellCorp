import { describe, expect, it } from "vitest";
import {
  computeBusinessReadinessIssues,
  createBusinessBuilderDraft,
  projectToBusinessBuilderDraft,
  toProjectResources,
} from "./business-builder";
import type { ProjectModel } from "./openclaw-types";

describe("business builder helpers", () => {
  it("creates affiliate preset with required slots/resources", () => {
    const draft = createBusinessBuilderDraft("affiliate_marketing");
    expect(draft.capabilitySkills.measure).toBeTruthy();
    expect(draft.capabilitySkills.execute).toBeTruthy();
    expect(draft.capabilitySkills.distribute).toBeTruthy();
    expect(draft.resources.some((entry) => entry.type === "cash_budget")).toBe(true);
    expect(draft.resources.some((entry) => entry.type === "api_quota")).toBe(true);
    expect(draft.resources.some((entry) => entry.type === "distribution_slots")).toBe(true);
  });

  it("maps project to draft and reports readiness issues", () => {
    const project: ProjectModel = {
      id: "proj-test",
      departmentId: "dept-products",
      name: "Test Project",
      githubUrl: "",
      status: "active",
      goal: "Goal",
      kpis: [],
      businessConfig: {
        type: "custom",
        slots: {
          measure: { skillId: "", category: "measure", config: {} },
          execute: { skillId: "", category: "execute", config: {} },
          distribute: { skillId: "", category: "distribute", config: {} },
        },
      },
      ledger: [],
      experiments: [],
      metricEvents: [],
      resources: [],
      resourceEvents: [],
    };
    const draft = projectToBusinessBuilderDraft(project);
    const issues = computeBusinessReadinessIssues(draft);
    expect(issues.some((entry) => entry.code === "missing_measure")).toBe(true);
    expect(issues.some((entry) => entry.code === "missing_execute")).toBe(true);
    expect(issues.some((entry) => entry.code === "missing_distribute")).toBe(true);
  });

  it("converts resource drafts into project resources", () => {
    const draft = createBusinessBuilderDraft("affiliate_marketing");
    const resources = toProjectResources("proj-1", draft.resources);
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.every((entry) => entry.projectId === "proj-1")).toBe(true);
    expect(resources.every((entry) => entry.policy.advisoryOnly === true)).toBe(true);
  });
});
