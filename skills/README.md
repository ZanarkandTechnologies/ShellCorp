# Skills

Repo-local skills are instruction bundles for agents. They stay file-based and human-readable.

Prefer two layers when needed:

- workflow skills for intent discovery and sequencing,
- tool skills for concrete command/reference details.

## Required Files

- `SKILL.md` or legacy `skill.md`: workflow, commands, and guardrails.
- Optional `skill.config.yaml`: structured Skill Studio metadata for UI, diagrams, dependencies, and safe package-level editing.
- `tests/*.md` for skills with ShellCorp-native operational flows.

## Skill Contract Test Standard

Skill contract tests are markdown files with one fenced `json skill-test` block.

Example:

````md
# Example

```json skill-test
{
  "name": "create team",
  "steps": [
    {
      "run": ["team", "create", "--name", "Alpha", "--description", "Core team", "--goal", "Ship fast"],
      "expect": {
        "companyProjectIdsInclude": ["proj-alpha"]
      }
    }
  ]
}
```
````

## Supported Assertions

- `stdoutIncludes`
- `stderrIncludes`
- `companyProjectIdsInclude`
- `companyProposalCount`
- `companyProposalStates`
- `openclawAgentIdsInclude`
- `filesExist`

## Commands

- `pnpm run test:skills`

## Notes

- Contract tests use a temporary local ShellCorp state dir.
- They are meant to prove that skill examples still work against the CLI.
- They do not replace deeper unit or integration tests in `cli/`, `convex/`, or `ui/src/`.
- If a workflow skill depends on a tool skill, keep the workflow in the higher-level skill and link to the tool skill for command syntax.
