/**
 * SKILLS PANEL DATA
 * =================
 * Pure selectors and view-shaping helpers for deriving Skills panel state.
 *
 * KEY CONCEPTS:
 * - Sidebar grouping and agent-known skill IDs are computed outside the React container.
 * - Render components receive already-shaped view data instead of rebuilding it inline.
 *
 * USAGE:
 * - Imported by `skills-panel.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0205
 */

import type {
  AgentSkillsInventory,
  GlobalSkillsInventory,
  SkillDemoRunResult,
  SkillManifest,
  SkillStatusReport,
  SkillStudioCatalogEntry,
  SkillStudioDetail,
} from "@/lib/openclaw-types";
import type { GlobalSkillRow } from "./skills-panel.runtime";
import type {
  GroupedInheritedRuntimeSkills,
  InheritedRuntimeSkillEntry,
} from "./skills-panel-types";

export function joinLines(lines: string[]): string {
  return lines.join("\n");
}

export function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function classifyRuntimeSourceLabel(source: string | undefined): string {
  const normalized = (source ?? "").trim().toLowerCase();
  if (normalized.includes("bundled")) return "OpenClaw Bundled";
  if (normalized.includes("managed")) return "OpenClaw Managed";
  if (normalized.includes("shared")) return "Shared Skills";
  if (normalized.includes("workspace")) return "Workspace Skills";
  return "Runtime Skills";
}

export function groupInheritedRuntimeSkills(
  entries: InheritedRuntimeSkillEntry[],
): GroupedInheritedRuntimeSkills {
  const groups = new Map<string, InheritedRuntimeSkillEntry[]>();
  for (const entry of entries) {
    const label = classifyRuntimeSourceLabel(entry.source);
    const existing = groups.get(label) ?? [];
    existing.push(entry);
    groups.set(label, existing);
  }
  return [...groups.entries()];
}

export function buildKnownAgentSkillIds(input: {
  skills: SkillStudioCatalogEntry[];
  workspaceSkills: AgentSkillsInventory["workspaceSkills"];
  inheritedRuntimeSkills: InheritedRuntimeSkillEntry[];
  selectedDetail: SkillStudioDetail | null;
}): string[] {
  const ids = new Set<string>();
  for (const entry of input.skills) ids.add(entry.skillId);
  for (const entry of input.workspaceSkills) ids.add(entry.skillId);
  for (const entry of input.inheritedRuntimeSkills) ids.add(entry.skillKey || entry.name);
  if (input.selectedDetail?.skillId) ids.add(input.selectedDetail.skillId);
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export function findRuntimeStatusForDetail(
  report: SkillStatusReport | null,
  detail: SkillStudioDetail | null,
): SkillStatusReport["skills"][number] | null {
  if (!report || !detail) return null;
  return (
    report.skills.find(
      (entry) => entry.name === detail.skillId || entry.skillKey === detail.skillId,
    ) ?? null
  );
}

export function buildVisibleGlobalSkillRows(
  rows: GlobalSkillRow[],
  sharedSkills: NonNullable<GlobalSkillsInventory["sharedSkills"]>,
  runtimeSearch: string,
): GlobalSkillRow[] {
  const sharedIds = new Set(sharedSkills.map((entry) => entry.skillId));
  return rows.filter((row) => {
    if (!sharedIds.has(row.skillKey) && row.envCount === 0 && row.configCount === 0) return false;
    if (!runtimeSearch) return true;
    return row.skillKey.toLowerCase().includes(runtimeSearch);
  });
}

export function getDemoStepKey(
  caseId: string,
  run: SkillDemoRunResult["steps"][number],
  index: number,
): string {
  return [
    caseId,
    index + 1,
    run.run.join(" "),
    run.stdout,
    run.stderr,
    run.failures.join("|"),
  ].join("::");
}

export function mergeRuntimeStatus(
  skills: SkillStudioCatalogEntry[],
  report: SkillStatusReport | null,
): SkillStudioCatalogEntry[] {
  if (!report) return skills;
  return skills.map((entry) => {
    const runtimeStatus = report.skills.find(
      (row) => row.name === entry.skillId || row.skillKey === entry.skillId,
    );
    return runtimeStatus
      ? {
          ...entry,
          runtimeStatus: {
            eligible: runtimeStatus.eligible,
            blockedByAllowlist: runtimeStatus.blockedByAllowlist,
            disabled: runtimeStatus.disabled,
            source: runtimeStatus.source,
          },
        }
      : entry;
  });
}

export function toManifestDraft(detail: SkillStudioDetail): SkillManifest {
  return JSON.parse(JSON.stringify(detail.manifest)) as SkillManifest;
}

export function buildMermaidDocument(diagram: string): string {
  const escapedDiagram = JSON.stringify(diagram);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
        background: #05070b;
        color: #e5e7eb;
        font-family: "JetBrains Mono", ui-monospace, monospace;
      }
      #root {
        min-height: calc(100vh - 48px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        overflow: auto;
      }
      #root svg {
        max-width: 100%;
        height: auto;
      }
      #root .label {
        color: #e5e7eb !important;
      }
      pre {
        white-space: pre-wrap;
        margin: 0;
        padding: 16px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      const source = ${escapedDiagram};
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: {
          background: "#05070b",
          primaryColor: "#111827",
          primaryTextColor: "#f3f4f6",
          primaryBorderColor: "#334155",
          lineColor: "#94a3b8",
          secondaryColor: "#111827",
          tertiaryColor: "#0f172a",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
        },
      });
      const root = document.getElementById("root");
      mermaid
        .render("skill-studio-diagram", source)
        .then(({ svg }) => {
          if (root) root.innerHTML = svg;
        })
        .catch((error) => {
          if (root) root.innerHTML = "<pre>" + String(error) + "</pre>";
        });
    </script>
  </body>
