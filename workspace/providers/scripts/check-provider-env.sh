#!/usr/bin/env bash
set -euo pipefail

required=(
  "CONVEX_URL"
  "FAHRENHEIT_INGEST_TOKEN"
)

optional=(
  "TELEGRAM_BOT_TOKEN"
  "DISCORD_BOT_TOKEN"
  "SLACK_BOT_TOKEN"
  "SLACK_APP_TOKEN"
  "NOTION_API_KEY"
)

echo "Checking required env vars..."
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "MISSING: $key"
    exit 1
  fi
done

echo "Required vars are set."
echo "Checking optional provider vars..."
for key in "${optional[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Optional missing: $key"
  else
    echo "Found: $key"
  fi
done
