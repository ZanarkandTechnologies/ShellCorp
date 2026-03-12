---
name: competitor-feature-scout
description: Daily competitor feature scout that reviews last-day commits, identifies useful features, posts findings to the main agent bot via ShellCorp CLI, and updates MEMORY with the latest processed SHA.
---

# Competitor Feature Scout

## Why This Exists

Reduce manual competitor tracking by converting the last day of repo activity into concrete, ShellCorp-native adoption suggestions.

## Files In This Skill Package

- `watchlist.md`: repos to monitor
- `SKILL.md`: workflow and guardrails
- `MEMORY.md`: local run memory (latest processed SHA per repo and summary notes)

## Inputs

- `watchlist.md` in this skill folder
- `MEMORY.md` in this skill folder
- Last 24 hours of commits for each enabled repo

## Workflow

1. Read enabled repositories from `watchlist.md`.
2. For each repo, read its last processed SHA from `MEMORY.md` if present.
3. Fetch commits from the last day (or since last SHA when available).
4. Identify potential new features and meaningful improvements.
5. Collect short useful snippets from commit or PR comments that explain implementation choices.
6. Decide for each feature:
   - `copy` (adopt now)
   - `drop` (ignore for now)
7. Use ShellCorp CLI to post results to the main agent bot comment board.
8. Update `MEMORY.md` with:
   - latest processed SHA per repo
   - run timestamp
   - concise summary of what was posted

## Output Format (post to main agent bot)

- Repo
- Commit range
- Feature summary
- Decision: `copy` or `drop`
- Why
- Useful snippet(s)
- Suggested ShellCorp follow-up action

## Guardrails

- Keep it daily and lightweight.
- Focus on product-significant changes, not noise.
- Do not copy code blindly; copy ideas and adapt to ShellCorp patterns.
- Keep posts concise and actionable.
- Always update `MEMORY.md` after each successful run.
