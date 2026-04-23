#!/usr/bin/env bash
# Nightly trigger for the YouTube auto-production pipeline.
# Creates a new project via the web API; the server then chains research →
# researcher-planner subagent → topic_selection checkpoint.
# See docs/scheduling.md for launchd / cron setup.

set -euo pipefail

DATE="$(date +%Y-%m-%d)"
SLUG="nightly-$DATE"
THEME="${NIGHTLY_THEME:-}"
BASE_URL="${DASHBOARD_URL:-http://localhost:3000}"

PAYLOAD=$(cat <<EOF
{"id": "$SLUG", "theme": "$THEME", "language": "ko"}
EOF
)

echo "[nightly] POST $BASE_URL/api/projects slug=$SLUG theme='$THEME'"
curl -fsS -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo
