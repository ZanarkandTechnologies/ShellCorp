#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/heartbeat-smoke.sh --team-id <team-id> [options]

Options:
  --team-id <team-id>          Required team id (for example team-proj-shellcorp-v2)
  --convex-url <url>           Convex site URL (default: SHELLCORP_CONVEX_SITE_URL or http://127.0.0.1:3211)
  --repo-path <path>           ShellCorp repo path (default: script parent directory)
  --agents "a b c"             Optional space-delimited agent IDs (default: read from ~/.openclaw/openclaw.json)
  --retries <n>                Retries per agent on malformed output (default: 2)
  --help                       Show this help
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: missing command '$1'" >&2
    exit 2
  fi
}

TEAM_ID=""
CONVEX_URL="${SHELLCORP_CONVEX_SITE_URL:-http://127.0.0.1:3211}"
REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS_INPUT=""
RETRIES=2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team-id)
      TEAM_ID="${2:-}"
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
    --agents)
      AGENTS_INPUT="${2:-}"
      shift 2
      ;;
    --retries)
      RETRIES="${2:-}"
      shift 2
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

if [[ -z "$TEAM_ID" ]]; then
  echo "ERROR: --team-id is required" >&2
  usage
  exit 2
fi

require_command openclaw
require_command npm
require_command jq

OPENCLAW_CONFIG_PATH="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/openclaw.json"
if [[ -n "$AGENTS_INPUT" ]]; then
  mapfile -t AGENTS < <(printf '%s\n' "$AGENTS_INPUT" | tr ' ' '\n' | awk 'NF > 0')
else
  if [[ ! -f "$OPENCLAW_CONFIG_PATH" ]]; then
    echo "ERROR: OpenClaw config not found at $OPENCLAW_CONFIG_PATH" >&2
    exit 2
  fi
  mapfile -t AGENTS < <(jq -r '.agents.list[]?.id // empty' "$OPENCLAW_CONFIG_PATH")
fi

if [[ "${#AGENTS[@]}" -eq 0 ]]; then
  echo "ERROR: no agents available for smoke test" >&2
  exit 2
fi

echo "heartbeat-smoke:start team=$TEAM_ID convex=$CONVEX_URL agents=${#AGENTS[@]}"

failed=0
for agent in "${AGENTS[@]}"; do
  attempt=1
  passed=0
  last_reason="missing_markers"

  while [[ "$attempt" -le "$RETRIES" ]]; do
    detail="heartbeat_smoke attempt_${attempt}"
    prompt="Read HEARTBEAT.md and follow it exactly. Then run: SHELLCORP_CONVEX_SITE_URL=$CONVEX_URL npm --prefix $REPO_PATH run shell -- team bot log --team-id $TEAM_ID --agent-id $agent --activity-type status --label heartbeat_smoke --detail '$detail'. Respond with STATUS: and HEARTBEAT_OK in your final output."
    raw="$(openclaw agent --agent "$agent" --message "$prompt" --json 2>&1 || true)"
    payload="$(printf '%s' "$raw" | jq -r '.result.payloads[]?.text? // empty' 2>/dev/null || true)"

    if [[ -z "$payload" ]]; then
      last_reason="no_payload"
    elif [[ "$payload" != *"STATUS:"* ]]; then
      last_reason="missing_status_marker"
    elif [[ "$payload" != *"HEARTBEAT_OK"* ]]; then
      last_reason="missing_heartbeat_ok_marker"
    else
      passed=1
      break
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  if [[ "$passed" -eq 1 ]]; then
    echo "RESULT|$agent|pass|status_and_heartbeat_ok"
  else
    failed=$((failed + 1))
    echo "RESULT|$agent|fail|$last_reason"
  fi
done

if [[ "$failed" -gt 0 ]]; then
  echo "heartbeat-smoke:failed count=$failed"
  exit 1
fi

echo "heartbeat-smoke:ok count=${#AGENTS[@]}"
