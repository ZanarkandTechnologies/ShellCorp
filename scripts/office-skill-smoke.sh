#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/office-skill-smoke.sh --team-id <team-id> --agent-id <agent-id> --skill-id <skill-id> [options]

Options:
  --team-id <team-id>          Required team id (for example team-proj-shellcorp-v2)
  --agent-id <agent-id>        Required agent id to animate in the office
  --skill-id <skill-id>        Required skill id already bound to an office object
  --state <state>              planning|executing|blocked|done (default: executing)
  --status-text <text>         Bubble text to show in the office (default: "Testing <skill-id>")
  --step-key <step-key>        Optional idempotency key (default: generated)
  --convex-url <url>           Convex site URL (default: SHELLCORP_CONVEX_SITE_URL or CONVEX_SITE_URL)
  --repo-path <path>           ShellCorp repo path (default: script parent directory)
  --json                       Forward JSON output from the CLI
  --help                       Show this help

Example:
  scripts/office-skill-smoke.sh \
    --team-id team-openclaw \
    --agent-id main \
    --skill-id world-monitor \
    --status-text "Testing world monitor binding"

To clear the snap afterwards, send a done/idle update for the same agent:
  npm run shell -- team status report --team-id <team-id> --agent-id <agent-id> --state done --status-text "Skill smoke complete" --skill-id <skill-id>
EOF
}

TEAM_ID=""
AGENT_ID=""
SKILL_ID=""
STATE="executing"
STATUS_TEXT=""
STEP_KEY=""
CONVEX_URL="${SHELLCORP_CONVEX_SITE_URL:-${CONVEX_SITE_URL:-}}"
REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSON_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team-id)
      TEAM_ID="${2:-}"
      shift 2
      ;;
    --agent-id)
      AGENT_ID="${2:-}"
      shift 2
      ;;
    --skill-id)
      SKILL_ID="${2:-}"
      shift 2
      ;;
    --state)
      STATE="${2:-}"
      shift 2
      ;;
    --status-text)
      STATUS_TEXT="${2:-}"
      shift 2
      ;;
    --step-key)
      STEP_KEY="${2:-}"
      shift 2
      ;;
    --convex-url)
      CONVEX_URL="${2:-}"
      shift 2
      ;;
    --repo-path)
      REPO_PATH="${2:-}"
      shift 2
      ;;
    --json)
      JSON_MODE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument '$1'" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$TEAM_ID" || -z "$AGENT_ID" || -z "$SKILL_ID" ]]; then
  echo "ERROR: --team-id, --agent-id, and --skill-id are required" >&2
  usage
  exit 2
fi

if [[ -z "$STATUS_TEXT" ]]; then
  STATUS_TEXT="Testing $SKILL_ID"
fi

if [[ -z "$STEP_KEY" ]]; then
  STEP_KEY="office-skill-smoke-${AGENT_ID}-$(date +%s)"
fi

case "$STATE" in
  planning|executing|blocked|done|running|ok|idle|no_work|error)
    ;;
  *)
    echo "ERROR: invalid --state '$STATE'" >&2
    exit 2
    ;;
esac

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: missing command 'npm'" >&2
  exit 2
fi

cd "$REPO_PATH"

if [[ -n "$CONVEX_URL" ]]; then
  export SHELLCORP_CONVEX_SITE_URL="$CONVEX_URL"
fi

CMD=(
  npm run shell -- team status report
  --team-id "$TEAM_ID"
  --agent-id "$AGENT_ID"
  --state "$STATE"
  --status-text "$STATUS_TEXT"
  --skill-id "$SKILL_ID"
  --step-key "$STEP_KEY"
)

if [[ "$JSON_MODE" -eq 1 ]]; then
  CMD+=(--json)
fi

echo "office-skill-smoke:start team=$TEAM_ID agent=$AGENT_ID skill=$SKILL_ID state=$STATE"
"${CMD[@]}"
echo "office-skill-smoke:ok step_key=$STEP_KEY"
