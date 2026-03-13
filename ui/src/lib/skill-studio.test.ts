import { describe, expect, it } from "vitest";

import { deriveSkillManifest, stringifySkillManifest } from "./skill-studio";

describe("skill studio manifest helpers", () => {
  it("derives metadata from yaml and keeps explicit mermaid diagrams", () => {
    const manifest = deriveSkillManifest(
      `interface:
  display_name: "Create Team"
  short_description: "Workflow"
policy:
  allow_implicit_invocation: false
dependencies:
  tools:
    - type: "mcp"
      value: "docs"
  skills:
    - "shellcorp-team-cli"
  docs:
    - "./tests/demo.md"
state:
  mode: "stateless"
paths:
  read:
    - "{skillDir}/SKILL.md"
  write: []
visualization:
  mermaid: |
    flowchart TD
      A --> B
references:
  - "./tests/demo.md"
demos:
  default_case_id: "demo"
  labels:
    demo: "Default demo"
`,
      "# Create Team\n",
      "Create Team",
    );

    expect(manifest.interface.displayName).toBe("Create Team");
    expect(manifest.policy.allowImplicitInvocation).toBe(false);
    expect(manifest.dependencies.skills).toEqual(["shellcorp-team-cli"]);
    expect(manifest.visualization.mermaid).toContain("A --> B");
    expect(manifest.demos.defaultCaseId).toBe("demo");
  });

  it("falls back to markdown mermaid and frontmatter defaults when yaml is absent", () => {
    const manifest = deriveSkillManifest(
      null,
      `---
name: shellcorp scout
description: reads repo changes
---

\`\`\`mermaid
flowchart TD
  Watch --> Decide
\`\`\`
`,
      "Scout",
    );

    expect(manifest.interface.displayName).toBe("shellcorp scout");
    expect(manifest.interface.shortDescription).toBe("reads repo changes");
    expect(manifest.visualization.mermaid).toContain("Watch --> Decide");
    expect(manifest.state.mode).toBe("stateless");
  });

  it("stringifies the normalized manifest shape for raw yaml editing", () => {
    const manifest = deriveSkillManifest(null, "# Demo\n", "Demo");
    const raw = stringifySkillManifest(manifest);
    expect(raw).toContain("interface:");
    expect(raw).toContain("display_name:");
    expect(raw).toContain("policy:");
    expect(raw.endsWith("\n")).toBe(true);
  });
});