</html>`;
}

function buildEmptySkillManifest(displayName: string, description: string): SkillManifest {
  return {
    interface: {
      displayName,
      shortDescription: description,
    },
    policy: {
      allowImplicitInvocation: false,
    },
    dependencies: {
      tools: [],
      skills: [],
      docs: [],
    },
    state: {
      mode: "stateless",
    },
    paths: {
      read: [],
      write: [],
    },
    visualization: {},
    references: [],
    demos: {
      labels: {},
    },
  };
}

export function buildRuntimeOnlySkillDetail(input: {
  skillId: string;
  catalogEntry?: SkillStudioCatalogEntry | null;
  runtimeStatus?: SkillStatusReport["skills"][number] | null;
  sharedEntry?: NonNullable<GlobalSkillsInventory["sharedSkills"]>[number] | null;
  focusAgentId?: string | null;
}): SkillStudioDetail {
  const displayName =
    input.catalogEntry?.displayName ||
    input.runtimeStatus?.skillKey ||
    input.runtimeStatus?.name ||
    input.skillId;
  const description =
    input.catalogEntry?.description || input.runtimeStatus?.description || "Runtime skill";
  const sourcePath =
    input.runtimeStatus?.filePath ||
    input.sharedEntry?.sourcePath ||
    input.catalogEntry?.sourcePath ||
    "";
  return {
    skillId: input.skillId,
    packageKey: input.catalogEntry?.packageKey || input.skillId,
    displayName,
    description,
    category: input.catalogEntry?.category || "runtime",
    scope: input.focusAgentId ? "agent" : "shared",
    sourcePath,
    updatedAt: input.catalogEntry?.updatedAt,
    manifest: buildEmptySkillManifest(displayName, description),
    manifestPath: "",
    hasManifest: false,
    overviewMarkdown: description,
    mermaid: undefined,
    relatedSkills: [],
    fileEntries: [],
    demoCases: [],
    runtimeStatus: input.runtimeStatus ?? undefined,
    focusAgentId: input.focusAgentId ?? undefined,
  };
}
