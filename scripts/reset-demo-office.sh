#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/reset-demo-office.sh [options]

Reset the active ShellCorp office into a small demo ladder:
- easy: Solo Affiliate Lab
- medium: Micro SaaS Duo
- hard: Autonomous Agency

Options:
  --profile <profile>         Demo profile: minimal|ladder (default: ladder)
                              minimal = affiliate solo + autonomous agency
                              ladder  = affiliate solo + micro-SaaS duo + autonomous agency
  --convex-url <url>          Convex site URL for board seeding
  --skip-board                Skip board task seeding even if Convex URL is available
  --repo-path <path>          ShellCorp repo path (default: script parent directory)
  --dry-run                   Print commands without executing them
  --help                      Show this help

Examples:
  scripts/reset-demo-office.sh
  scripts/reset-demo-office.sh --profile minimal
  scripts/reset-demo-office.sh --convex-url http://127.0.0.1:3211
EOF
}

PROFILE="ladder"
REPO_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONVEX_URL="${SHELLCORP_CONVEX_SITE_URL:-${CONVEX_SITE_URL:-}}"
SKIP_BOARD=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --convex-url)
      CONVEX_URL="${2:-}"
      shift 2
      ;;
    --skip-board)
      SKIP_BOARD=1
      shift
      ;;
    --repo-path)
      REPO_PATH="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
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

case "$PROFILE" in
  minimal|ladder)
    ;;
  *)
    echo "ERROR: invalid --profile '$PROFILE' (expected minimal|ladder)" >&2
    exit 2
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: missing command 'node'" >&2
  exit 2
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: missing command 'npm'" >&2
  exit 2
fi

cd "$REPO_PATH"

if [[ ! -f "dist/bundle/shellcorp-cli.cjs" ]]; then
  npm run cli:bundle >/dev/null
fi

if [[ -z "$CONVEX_URL" && -f ".env.local" ]]; then
  CONVEX_URL="$(grep '^CONVEX_SITE_URL=' .env.local | cut -d= -f2- || true)"
fi

if [[ -n "$CONVEX_URL" ]]; then
  export SHELLCORP_CONVEX_SITE_URL="$CONVEX_URL"
elif [[ "$SKIP_BOARD" -eq 0 ]]; then
  echo "reset-demo-office:warn missing Convex site URL; board seeding will be skipped" >&2
  SKIP_BOARD=1
fi

RUNNER=(node dist/bundle/shellcorp-cli.cjs)
RUN_STAMP="$(date +%Y%m%d%H%M%S)"
RUN_SUFFIX="demo-${RUN_STAMP}"

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

run_cmd() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf 'DRY_RUN:'
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi
  "$@"
}

run_quiet() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    run_cmd "$@"
  else
    "$@" >/dev/null
  fi
}

seed_task() {
  if [[ "$SKIP_BOARD" -eq 1 ]]; then
    return 0
  fi
  run_quiet "${RUNNER[@]}" team board task add "$@"
}

archive_active_teams() {
  local active_ids
  active_ids="$("${RUNNER[@]}" team list --json | node -e '
let data = "";
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  const parsed = JSON.parse(data);
  for (const team of parsed.teams ?? []) {
    if (team.status === "active") {
      console.log(team.teamId);
    }
  }
});
')"
  if [[ -z "$active_ids" ]]; then
    echo "reset-demo-office:info no active teams to archive"
    return 0
  fi
  while IFS= read -r team_id; do
    [[ -z "$team_id" ]] && continue
    run_quiet "${RUNNER[@]}" team archive --team-id "$team_id" --deregister-openclaw --json
    echo "reset-demo-office:archived $team_id"
  done <<<"$active_ids"
}

create_affiliate_solo() {
  local canonical_name="Solo Affiliate Lab"
  local create_name="${canonical_name} ${RUN_SUFFIX}"
  local name_slug
  name_slug="$(slugify "$create_name")"
  local team_id="team-proj-${name_slug}"
  local growth_agent="${name_slug}-growth"

  run_quiet "${RUNNER[@]}" team create \
    --team-id "$team_id" \
    --name "$create_name" \
    --description "One-person affiliate content machine for proving the easiest autonomous business case." \
    --goal "Publish and refresh high-intent affiliate content that earns first commissions with minimal coordination overhead." \
    --kpi pages_published_per_week \
    --kpi organic_clicks \
    --kpi affiliate_revenue_usd \
    --auto-roles growth_marketer \
    --with-cluster \
    --json
  run_quiet "${RUNNER[@]}" team update \
    --team-id "$team_id" \
    --name "$canonical_name" \
    --description "One-person affiliate content machine for proving the easiest autonomous business case." \
    --json
  run_quiet "${RUNNER[@]}" team business set-all \
    --team-id "$team_id" \
    --business-type affiliate_marketing \
    --measure-skill-id keyword-opportunity-scout \
    --execute-skill-id affiliate-content-writer \
    --distribute-skill-id seo-publisher \
    --json
  run_quiet "${RUNNER[@]}" team heartbeat set \
    --team-id "$team_id" \
    --cadence-minutes 180 \
    --goal "Find profitable low-competition offers, publish pages, and report revenue signals." \
    --team-description "One-agent affiliate team optimized for the lowest coordination overhead." \
    --product-details "SEO-driven affiliate pages and refresh loops with direct commission feedback." \
    --json
  seed_task \
    --team-id "$team_id" \
    --title "Pick one high-intent affiliate niche" \
    --owner-agent-id "$growth_agent" \
    --priority high \
    --detail "Choose one narrow buyer keyword set with clear commercial intent and low competition." \
    --json >/dev/null
  seed_task \
    --team-id "$team_id" \
    --title "Publish first three money pages" \
    --owner-agent-id "$growth_agent" \
    --priority high \
    --detail "Draft and publish the first comparison and review pages tied to the selected offer set." \
    --json >/dev/null
  echo "reset-demo-office:created $team_id ($canonical_name)"
}

