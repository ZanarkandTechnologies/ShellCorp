/**
 * SKILL STUDIO HELPERS
 * ====================
 * Shared parsing and serialization helpers for file-based skill studio metadata.
 *
 * KEY CONCEPTS:
 * - `skill.config.yaml` is a small structured overlay on top of `SKILL.md`.
 * - Skills without metadata still load through derived defaults.
 * - Mermaid can live in metadata or in markdown and is surfaced uniformly.
 *
 * USAGE:
 * - Used by the Vite state bridge and Skill Studio UI helpers.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 */

import type {
  SkillManifest,
  SkillManifestDemos,
  SkillManifestDependencies,
  SkillManifestInterface,
  SkillManifestPaths,
  SkillManifestPolicy,
  SkillManifestState,
  SkillManifestToolDependency,
  SkillManifestVisualization,
  SkillStateMode,
} from "./openclaw-types";

type JsonLike = Record<string, unknown>;

type YamlNode = string | number | boolean | null | YamlNode[] | { [key: string]: YamlNode };

type ParsedFrontmatter = {
  name?: string;
  description?: string;
};

const MERMAID_BLOCK_PATTERN = /```mermaid\s*([\s\S]*?)```/i;

function trimQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseScalar(value: string): YamlNode {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed.replace(/'/g, '"')) as YamlNode;
    } catch {
      return trimQuotes(trimmed);
    }
  }
  return trimQuotes(trimmed);
}

function countIndent(line: string): number {
  let indent = 0;
  while (indent < line.length && line[indent] === " ") indent += 1;
  return indent;
}

function parseYamlBlock(lines: string[], startIndex: number, indent: number): [YamlNode, number] {
  const currentLine = lines[startIndex] ?? "";
  const trimmed = currentLine.trim();
  const isArray = trimmed.startsWith("- ");
  const container: YamlNode[] | Record<string, YamlNode> = isArray ? [] : {};
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      index += 1;
      continue;
    }
    const currentIndent = countIndent(rawLine);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      index += 1;
      continue;
    }
    const line = rawLine.slice(indent);

    if (isArray) {
      if (!line.startsWith("- ")) break;
      const itemText = line.slice(2).trim();
      if (!itemText) {
        const [child, nextIndex] = parseYamlBlock(lines, index + 1, indent + 2);
        (container as YamlNode[]).push(child);
        index = nextIndex;
        continue;
      }
      if (itemText.includes(":")) {
        const [key, ...rest] = itemText.split(":");
        const valueText = rest.join(":").trim();
        const item: Record<string, YamlNode> = {};
        if (valueText === "|" || valueText === ">") {
          const [blockValue, nextIndex] = parseMultilineScalar(lines, index + 1, indent + 4);
          item[key.trim()] = blockValue;
          index = nextIndex;
        } else if (valueText) {
          item[key.trim()] = parseScalar(valueText);
          index += 1;
        } else {
          const [child, nextIndex] = parseYamlBlock(lines, index + 1, indent + 4);
          item[key.trim()] = child;
          index = nextIndex;
        }
        while (index < lines.length) {
          const siblingLine = lines[index] ?? "";
          if (!siblingLine.trim() || siblingLine.trim().startsWith("#")) {
            index += 1;
            continue;
          }
          const siblingIndent = countIndent(siblingLine);
          if (siblingIndent < indent + 2) break;
          if (siblingIndent > indent + 2) {
            index += 1;
            continue;
          }
          const siblingText = siblingLine.slice(indent + 2);
          if (siblingText.startsWith("- ")) break;
          const [siblingKey, ...siblingRest] = siblingText.split(":");
          const siblingValueText = siblingRest.join(":").trim();
          if (siblingValueText === "|" || siblingValueText === ">") {
            const [blockValue, nextIndex] = parseMultilineScalar(lines, index + 1, indent + 4);
            item[siblingKey.trim()] = blockValue;
            index = nextIndex;
          } else if (siblingValueText) {
            item[siblingKey.trim()] = parseScalar(siblingValueText);
            index += 1;
          } else {
            const [child, nextIndex] = parseYamlBlock(lines, index + 1, indent + 4);
            item[siblingKey.trim()] = child;
            index = nextIndex;
          }
        }
        (container as YamlNode[]).push(item);
        continue;
      }
      (container as YamlNode[]).push(parseScalar(itemText));
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) break;
    const [key, ...rest] = line.split(":");
    const valueText = rest.join(":").trim();
    if (valueText === "|" || valueText === ">") {
      const [blockValue, nextIndex] = parseMultilineScalar(lines, index + 1, indent + 2);
      (container as Record<string, YamlNode>)[key.trim()] = blockValue;
      index = nextIndex;
      continue;
    }
    if (valueText) {
      (container as Record<string, YamlNode>)[key.trim()] = parseScalar(valueText);
      index += 1;
      continue;
    }
    const [child, nextIndex] = parseYamlBlock(lines, index + 1, indent + 2);
    (container as Record<string, YamlNode>)[key.trim()] = child;
    index = nextIndex;
  }

  return [container, index];
}

