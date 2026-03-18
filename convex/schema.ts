import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentEvents: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    agentId: v.string(),
    eventType: v.string(),
    activityType: v.optional(v.string()),
    actorType: v.optional(v.string()),
    label: v.string(),
    detail: v.optional(v.string()),
    state: v.optional(v.string()),
    skillId: v.optional(v.string()),
    source: v.optional(v.string()),
    stepKey: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    beatId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_team_occurred_at", ["teamId", "occurredAt"])
    .index("by_team_agent_occurred_at", ["teamId", "agentId", "occurredAt"])
    .index("by_project_occurred_at", ["projectId", "occurredAt"])
    .index("by_project_agent_occurred_at", ["projectId", "agentId", "occurredAt"])
    .index("by_project_step_key", ["projectId", "stepKey"])
    .index("by_agent_step_key", ["agentId", "stepKey"])
    .index("by_occurred_at", ["occurredAt"]),

  agentStatus: defineTable({
    teamId: v.optional(v.string()),
    agentId: v.string(),
    state: v.string(),
    statusText: v.string(),
    bubbles: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        weight: v.number(),
      }),
    ),
    currentBeatId: v.optional(v.string()),
    currentSkillId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    updatedAt: v.number(),
    lastEventAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_team_agent", ["teamId", "agentId"])
    .index("by_updated_at", ["updatedAt"]),

  teamBoardTasks: defineTable({
    projectId: v.string(),
    taskId: v.string(),
    title: v.string(),
    status: v.string(),
    ownerAgentId: v.optional(v.string()),
    priority: v.string(),
    provider: v.string(),
    canonicalProvider: v.string(),
    providerUrl: v.optional(v.string()),
    syncState: v.string(),
    syncError: v.optional(v.string()),
    notes: v.optional(v.string()),
    taskType: v.optional(v.string()),
    approvalState: v.optional(v.string()),
    linkedSessionKey: v.optional(v.string()),
    createdTeamId: v.optional(v.string()),
    createdProjectId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_task_id", ["projectId", "taskId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_updated_at", ["projectId", "updatedAt"]),

  teamBoardEvents: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.string(),
    taskId: v.string(),
    eventType: v.string(),
    actorType: v.string(),
    actorAgentId: v.optional(v.string()),
    label: v.string(),
    detail: v.optional(v.string()),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    beatId: v.optional(v.string()),
    occurredAt: v.number(),
    stepKey: v.optional(v.string()),
  })
    .index("by_team_occurred_at", ["teamId", "occurredAt"])
    .index("by_project_occurred_at", ["projectId", "occurredAt"])
    .index("by_project_task_occurred_at", ["projectId", "taskId", "occurredAt"])
    .index("by_project_step_key", ["projectId", "stepKey"]),

  teamMemoryEntries: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.string(),
    taskId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    authorType: v.union(v.literal("agent"), v.literal("operator"), v.literal("system")),
    kind: v.union(
      v.literal("note"),
      v.literal("decision"),
      v.literal("handoff"),
      v.literal("result"),
      v.literal("risk"),
      v.literal("summary"),
    ),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_project_created_at", ["projectId", "createdAt"])
    .index("by_team_created_at", ["teamId", "createdAt"])
    .index("by_project_task_created_at", ["projectId", "taskId", "createdAt"]),

  projectArtefactIndex: defineTable({
    teamId: v.optional(v.string()),
    projectId: v.string(),
    agentId: v.string(),
    workspace: v.string(),
    path: v.string(),
    name: v.string(),
    kind: v.string(),
    sizeBytes: v.optional(v.number()),
    updatedAtMs: v.optional(v.number()),
    indexedAtMs: v.number(),
    lastSeenAtMs: v.number(),
    status: v.union(v.literal("present"), v.literal("missing")),
    isPreviewable: v.boolean(),
    taskId: v.optional(v.string()),
    truncated: v.optional(v.boolean()),
  })
    .index("by_project_indexed_at", ["projectId", "indexedAtMs"])
    .index("by_project_agent_path", ["projectId", "agentId", "path"])
    .index("by_project_status_indexed_at", ["projectId", "status", "indexedAtMs"]),
});
