#!/usr/bin/env bash
set -euo pipefail

provider="${1:-notion-comments}"
gateway_url="${FAHRENHEIT_GATEWAY_URL:-http://127.0.0.1:8787}"
token="${FAHRENHEIT_INGEST_TOKEN:-}"

auth_header=()
if [[ -n "$token" ]]; then
  auth_header=(-H "Authorization: Bearer $token")
fi

curl -sS -X POST "$gateway_url/providers/$provider/test"   "${auth_header[@]}"   -H "Content-Type: application/json"   -d "{"content":"test from script","mode":"observational"}"
