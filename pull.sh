#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL - Pull latest from GitHub and rebuild containers
# Usage: sudo ./pull.sh
#        sudo ./pull.sh --no-cache   (force full rebuild)
# ─────────────────────────────────────────────────────────────────

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

NO_CACHE=""
if [[ "$1" == "--no-cache" ]]; then
  NO_CACHE="--no-cache"
fi

echo ""
echo "ServerCTL - Update"
echo "=================="
echo ""

echo "[1/3] Pulling latest from GitHub..."
git pull

echo ""
echo "[2/3] Building containers${NO_CACHE:+ (no-cache)}..."
docker compose build $NO_CACHE

echo ""
echo "[3/3] Restarting containers..."
docker compose up -d

echo ""
echo "Done. ServerCTL updated successfully."
echo ""
