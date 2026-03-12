import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenClawAdapter,
  deriveAgentLiveStatus,
  hashSchemaVersion,
  parseHeartbeatWindows,
  resolveCanonicalWriteProvider,
  toProjectArtefactIndex,
  toFederationPolicy,
  toProviderIndexProfile,
  toTask,
} from "./openclaw-adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openclaw federation normalization", () => {
  it("normalizes federated task defaults", () => {
    const task = toTask({
      id: "task-1",
      projectId: "proj-1",
      title: "Wire Notion sync",
      status: "doing",
      priority: "critical",
    });
    expect(task).not.toBeNull();
    expect(task?.provider).toBe("internal");
    expect(task?.canonicalProvider).toBe("internal");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe("medium");
    expect(task?.syncState).toBe("healthy");
  });

  it("accepts artifact path aliases on tasks", () => {
    const task = toTask({
      id: "task-2",
      projectId: "proj-1",
      title: "Review generated script",
      status: "todo",
      priority: "medium",
      artifactPath: "projects/proj-1/briefs/brief-01.md",
    });
    expect(task?.artefactPath).toBe("projects/proj-1/briefs/brief-01.md");
  });

  it("normalizes federation policy defaults", () => {
    const policy = toFederationPolicy({
      projectId: "proj-1",
      canonicalProvider: "notion",
      mirrors: ["internal", "bad"],
      writeBackEnabled: true,
      conflictPolicy: "newest_wins",
    });
    expect(policy).toEqual({
      projectId: "proj-1",
      canonicalProvider: "notion",
      mirrors: ["internal"],
      writeBackEnabled: true,
      conflictPolicy: "newest_wins",
    });
  });

  it("generates deterministic schema version hashes", () => {
    const a = hashSchemaVersion("same-payload");
    const b = hashSchemaVersion("same-payload");
    const c = hashSchemaVersion("different-payload");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("maps provider profile payload into deterministic profile", () => {
    const profile = toProviderIndexProfile({
      projectId: "proj-2",
      provider: "notion",
      entityId: "db-123",
      entityName: "Tasks",
      fieldMappings: [
        { name: "Name", type: "title" },
        { name: "Status", type: "status", options: ["To Do", "Done"] },
      ],
    });
    expect(profile).not.toBeNull();
    expect(profile?.profileId).toBe("proj-2:notion:db-123");
    expect(profile?.schemaVersion.startsWith("schema-")).toBe(true);
  });

  it("resolves canonical write provider with fallback", () => {
    expect(resolveCanonicalWriteProvider(null, "internal")).toBe("internal");
    expect(
      resolveCanonicalWriteProvider(
        {
          projectId: "proj-3",
          canonicalProvider: "notion",
          mirrors: [],
          writeBackEnabled: false,
          conflictPolicy: "canonical_wins",
        },
        "internal",
      ),
    ).toBe("notion");
  });
});

describe("project artefact indexing", () => {
  it("sorts files newest-first across agent groups", () => {
    const index = toProjectArtefactIndex("proj-1", [
      {
        projectId: "proj-1",
        agentId: "agent-a",
        workspace: "/tmp/a",
        files: [
          {
            projectId: "proj-1",
            agentId: "agent-a",
            workspace: "/tmp/a",
            name: "old.txt",
            path: "/tmp/a/old.txt",
            missing: false,
            updatedAtMs: 10,
          },
        ],
      },
      {
        projectId: "proj-1",
        agentId: "agent-b",
        workspace: "/tmp/b",
        files: [
          {
            projectId: "proj-1",
            agentId: "agent-b",
            workspace: "/tmp/b",
            name: "new.txt",
            path: "/tmp/b/new.txt",
            missing: false,
            updatedAtMs: 100,
          },
        ],
      },
    ]);
    expect(index.files.map((entry) => entry.name)).toEqual(["new.txt", "old.txt"]);
  });
});

describe("heartbeat parsing", () => {
  it("groups heartbeat windows and ignores mixed operator messages", () => {
    const windows = parseHeartbeatWindows(
      [
        {
          ts: 1000,
          type: "message",
          role: "user",
          text: "Read HEARTBEAT.md if it exists. Current time: Wednesday",
        },
        {
          ts: 1200,
          type: "message",
          role: "assistant",
          text: "Planning next actions with ReadFile and Shell",
        },
        {
          ts: 1300,
          type: "message",
          role: "user",
          source: "operator",
          text: "quick direct CLI message",
        },
        {
          ts: 1400,
          type: "message",
          role: "assistant",
          text: "HEARTBEAT_OK",
        },
      ],
      "agent:main:main",
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].status).toBe("ok");
    expect(windows[0].eventCount).toBe(4);
    expect(windows[0].skillBubbles.length).toBeGreaterThan(0);
  });

  it("keeps open heartbeat as running and derives live status", () => {
    const windows = parseHeartbeatWindows(
      [
        {
          ts: 2000,
          type: "message",
          role: "user",
          text: "Read HEARTBEAT.md if it exists. Current time: Wednesday",
        },
        {
          ts: 2100,
          type: "tool",
          role: "tool",
          text: "ReadFile ok",
        },
      ],
      "agent:main:main",
    );
    const status = deriveAgentLiveStatus("main", "agent:main:main", windows);
    expect(status.state).toBe("running");
    expect(status.sessionKey).toBe("agent:main:main");
  });

  it("marks heartbeat as no_work when only prompt and HEARTBEAT_OK exist", () => {
    const windows = parseHeartbeatWindows(
      [
        {
          ts: 3000,
          type: "message",
          role: "user",
          text: "Read HEARTBEAT.md if it exists. Current time: Wednesday",
        },
        {
          ts: 3200,
          type: "message",
          role: "assistant",
          text: "HEARTBEAT_OK",
        },
      ],
      "agent:main:main",
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].status).toBe("no_work");
  });
});

