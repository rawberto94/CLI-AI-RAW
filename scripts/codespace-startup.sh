#!/bin/bash
# ============================================================================
# Codespace Startup Script
# ============================================================================
# Runs on every codespace start (postStartCommand).
# Prevents the resource bloat that causes codespace crashes:
#   - Clears stale Next.js cache (can grow to 5+ GB)
#   - Prunes unused Docker images and build cache
#   - Starts only docker-compose.dev.yml (prevents duplicate containers)
#   - Marks the workspace as a safe git directory
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Codespace Startup ==="

# 1. Git safe directory
git config --global --add safe.directory "$PROJECT_ROOT" 2>/dev/null || true

# 2. Clear Next.js build cache if it exceeds 500MB
NEXT_CACHE="$PROJECT_ROOT/apps/web/.next/cache"
if [ -d "$NEXT_CACHE" ]; then
  CACHE_SIZE=$(du -sm "$NEXT_CACHE" 2>/dev/null | cut -f1)
  if [ "$CACHE_SIZE" -gt 500 ] 2>/dev/null; then
    echo "  Clearing Next.js cache (${CACHE_SIZE}MB > 500MB threshold)..."
    rm -rf "$NEXT_CACHE"
  fi
fi

# 3. Docker cleanup — only if Docker is available
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  # Stop any containers from docker-compose.vm.yml to avoid duplicates
  for name in contigo-redis contigo-minio contigo-postgres contigo-web; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
      echo "  Stopping duplicate container: $name"
      docker stop "$name" 2>/dev/null && docker rm "$name" 2>/dev/null || true
    fi
  done

  # Prune dangling images and old build cache (keep last 7 days)
  docker image prune -f --filter "until=168h" 2>/dev/null || true
  docker builder prune -f --filter "until=168h" 2>/dev/null || true

  # Start dev services if not already running
  if ! docker ps --format '{{.Names}}' | grep -q "contract-intelligence-postgres-dev"; then
    echo "  Starting dev services..."
    docker compose -f docker-compose.dev.yml up -d
  else
    echo "  Dev services already running."
  fi

  # Fix Docker-in-Docker networking: containers can lose their network attachment
  # after codespace restart, leaving them running but with no ports exposed.
  NETWORK_NAME="cli-ai-raw_default"
  if docker network inspect "$NETWORK_NAME" &>/dev/null; then
    for container in contract-intelligence-redis-dev contract-intelligence-minio-dev contract-intelligence-postgres-dev contract-intelligence-neo4j-dev; do
      if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        NETS=$(docker inspect "$container" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null)
        if [ "$NETS" = "{}" ] || [ -z "$NETS" ]; then
          echo "  Reconnecting $container to $NETWORK_NAME..."
          docker network connect "$NETWORK_NAME" "$container" 2>/dev/null || true
        fi
      fi
    done
  fi
fi

# 4. Show resource summary
echo ""
echo "=== Resource Summary ==="
echo "  Disk: $(df -h / | awk 'NR==2{print $3 " used / " $2 " total (" $5 ")"}')"
echo "  Memory: $(free -h | awk '/Mem/{print $3 " used / " $2 " total"}')"
if command -v docker &>/dev/null; then
  echo "  Containers: $(docker ps --format '{{.Names}}' | tr '\n' ', ' | sed 's/,$//')"
fi
echo ""
echo "=== Ready ==="