function parseMultilineScalar(
  lines: string[],
  startIndex: number,
  indent: number,
): [string, number] {
  const chunks: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    if (!rawLine.trim()) {
      chunks.push("");
      index += 1;
      continue;
    }
    const currentIndent = countIndent(rawLine);
    if (currentIndent < indent) break;
    chunks.push(rawLine.slice(indent));
    index += 1;
  }
  return [chunks.join("\n").replace(/\n+$/g, ""), index];
}

export function parseSimpleYaml(text: string): JsonLike {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const [parsed] = parseYamlBlock(lines, 0, 0);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonLike) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function asRecord(value: unknown): JsonLike {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonLike) : {};
}

function normalizeInterface(
  value: unknown,
  defaults: ParsedFrontmatter,
  fallbackDisplayName: string,
): SkillManifestInterface {
  const row = asRecord(value);
  return {
    displayName:
      typeof row.display_name === "string" && row.display_name.trim()
        ? row.display_name.trim()
        : defaults.name?.trim() || fallbackDisplayName,
    shortDescription:
      typeof row.short_description === "string" && row.short_description.trim()
        ? row.short_description.trim()
        : defaults.description?.trim() || "",
    iconSmall:
      typeof row.icon_small === "string" && row.icon_small.trim()
        ? row.icon_small.trim()
        : undefined,
    iconLarge:
      typeof row.icon_large === "string" && row.icon_large.trim()
        ? row.icon_large.trim()
        : undefined,
    brandColor:
      typeof row.brand_color === "string" && row.brand_color.trim()
        ? row.brand_color.trim()
        : undefined,
    defaultPrompt:
      typeof row.default_prompt === "string" && row.default_prompt.trim()
        ? row.default_prompt.trim()
        : undefined,
  };
}

function normalizePolicy(value: unknown): SkillManifestPolicy {
  const row = asRecord(value);
  return {
    allowImplicitInvocation: row.allow_implicit_invocation !== false,
  };
}

function normalizeToolDependency(value: unknown): SkillManifestToolDependency | null {
  const row = asRecord(value);
  const type = typeof row.type === "string" ? row.type.trim() : "";
  const valueText = typeof row.value === "string" ? row.value.trim() : "";
  if (!type || !valueText) return null;
  return {
    type,
    value: valueText,
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : undefined,
    transport:
      typeof row.transport === "string" && row.transport.trim() ? row.transport.trim() : undefined,
    url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : undefined,
  };
}

function normalizeDependencies(value: unknown): SkillManifestDependencies {
  const row = asRecord(value);
  return {
    tools: Array.isArray(row.tools)
      ? row.tools
          .map(normalizeToolDependency)
          .filter((entry): entry is SkillManifestToolDependency => entry !== null)
      : [],
    skills: asStringArray(row.skills),
    docs: asStringArray(row.docs),
  };
}

function normalizeState(value: unknown): SkillManifestState {
  const row = asRecord(value);
  const modeRaw = typeof row.mode === "string" ? row.mode.trim() : "";
  const mode: SkillStateMode =
    modeRaw === "agent_memory" || modeRaw === "skill_memory" || modeRaw === "stateless"
      ? modeRaw
      : "stateless";
  return {
    mode,
    memoryFile:
      typeof row.memory_file === "string" && row.memory_file.trim()
        ? row.memory_file.trim()
        : undefined,
  };
}

function normalizePaths(value: unknown): SkillManifestPaths {
  const row = asRecord(value);
  return {
    read: asStringArray(row.read),
    write: asStringArray(row.write),
  };
}

function normalizeVisualization(value: unknown): SkillManifestVisualization {
  const row = asRecord(value);
  return {
    mermaid: typeof row.mermaid === "string" && row.mermaid.trim() ? row.mermaid.trim() : undefined,
  };
}

function normalizeDemos(value: unknown): SkillManifestDemos {
  const row = asRecord(value);
  const labelsRow = asRecord(row.labels);
  const labels: Record<string, string> = {};
  for (const [key, label] of Object.entries(labelsRow)) {
    if (typeof label === "string" && label.trim()) labels[key] = label.trim();
  }
  return {
    defaultCaseId:
      typeof row.default_case_id === "string" && row.default_case_id.trim()
        ? row.default_case_id.trim()
        : undefined,
    labels,
  };
}

