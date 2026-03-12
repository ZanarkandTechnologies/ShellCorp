import type { ProjectArtefactEntry } from "../../../lib/openclaw-types";

export function createFileKey(file: Pick<ProjectArtefactEntry, "agentId" | "name">): string {
  return `${file.agentId}::${file.name}`;
}

export function findFileByPath(
  files: ProjectArtefactEntry[],
  targetPath: string,
): ProjectArtefactEntry | null {
  const normalizedPath = targetPath.trim();
  if (!normalizedPath) return null;
  const exact = files.find((file) => file.path === normalizedPath);
  if (exact) return exact;
  const suffix = files.find((file) => file.path.endsWith(normalizedPath));
  return suffix ?? null;
}

export type ArtefactFileKind =
  | "markdown"
  | "image"
  | "video"
  | "code"
  | "json"
  | "text"
  | "unknown";

export interface ExplorerFolderNode {
  key: string;
  name: string;
  parentKey: string | null;
  depth: number;
  files: ProjectArtefactEntry[];
  children: ExplorerFolderNode[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function toRelativePath(file: ProjectArtefactEntry): string {
  const normalizedPath = normalizePath(file.path);
  const normalizedWorkspace = normalizePath(file.workspace || "");
  if (normalizedWorkspace && normalizedPath.startsWith(normalizedWorkspace)) {
    return normalizedPath.slice(normalizedWorkspace.length).replace(/^\/+/, "");
  }
  return normalizedPath.replace(/^\/+/, "");
}

export function isHeartbeatArtefact(file: ProjectArtefactEntry): boolean {
  const lowerName = file.name.trim().toLowerCase();
  const lowerPath = file.path.trim().toLowerCase();
  return lowerName === "heartbeat.md" || lowerPath.endsWith("/heartbeat.md");
}

function isOperationalFile(file: ProjectArtefactEntry): boolean {
  const lowerName = file.name.trim().toLowerCase();
  const lowerPath = normalizePath(file.path).toLowerCase();
  if (
    lowerName === "heartbeat.md" ||
    lowerName === "memory.md" ||
    lowerName === "openclaw.json" ||
    lowerName === "company.json" ||
    lowerName === "office-objects.json" ||
    lowerName === "office-settings.json" ||
    lowerName === ".env" ||
    lowerName === ".env.local"
  ) {
    return true;
  }
  if (lowerPath.includes("/memory/")) return true;
  if (lowerPath.includes("/sessions/")) return true;
  return false;
}

function ensureTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function normalizeRootCandidate(path: string): string {
  return ensureTrailingSlash(
    normalizePath(path)
      .replace(/\/+/g, "/")
      .replace(/^\/+|\/+$/g, ""),
  );
}

function toParentDir(path: string): string {
  const normalized = normalizePath(path).replace(/\/+/g, "/").replace(/\/+$/g, "");
  const cut = normalized.lastIndexOf("/");
  if (cut <= 0) return normalized;
  return normalized.slice(0, cut);
}

export function deriveProjectScopeRoots(
  projectId: string,
  taskHintPaths: string[],
  trackingContext?: string,
): string[] {
  const roots = new Set<string>();
  const normalizedProjectId = projectId.trim().toLowerCase();
  if (!normalizedProjectId) return [];
  roots.add(normalizeRootCandidate(`projects/${normalizedProjectId}`));

  if (trackingContext && trackingContext.includes("/")) {
    roots.add(normalizeRootCandidate(trackingContext));
  }
  for (const hint of taskHintPaths) {
    const value = hint.trim();
    if (!value) continue;
    const parent = toParentDir(value);
    if (parent) roots.add(normalizeRootCandidate(parent));
  }
  return [...roots];
}

export function isProjectScopedArtefact(
  file: ProjectArtefactEntry,
  projectId: string,
  scopeRoots: string[],
): boolean {
  if (isOperationalFile(file)) return false;
  const normalizedProjectId = projectId.trim().toLowerCase();
  const normalizedPath = normalizePath(file.path).toLowerCase().replace(/^\/+/, "");
  for (const root of scopeRoots) {
    const normalizedRoot = normalizeRootCandidate(root).toLowerCase();
    if (normalizedPath.includes(normalizedRoot)) return true;
  }
  // Fallback: allow explicit project id segment when scope roots are incomplete.
  return (
    normalizedPath.includes(`/${normalizedProjectId}/`) ||
    normalizedPath.startsWith(`${normalizedProjectId}/`)
  );
}

export function inferArtefactFileKind(fileName: string): ArtefactFileKind {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  ) {
    return "image";
  }
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mkv")
  )
    return "video";
  if (
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".py")
  )
    return "code";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "text";
  return "unknown";
}

export function buildExplorerTree(files: ProjectArtefactEntry[]): ExplorerFolderNode[] {
  const nodeByKey = new Map<string, ExplorerFolderNode>();

  function ensureNode(
    key: string,
    name: string,
    parentKey: string | null,
    depth: number,
  ): ExplorerFolderNode {
    const existing = nodeByKey.get(key);
    if (existing) return existing;
    const created: ExplorerFolderNode = {
      key,
      name,
      parentKey,
      depth,
      files: [],
      children: [],
    };
    nodeByKey.set(key, created);
    return created;
  }

  for (const file of files) {
    const rootKey = `${file.agentId}::${file.workspace || "workspace"}`;
    const rootName = file.workspace
      ? `${file.agentId} · ${file.workspace}`
      : `${file.agentId} · workspace`;
    let parent = ensureNode(rootKey, rootName, null, 0);

    const relativePath = toRelativePath(file);
    const segments = relativePath.split("/").filter(Boolean);
    const folders = segments.slice(0, Math.max(segments.length - 1, 0));
    for (let index = 0; index < folders.length; index += 1) {
      const segment = folders[index];
      const key = `${parent.key}/${segment}`;
      const next = ensureNode(key, segment, parent.key, index + 1);
      parent = next;
    }
    parent.files.push(file);
  }

  for (const node of nodeByKey.values()) {
    if (!node.parentKey) continue;
    const parent = nodeByKey.get(node.parentKey);
    if (!parent) continue;
    if (!parent.children.some((child) => child.key === node.key)) {
      parent.children.push(node);
    }
  }

  const sortTree = (nodes: ExplorerFolderNode[]): void => {
    nodes.sort((left, right) => left.name.localeCompare(right.name));
    for (const node of nodes) {
      node.files.sort((left, right) => left.name.localeCompare(right.name));
      sortTree(node.children);
    }
  };

  const roots = [...nodeByKey.values()].filter((node) => node.parentKey === null);
  sortTree(roots);
  return roots;
}