describe("team business skill sync adapter", () => {
  it("normalizes successful sync payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        teamId: "team-proj-buffalos-ai",
        projectId: "proj-buffalos-ai",
        mode: "replace_minimum",
        dryRun: false,
        touchedAgents: ["buffalos-ai-pm", "buffalos-ai-executor"],
        missingAgents: [],
        preview: [
          {
            agentId: "buffalos-ai-pm",
            role: "biz_pm",
            mode: "replace_minimum",
            beforeSkills: [],
            afterSkills: ["shellcorp-team-cli", "video-generator"],
          },
        ],
      }),
    } as Response);
    const adapter = new OpenClawAdapter("http://127.0.0.1:8787", "http://127.0.0.1:8787");
    const result = await adapter.syncTeamBusinessSkillsToAgents({
      teamId: "team-proj-buffalos-ai",
      mode: "replace_minimum",
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.touchedAgents).toEqual(["buffalos-ai-pm", "buffalos-ai-executor"]);
    expect(result.preview[0]?.agentId).toBe("buffalos-ai-pm");
    expect(result.preview[0]?.afterSkills).toEqual(expect.arrayContaining(["video-generator"]));
  });

  it("returns typed error shape when endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, error: "team_business_skill_sync_unavailable" }),
    } as Response);
    const adapter = new OpenClawAdapter("http://127.0.0.1:8787", "http://127.0.0.1:8787");
    const result = await adapter.syncTeamBusinessSkillsToAgents({
      teamId: "team-proj-buffalos-ai",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("team_business_skill_sync_unavailable");
    expect(result.touchedAgents).toEqual([]);
  });
});

describe("office object mutations", () => {
  it("uses a provided office object snapshot for upserts", async () => {
    const adapter = new OpenClawAdapter("http://127.0.0.1:8787", "http://127.0.0.1:8787");
    const getOfficeObjectsSpy = vi.spyOn(adapter, "getOfficeObjects");
    const saveOfficeObjectsSpy = vi.spyOn(adapter, "saveOfficeObjects").mockResolvedValue({
      ok: true,
      objects: [],
    });

    await adapter.upsertOfficeObject(
      {
        id: "office-chair-1",
        identifier: "office-chair-1",
        meshType: "custom-mesh",
        position: [4, 0, 2],
        rotation: [0, 0, 0],
        metadata: {},
      },
      {
        currentObjects: [
          {
            id: "office-chair-1",
            identifier: "office-chair-1",
            meshType: "custom-mesh",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            metadata: {},
          },
        ],
      },
    );

    expect(getOfficeObjectsSpy).not.toHaveBeenCalled();
    expect(saveOfficeObjectsSpy).toHaveBeenCalledWith([
      {
        id: "office-chair-1",
        identifier: "office-chair-1",
        meshType: "custom-mesh",
        position: [4, 0, 2],
        rotation: [0, 0, 0],
        metadata: {},
      },
    ]);
  });

  it("uses a provided office object snapshot for deletes", async () => {
    const adapter = new OpenClawAdapter("http://127.0.0.1:8787", "http://127.0.0.1:8787");
    const getOfficeObjectsSpy = vi.spyOn(adapter, "getOfficeObjects");
    const saveOfficeObjectsSpy = vi.spyOn(adapter, "saveOfficeObjects").mockResolvedValue({
      ok: true,
      objects: [],
    });

    await adapter.deleteOfficeObject("office-chair-1", {
      currentObjects: [
        {
          id: "office-chair-1",
          identifier: "office-chair-1",
          meshType: "custom-mesh",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          metadata: {},
        },
      ],
    });

    expect(getOfficeObjectsSpy).not.toHaveBeenCalled();
    expect(saveOfficeObjectsSpy).toHaveBeenCalledWith([]);
  });
});

describe("agent files fallback", () => {
  it("falls back to state bridge when gateway file list is shallow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        agentId: "buffalos-ai-executor",
        workspace: "/tmp/workspace-buffalos-ai-executor",
        files: [
          {
            name: "projects/proj-buffalos-ai-v2/affiliate/videos/lamp-v1.mp4",
            path: "projects/proj-buffalos-ai-v2/affiliate/videos/lamp-v1.mp4",
            missing: false,
          },
        ],
      }),
    } as Response);
    const wsClient = {
      connected: true,
      request: vi.fn(async () => ({
        ok: true,
        agentId: "buffalos-ai-executor",
        workspace: "/tmp/workspace-buffalos-ai-executor",
        files: [{ name: "HEARTBEAT.md", path: "HEARTBEAT.md", missing: false }],
      })),
    };
    const adapter = new OpenClawAdapter(
      "http://127.0.0.1:8787",
      "http://127.0.0.1:8787",
      wsClient as never,
    );
    const result = await adapter.listAgentFiles("buffalos-ai-executor");
    expect(wsClient.request).toHaveBeenCalledWith("agents.files.list", {
      agentId: "buffalos-ai-executor",
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(result.files.some((entry) => entry.path.includes("projects/proj-buffalos-ai-v2"))).toBe(
      true,
    );
  });
});