export function extractSkillFrontmatter(markdown: string): ParsedFrontmatter {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = parseSimpleYaml(match[1]);
  return {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
  };
}

export function extractMermaidFromMarkdown(markdown: string): string | undefined {
  const match = markdown.match(MERMAID_BLOCK_PATTERN);
  return match?.[1]?.trim() || undefined;
}

export function deriveSkillManifest(
  rawYaml: string | null,
  markdown: string,
  fallbackDisplayName: string,
): SkillManifest {
  const frontmatter = extractSkillFrontmatter(markdown);
  const parsed = rawYaml?.trim() ? parseSimpleYaml(rawYaml) : {};
  const visualization = normalizeVisualization(parsed.visualization);
  return {
    interface: normalizeInterface(parsed.interface, frontmatter, fallbackDisplayName),
    policy: normalizePolicy(parsed.policy),
    dependencies: normalizeDependencies(parsed.dependencies),
    state: normalizeState(parsed.state),
    paths: normalizePaths(parsed.paths),
    visualization: {
      mermaid: visualization.mermaid || extractMermaidFromMarkdown(markdown),
    },
    references: asStringArray(parsed.references),
    demos: normalizeDemos(parsed.demos),
  };
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function stringifyStringList(lines: string[], indent: string): string[] {
  return lines.length === 0
    ? [`${indent}[]`]
    : lines.map((entry) => `${indent}- ${yamlQuote(entry)}`);
}

export function stringifySkillManifest(manifest: SkillManifest): string {
  const lines: string[] = [];
  lines.push("interface:");
  lines.push(`  display_name: ${yamlQuote(manifest.interface.displayName)}`);
  lines.push(`  short_description: ${yamlQuote(manifest.interface.shortDescription)}`);
  if (manifest.interface.iconSmall)
    lines.push(`  icon_small: ${yamlQuote(manifest.interface.iconSmall)}`);
  if (manifest.interface.iconLarge)
    lines.push(`  icon_large: ${yamlQuote(manifest.interface.iconLarge)}`);
  if (manifest.interface.brandColor)
    lines.push(`  brand_color: ${yamlQuote(manifest.interface.brandColor)}`);
  if (manifest.interface.defaultPrompt)
    lines.push(`  default_prompt: ${yamlQuote(manifest.interface.defaultPrompt)}`);

  lines.push("policy:");
  lines.push(
    `  allow_implicit_invocation: ${manifest.policy.allowImplicitInvocation ? "true" : "false"}`,
  );

  lines.push("dependencies:");
  lines.push("  tools:");
  if (manifest.dependencies.tools.length === 0) lines.push("    []");
  else {
    for (const tool of manifest.dependencies.tools) {
      lines.push(`    - type: ${yamlQuote(tool.type)}`);
      lines.push(`      value: ${yamlQuote(tool.value)}`);
      if (tool.description) lines.push(`      description: ${yamlQuote(tool.description)}`);
      if (tool.transport) lines.push(`      transport: ${yamlQuote(tool.transport)}`);
      if (tool.url) lines.push(`      url: ${yamlQuote(tool.url)}`);
    }
  }
  lines.push("  skills:");
  lines.push(...stringifyStringList(manifest.dependencies.skills, "    "));
  lines.push("  docs:");
  lines.push(...stringifyStringList(manifest.dependencies.docs, "    "));

  lines.push("state:");
  lines.push(`  mode: ${yamlQuote(manifest.state.mode)}`);
  if (manifest.state.memoryFile)
    lines.push(`  memory_file: ${yamlQuote(manifest.state.memoryFile)}`);

  lines.push("paths:");
  lines.push("  read:");
  lines.push(...stringifyStringList(manifest.paths.read, "    "));
  lines.push("  write:");
  lines.push(...stringifyStringList(manifest.paths.write, "    "));

  lines.push("visualization:");
  if (manifest.visualization.mermaid?.trim()) {
    lines.push("  mermaid: |");
    for (const line of manifest.visualization.mermaid.split("\n")) {
      lines.push(`    ${line}`);
    }
  } else {
    lines.push("  {}");
  }

  lines.push("references:");
  lines.push(...stringifyStringList(manifest.references, "  "));

  lines.push("demos:");
  if (manifest.demos.defaultCaseId)
    lines.push(`  default_case_id: ${yamlQuote(manifest.demos.defaultCaseId)}`);
  lines.push("  labels:");
  const labelEntries = Object.entries(manifest.demos.labels);
  if (labelEntries.length === 0) lines.push("    {}");
  else {
    for (const [key, label] of labelEntries) {
      lines.push(`    ${key}: ${yamlQuote(label)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