create_micro_saas_duo() {
  local canonical_name="Micro SaaS Duo"
  local create_name="${canonical_name} ${RUN_SUFFIX}"
  local name_slug
  name_slug="$(slugify "$create_name")"
  local team_id="team-proj-${name_slug}"
  local builder_agent="${name_slug}-builder"
  local pm_agent="${name_slug}-pm"

  run_quiet "${RUNNER[@]}" team create \
    --team-id "$team_id" \
    --name "$create_name" \
    --description "Two-person software business where one agent builds and one agent handles product and sales." \
    --goal "Ship and sell a narrow micro-SaaS with one builder and one PM operator." \
    --kpi weekly_active_users \
    --kpi trial_to_paid_conversion \
    --kpi demos_booked \
    --auto-roles builder,pm \
    --with-cluster \
    --json
  run_quiet "${RUNNER[@]}" team update \
    --team-id "$team_id" \
    --name "$canonical_name" \
    --description "Two-person software business where one agent builds and one agent handles product and sales." \
    --json
  run_quiet "${RUNNER[@]}" team business set-all \
    --team-id "$team_id" \
    --business-type saas \
    --measure-skill-id customer-interview-scout \
    --execute-skill-id app-feature-builder \
    --distribute-skill-id founder-outbound \
    --json
  run_quiet "${RUNNER[@]}" team heartbeat set \
    --team-id "$team_id" \
    --cadence-minutes 90 \
    --goal "Keep the product shipping while converting weekly conversations into roadmap and sales motion." \
    --team-description "Two-agent SaaS team with one builder and one PM seller." \
    --product-details "Narrow B2B micro-SaaS with founder-led sales and fast iteration." \
    --json
  seed_task \
    --team-id "$team_id" \
    --title "Define one painful customer workflow" \
    --owner-agent-id "$pm_agent" \
    --priority high \
    --detail "Pick one buyer persona, one workflow, and one painful manual step worth replacing with software." \
    --json >/dev/null
  seed_task \
    --team-id "$team_id" \
    --title "Build the narrow MVP path" \
    --owner-agent-id "$builder_agent" \
    --priority high \
    --detail "Implement the smallest end-to-end user flow that solves the selected workflow without extra platform work." \
    --json >/dev/null
  echo "reset-demo-office:created $team_id ($canonical_name)"
}

create_autonomous_agency() {
  local canonical_name="Autonomous Agency"
  local create_name="${canonical_name} ${RUN_SUFFIX}"
  local name_slug
  name_slug="$(slugify "$create_name")"
  local team_id="team-proj-${name_slug}"
  local builder_agent="${name_slug}-builder"
  local pm_agent="${name_slug}-pm"
  local growth_agent="${name_slug}-growth"

  run_quiet "${RUNNER[@]}" team create \
    --team-id "$team_id" \
    --name "$create_name" \
    --description "Three-person autonomous client service team with PM, builder, and growth roles." \
    --goal "Run a fully autonomous agency that wins leads, delivers work, and maintains client communication." \
    --kpi qualified_leads_per_week \
    --kpi proposal_win_rate \
    --kpi client_delivery_cycle_time \
    --auto-roles builder,pm,growth_marketer \
    --with-cluster \
    --json
  run_quiet "${RUNNER[@]}" team update \
    --team-id "$team_id" \
    --name "$canonical_name" \
    --description "Three-person autonomous client service team with PM, builder, and growth roles." \
    --json
  run_quiet "${RUNNER[@]}" team business set-all \
    --team-id "$team_id" \
    --business-type custom \
    --measure-skill-id lead-research \
    --execute-skill-id client-delivery-builder \
    --distribute-skill-id case-study-outreach \
    --json
  run_quiet "${RUNNER[@]}" team heartbeat set \
    --team-id "$team_id" \
    --cadence-minutes 45 \
    --goal "Continuously source leads, convert the right ones, deliver client work, and report outcomes without founder babysitting." \
    --team-description "Three-agent agency team split across sales, execution, and growth." \
    --product-details "Service business that must balance pipeline, delivery quality, and client trust at the same time." \
    --json
  seed_task \
    --team-id "$team_id" \
    --title "Choose one repeatable agency offer" \
    --owner-agent-id "$pm_agent" \
    --priority high \
    --detail "Define one service with fixed scope, target customer, and clear promise so delivery can be standardized." \
    --json >/dev/null
  seed_task \
    --team-id "$team_id" \
    --title "Build delivery system for the core offer" \
    --owner-agent-id "$builder_agent" \
    --priority high \
    --detail "Create the repeatable fulfillment assets, checklists, and tooling needed to deliver the offer consistently." \
    --json >/dev/null
  seed_task \
    --team-id "$team_id" \
    --title "Create outbound and case-study loop" \
    --owner-agent-id "$growth_agent" \
    --priority high \
    --detail "Generate targeted lead lists, outreach assets, and proof loops that keep the agency pipeline full." \
    --json >/dev/null
  echo "reset-demo-office:created $team_id ($canonical_name)"
}

archive_active_teams
create_affiliate_solo
if [[ "$PROFILE" == "ladder" ]]; then
  create_micro_saas_duo
fi
create_autonomous_agency

echo "reset-demo-office:done profile=$PROFILE board_seeded=$((1 - SKIP_BOARD))"
