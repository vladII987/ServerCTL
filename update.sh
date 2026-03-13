#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — Update Script
# Pulls latest code, rebuilds frontend, restarts services
# Usage: sudo bash update.sh
# ─────────────────────────────────────────────────────────────────

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'
NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${W}╔══════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}      ${B}ServerCTL — Update${NC}                   ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════╝${NC}"
echo ""

OLD_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "unknown")
info "Current version: ${OLD_VERSION}"

# ── Detect install mode ──────────────────────────────────────
if [[ -f /etc/systemd/system/serverctl-backend.service ]]; then
    MODE="native"
elif command -v docker >/dev/null 2>&1 && [[ -f "$DIR/docker-compose.yml" ]]; then
    MODE="docker"
else
    err "Cannot detect install mode. Run setup.sh first."
fi
ok "Detected mode: ${MODE}"
echo ""

# ── Pull latest code ─────────────────────────────────────────
cd "$DIR"
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
REPO_PATH=$(echo "$REMOTE_URL" | sed 's|.*github.com[:/]||' | sed 's|\.git$||')

echo -e "  Git pull method:"
echo -e "  ${W}1)${NC} HTTPS (public, no auth needed)"
echo -e "  ${W}2)${NC} HTTPS with username/token"
echo -e "  ${W}3)${NC} SSH (requires SSH key)"
echo ""
read -rp "  Choice [1/2/3]: " GIT_CHOICE

case "$GIT_CHOICE" in
    1)
        git remote set-url origin "https://github.com/${REPO_PATH}.git"
        ;;
    2)
        read -rp "  GitHub username: " GIT_USER
        read -rsp "  GitHub token/password: " GIT_PASS
        echo ""
        git remote set-url origin "https://${GIT_USER}:${GIT_PASS}@github.com/${REPO_PATH}.git"
        ;;
    3)
        git remote set-url origin "git@github.com:${REPO_PATH}.git"
        ;;
    *)
        git remote set-url origin "https://github.com/${REPO_PATH}.git"
        ;;
esac

info "Pulling latest changes..."
git pull || err "git pull failed. Resolve conflicts and try again."

# Reset remote to plain HTTPS (don't store credentials in remote URL)
git remote set-url origin "https://github.com/${REPO_PATH}.git"
NEW_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "unknown")
ok "Updated: ${OLD_VERSION} → ${NEW_VERSION}"
echo ""

# ── Docker update ─────────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
    info "Rebuilding Docker containers..."
    APP_VERSION="$NEW_VERSION" docker compose up --build -d || err "Docker build failed."
    ok "Docker containers rebuilt and running."
    echo ""
    ok "Update complete! (v${NEW_VERSION})"
    exit 0
fi

# ── Native update ─────────────────────────────────────────────
# Backend dependencies
VENV="$DIR/backend/.venv"
if [[ -d "$VENV" ]]; then
    info "Updating Python dependencies..."
    "$VENV/bin/pip" install -q --upgrade pip
    "$VENV/bin/pip" install -q -r "$DIR/backend/requirements.txt"
    ok "Python dependencies updated."
else
    warn "Python venv not found at $VENV — skipping backend deps."
fi

# Write VERSION for backend
echo "$NEW_VERSION" > "$DIR/backend/VERSION"

# Frontend rebuild
if command -v npm >/dev/null 2>&1; then
    info "Rebuilding frontend..."
    cd "$DIR/frontend"

    # Read env from .env file if it exists
    DASHBOARD_TOKEN=""
    if [[ -f "$DIR/.env" ]]; then
        DASHBOARD_TOKEN=$(grep '^DASHBOARD_TOKEN=' "$DIR/.env" | cut -d'=' -f2)
    fi

    npm install --silent 2>/dev/null
    VITE_API_URL="" \
    VITE_DASHBOARD_TOKEN="${DASHBOARD_TOKEN}" \
    VITE_APP_VERSION="${NEW_VERSION}" \
        npm run build -- --logLevel silent || err "Frontend build failed."
    ok "Frontend rebuilt."
    cd "$DIR"

    # Ensure nginx can read dist
    chmod -R o+r "$DIR/frontend/dist" 2>/dev/null
else
    warn "npm not found — skipping frontend rebuild."
fi

# Restart services
info "Restarting backend service..."
systemctl restart serverctl-backend 2>/dev/null
if systemctl is-active --quiet serverctl-backend 2>/dev/null; then
    ok "Backend restarted."
else
    warn "Backend may not have started. Check: journalctl -u serverctl-backend -n 30"
fi

# Reload nginx
if systemctl is-active --quiet nginx 2>/dev/null; then
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
    ok "Nginx reloaded."
fi

echo ""
ok "Update complete! (v${NEW_VERSION})"
