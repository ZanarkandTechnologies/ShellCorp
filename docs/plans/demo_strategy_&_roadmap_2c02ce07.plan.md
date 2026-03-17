---
name: Demo Strategy & Roadmap
overview: Strategic prioritization of your idea dump, with a concrete demo plan for this week focused on the self-copying competitor intel team, plus a ranked roadmap for the bigger vision.
todos:
  - id: demo-watchlist
    content: Populate watchlist.md with 3-5 real AI office/agent repos (OpenHands, composio, etc.)
    status: pending
  - id: demo-scout-cli
    content: "Build `meta competitor-repos scout` CLI command: reads watchlist → GitHub API commits → classify ignore/candidate/priority → persist digest to ~/.openclaw/competitor-intel/"
    status: pending
  - id: demo-seed-proposal
    content: Seed CEO board with one pre-existing scout proposal in Human Review state so demo has a live approve action ready
    status: pending
  - id: demo-office-team
    content: Add a Competitor Intel Team to the demo office profile with 1 agent and a skill activity beat showing it 'working'
    status: pending
  - id: demo-cron
    content: Implement `meta competitor-repos cron install` command that writes a CEO workflow job to ~/.openclaw/cron/jobs.json
    status: pending
  - id: demo-reset-profile
    content: Add a `competitor` profile to scripts/reset-demo-office.sh that bootstraps the team + pre-seeded proposal for clean demo reruns
    status: pending
isProject: false
---

# Demo Strategy & Roadmap

## Strategic Read

You have two different things mixed together: **platform primitives** (object-skill interface, vibe coding tools) and **use cases** (sales teams, competitor tracking, self-building). The demo needs a use case, not a primitive.

**Your best demo angle is already planned and half-built:** the self-copying competitor intel team. It's meta, it's memorable, it shows the full loop (autonomous work → CEO review → founder approval → board task), and it doesn't require money to be in the story yet.

Miro Fish / world simulations / polymarket trading: I'd park this entirely. It's a completely separate product surface with no code overlap. Don't introduce it at this demo.

---

## Demo This Week: The Self-Copying Team

**Narrative:** *ShellCorp's first autonomous team doesn't sell anything — it makes ShellCorp better. Every morning it scans GitHub repos from other AI office projects, finds interesting commits, and the CEO presents adoption proposals. You approve one. A task lands on the board. The office ran itself overnight.*

That's a 90-second story with a clear beginning, middle, and end.

### What already exists

- `skills/shellcorp-competitor-feature-scout/` — skill, watchlist, memory files
- `skills/shellcorp-competitor-feature-scout/watchlist.md` — placeholder, needs real repos
- CEO Workbench + Human Review flow — built in UI
- Team Panel + board tasks — built in UI
- Full technical plan for CLI commands — in `docs/progress.md`

### What to build for the demo (3-4 days)

**Step 1 — Populate the watchlist** with 3-5 real repos (OpenHands, composio, any active agentic coding projects)

**Step 2 — Build `meta competitor-repos scout`** (the core CLI command from the plan in `docs/progress.md`). Reads watchlist → fetches last-day commits via GitHub API → classifies `ignore|candidate|priority` → persists digest to `~/.openclaw/competitor-intel/`

**Step 3 — Seed the CEO board** with one pre-existing proposal so the demo has a live item in Human Review ready to approve

**Step 4 — Place a "Competitor Intel Team"** as an office object with 1 agent assigned. Show it "working" with a skill activity beat.

**Step 5 — Install the cron job** (`meta competitor-repos cron install`) so you can say "this runs every morning at 9am"

You do NOT need `finalize` or full task auto-creation for the demo. The story works with: scout output → CEO saw it → proposal exists → founder approves live → task appears.

### Demo flow (step-by-step)

1. Office loads, show the Competitor Intel Team cluster in the scene
2. Open CEO Workbench → Human Review → pre-seeded proposal is there
3. Walk through what the scout found (commits from a real repo, real reasoning)
4. Click Approve
5. Show the task land on the team board
6. Show the cron schedule — "this repeats every morning"

---

## Idea Ranking (Roadmap, Not Demo)

### Tier 1 — Core platform, build after demo

- **Object-as-skill interface** (idea 3): This is your biggest differentiator. Gym bike = training object with a training skill bound to it. Agent "uses" an object as a tool call. This makes the office feel alive and functional at the same time. The `skill.config.yaml` + `metadata.skillBinding` pattern already exists in MEMORY — extend it so agents can propose which objects to interact with. This is the thing that separates ShellCorp from every "agent dashboard" product.
- **High-ticket sales teams** (idea 1): Right mission, right revenue path. Build after demo. Needs real outreach tooling connected (email/LinkedIn/calendar).

### Tier 2 — Compelling but not urgent

- **App-building loop** (idea 2 — reddit hype → build): Strong loop, but needs the object-skill interface first so agents can actually "use" the coding desk.
- **Competitor team → self-building** (ideas 6/7): The competitor team IS this. Once the CLI commands exist, pointing the watchlist at your own codebase's pain points is one config change.
- **Agent vibe-coding internal tools** (idea 4): Very cool. Agents propose new office objects + tool attachments. This becomes the "marketplace" story — the office grows its own tools.

### Tier 3 — Defer

- Clone friends/celebrities — fun but needs personalization pipeline fully done first
- Multiple agent spawn animations — nice idle polish, do last
- Miro Fish / polymarket — completely separate product, park it
- Dynamic table / office furniture vibe editing — good for a later polish sprint

---

## Key Files to Touch for Demo

- `[skills/shellcorp-competitor-feature-scout/watchlist.md](skills/shellcorp-competitor-feature-scout/watchlist.md)` — add real repos
- New `cli/meta-commands/` — `scout` command (designed in `docs/progress.md`)
- `~/.openclaw/cron/jobs.json` — cron install target
- `scripts/reset-demo-office.sh` — add a `competitor` demo profile that seeds the Intel team + one pre-approved proposal

---

## What This Demo Proves

- ShellCorp can run a real autonomous team with zero manual trigger
- The CEO review + founder approval loop actually works
- The office is the control surface for that loop (not a terminal)
- The product story doesn't require money to be compelling yet

