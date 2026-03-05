import { describe, expect, it } from "vitest";
import type { ProjectArtefactEntry } from "../../../lib/openclaw-types";
import {
  buildExplorerTree,
  createFileKey,
  deriveProjectScopeRoots,
  findFileByPath,
  isHeartbeatArtefact,
  isProjectScopedArtefact,
} from "./project-artefact-utils";

const SAMPLE_FILES: ProjectArtefactEntry[] = [
  {
    projectId: "proj-1",
    agentId: "agent-a",
    workspace: "/tmp/a",
    name: "brief.md",
    path: "/tmp/a/projects/proj-1/brief.md",
    missing: false,
  },
  {
    projectId: "proj-1",
    agentId: "agent-b",
    workspace: "/tmp/b",
    name: "video.mp4",
    path: "/tmp/b/projects/proj-1/video.mp4",
    missing: false,
  },
];

describe("project artefact panel helpers", () => {
  it("creates stable file keys from agent and file name", () => {
    expect(createFileKey({ agentId: "agent-a", name: "brief.md" })).toBe("agent-a::brief.md");
  });

  it("matches artefacts by exact path or suffix", () => {
    expect(findFileByPath(SAMPLE_FILES, "/tmp/a/projects/proj-1/brief.md")?.name).toBe("brief.md");
    expect(findFileByPath(SAMPLE_FILES, "projects/proj-1/video.mp4")?.name).toBe("video.mp4");
    expect(findFileByPath(SAMPLE_FILES, "missing.txt")).toBeNull();
  });

  it("detects heartbeat artefacts for default filtering", () => {
    expect(
      isHeartbeatArtefact({
        ...SAMPLE_FILES[0],
        name: "heartbeat.md",
        path: "/tmp/a/workspace/heartbeat.md",
      }),
    ).toBe(true);
    expect(isHeartbeatArtefact(SAMPLE_FILES[0])).toBe(false);
  });

  it("builds explorer tree with agent workspace roots", () => {
    const roots = buildExplorerTree(SAMPLE_FILES);
    expect(roots.length).toBe(2);
    expect(roots[0].key).toContain("agent-a::");
    expect(roots[1].key).toContain("agent-b::");
  });

  it("derives project scope roots from defaults and hints", () => {
    const roots = deriveProjectScopeRoots("proj-1", ["projects/proj-1/output/video.mp4"], "/data/projects/proj-1");
    expect(roots.some((entry) => entry.includes("projects/proj-1/"))).toBe(true);
    expect(roots.some((entry) => entry.includes("output/"))).toBe(true);
  });

  it("filters out non-project operational files", () => {
    const roots = deriveProjectScopeRoots("proj-1", ["projects/proj-1/brief.md"]);
    const projectFile: ProjectArtefactEntry = {
      ...SAMPLE_FILES[0],
      path: "/tmp/a/projects/proj-1/brief.md",
      name: "brief.md",
    };
    const heartbeatFile: ProjectArtefactEntry = {
      ...SAMPLE_FILES[0],
      path: "/tmp/a/heartbeat.md",
      name: "heartbeat.md",
    };
    expect(isProjectScopedArtefact(projectFile, "proj-1", roots)).toBe(true);
    expect(isProjectScopedArtefact(heartbeatFile, "proj-1", roots)).toBe(false);
  });
});
