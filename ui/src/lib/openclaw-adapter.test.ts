import { describe, expect, it } from "vitest";

import {
  deriveAgentLiveStatus,
  hashSchemaVersion,
  parseHeartbeatWindows,
  resolveCanonicalWriteProvider,
  toFederationPolicy,
  toProviderIndexProfile,
  toTask,
} from "./openclaw-adapter";

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
