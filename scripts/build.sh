#!/usr/bin/env bash
# Sequential build script — builds services one at a time to avoid
# DNS/connection overload from 8 parallel pnpm installs.
set -e

PROFILE="${1:-full}"

echo "🔨 Building Synthex (profile: $PROFILE) — sequential mode"
echo ""

SERVICES=(
  "project-service"
  "user-service"
  "container-service"
  "execution-service"
  "storage-service"
  "api-gateway"
  "web"
)

for svc in "${SERVICES[@]}"; do
  echo "━━━ Building $svc ━━━"
  docker compose --profile "$PROFILE" build "$svc" && echo "✓ $svc built" || {
    echo "✗ $svc failed"
    exit 1
  }
  echo ""
done

echo "🚀 All images built — starting containers..."
docker compose --profile "$PROFILE" up -d
echo "✅ Done"
