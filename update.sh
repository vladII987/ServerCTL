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

# ══════════════════════════════════════════════════════════════
# CRITICAL: Verify .env and backup before doing anything
# ══════════════════════════════════════════════════════════════
if [[ ! -f "$DIR/.env" ]]; then
    err ".env file not found! Cannot update without it — tokens and config would be lost.
    If you lost .env, run setup.sh again to generate new tokens."
fi

# Verify .env has required tokens
MISSING=""
for VAR in SECRET_KEY DASHBOARD_TOKEN AGENT_TOKEN; do
    VAL=$(grep "^${VAR}=" "$DIR/.env" | cut -d'=' -f2)
    if [[ -z "$VAL" ]]; then
        MISSING="$MISSING $VAR"
    fi
done
if [[ -n "$MISSING" ]]; then
    err "Missing tokens in .env:${MISSING}
    Run setup.sh to regenerate or restore from backup."
fi

# Create backup of critical files
BACKUP_DIR="$DIR/.backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$DIR/.env" "$BACKUP_DIR/.env"
cp "$DIR/backend/servers.json" "$BACKUP_DIR/servers.json" 2>/dev/null
cp "$DIR/backend/users.json" "$BACKUP_DIR/users.json" 2>/dev/null
ok "Backup saved → $BACKUP_DIR"

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

# Detect the real user (not root) for SSH key access
REAL_USER="${SUDO_USER:-$(whoami)}"
REAL_HOME=$(eval echo "~$REAL_USER")

# Fix ownership if repo was cloned as root but real user is different
if [[ -n "$REAL_USER" ]] && [[ "$REAL_USER" != "root" ]]; then
    chown -R "$REAL_USER":"$REAL_USER" "$DIR" 2>/dev/null || true
fi

# Fix "dubious ownership" for both root and real user
git config --global --add safe.directory "$DIR" 2>/dev/null || true
if [[ -n "$REAL_USER" ]] && [[ "$REAL_USER" != "root" ]]; then
    su - "$REAL_USER" -c "git config --global --add safe.directory '$DIR'" 2>/dev/null || true
fi

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
        info "Pulling latest changes..."
        git pull || err "git pull failed."
        ;;
    2)
        read -rp "  GitHub username: " GIT_USER
        read -rsp "  GitHub token/password: " GIT_PASS
        echo ""
        git remote set-url origin "https://${GIT_USER}:${GIT_PASS}@github.com/${REPO_PATH}.git"
        info "Pulling latest changes..."
        git pull || err "git pull failed."
        # Clear credentials from remote URL
        git remote set-url origin "https://github.com/${REPO_PATH}.git"
        ;;
    3)
        git remote set-url origin "git@github.com:${REPO_PATH}.git"
        info "Pulling latest changes (as ${REAL_USER})..."
        # Run git pull as the real user so SSH keys work under sudo
        if [[ "$(whoami)" == "root" && "$REAL_USER" != "root" ]]; then
            su - "$REAL_USER" -c "cd '$DIR' && git pull" || err "git pull failed."
        else
            git pull || err "git pull failed."
        fi
        ;;
    *)
        git remote set-url origin "https://github.com/${REPO_PATH}.git"
        info "Pulling latest changes..."
        git pull || err "git pull failed."
        ;;
esac

# Restore .env in case git pull overwrote it (shouldn't happen, but safety)
if [[ ! -f "$DIR/.env" ]] || [[ ! -s "$DIR/.env" ]]; then
    warn ".env was lost during pull — restoring from backup..."
    cp "$BACKUP_DIR/.env" "$DIR/.env"
    ok ".env restored from backup."
fi

NEW_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "unknown")
ok "Updated: ${OLD_VERSION} → ${NEW_VERSION}"
echo ""

# ── Ensure SSL vars are in .env ───────────────────────────────
# Never overwrite existing SSL settings — only add if missing
if ! grep -q "^SSL_MODE=" "$DIR/.env" 2>/dev/null; then
    if [[ -f "$DIR/ssl/serverctl.crt" && -f "$DIR/ssl/serverctl.key" ]]; then
        info "Detected SSL certs but missing SSL_MODE in .env — adding..."
        cat >> "$DIR/.env" << EOF
SSL_MODE=selfsigned
SSL_CERT_PATH=./ssl/serverctl.crt
SSL_KEY_PATH=./ssl/serverctl.key
SSL_FRONTEND_CONTAINER_PORT=443
EOF
        ok "SSL settings added to .env"
    elif [[ -f /etc/nginx/ssl/serverctl.crt ]]; then
        info "Detected native SSL certs but missing SSL_MODE in .env — adding..."
        echo "SSL_MODE=selfsigned" >> "$DIR/.env"
        ok "SSL_MODE added to .env"
    else
        echo "SSL_MODE=none" >> "$DIR/.env"
    fi
fi

# Ensure Docker SSL path vars exist when SSL is enabled
SSL_MODE_VAL=$(grep "^SSL_MODE=" "$DIR/.env" | cut -d'=' -f2)
if [[ "$SSL_MODE_VAL" == "selfsigned" ]]; then
    if ! grep -q "^SSL_CERT_PATH=" "$DIR/.env" 2>/dev/null; then
        info "Adding missing SSL path vars to .env..."
        cat >> "$DIR/.env" << EOF
SSL_CERT_PATH=./ssl/serverctl.crt
SSL_KEY_PATH=./ssl/serverctl.key
SSL_FRONTEND_CONTAINER_PORT=443
EOF
        ok "SSL path vars added to .env"
    fi
    # Regenerate self-signed cert if missing
    if [[ ! -f "$DIR/ssl/serverctl.crt" ]] || [[ ! -f "$DIR/ssl/serverctl.key" ]]; then
        HOST_IP=$(grep "^PUBLIC_HOST=" "$DIR/.env" | cut -d'=' -f2)
        [[ -z "$HOST_IP" ]] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        [[ -z "$HOST_IP" ]] && HOST_IP="localhost"
        mkdir -p "$DIR/ssl"
        info "Regenerating self-signed SSL certificate..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$DIR/ssl/serverctl.key" -out "$DIR/ssl/serverctl.crt" \
            -subj "/CN=${HOST_IP}/O=ServerCTL" \
            -addext "subjectAltName=IP:${HOST_IP}" 2>/dev/null \
            || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                -keyout "$DIR/ssl/serverctl.key" -out "$DIR/ssl/serverctl.crt" \
                -subj "/CN=${HOST_IP}/O=ServerCTL" 2>/dev/null
        ok "Self-signed certificate regenerated."
    fi
fi

# Ensure Docker SSL path vars exist when SSL is enabled
SSL_MODE_VAL=$(grep "^SSL_MODE=" "$DIR/.env" | cut -d'=' -f2)
if [[ "$SSL_MODE_VAL" == "selfsigned" ]]; then
    if ! grep -q "^SSL_CERT_PATH=" "$DIR/.env" 2>/dev/null; then
        info "Adding missing SSL path vars to .env..."
        cat >> "$DIR/.env" << EOF
SSL_CERT_PATH=./ssl/serverctl.crt
SSL_KEY_PATH=./ssl/serverctl.key
SSL_FRONTEND_CONTAINER_PORT=443
EOF
        ok "SSL path vars added to .env"
    fi
    # Regenerate self-signed cert if missing
    if [[ ! -f "$DIR/ssl/serverctl.crt" ]] || [[ ! -f "$DIR/ssl/serverctl.key" ]]; then
        HOST_IP=$(grep "^PUBLIC_HOST=" "$DIR/.env" | cut -d'=' -f2)
        [[ -z "$HOST_IP" ]] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        [[ -z "$HOST_IP" ]] && HOST_IP="localhost"
        mkdir -p "$DIR/ssl"
        info "Regenerating self-signed SSL certificate..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout "$DIR/ssl/serverctl.key" -out "$DIR/ssl/serverctl.crt" \
            -subj "/CN=${HOST_IP}/O=ServerCTL" \
            -addext "subjectAltName=IP:${HOST_IP}" 2>/dev/null \
            || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                -keyout "$DIR/ssl/serverctl.key" -out "$DIR/ssl/serverctl.crt" \
                -subj "/CN=${HOST_IP}/O=ServerCTL" 2>/dev/null
        ok "Self-signed certificate regenerated."
    fi
fi

# ── Docker update ─────────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
    # Load .env file so docker compose has all required variables
    set -a
    source "$DIR/.env"
    set +a
    info "Rebuilding Docker containers..."
    APP_VERSION="$NEW_VERSION" docker compose up --build -d || err "Docker build failed."
    ok "Docker containers rebuilt and running."
    info "Cleaning up old Docker images..."
    docker image prune -a -f --filter "until=24h" >/dev/null 2>&1
    ok "Unused images removed."
    echo ""
    ok "Update complete! (v${NEW_VERSION})"
    echo -e "  ${Y}Backup:${NC} $BACKUP_DIR"
    echo ""
    warn "Log out and log back in to the dashboard to refresh your session token."
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

# Fix ownership if running under sudo (git pull as user, rest as root)
if [[ -n "$SUDO_USER" ]]; then
    chown -R "$SUDO_USER:$(id -gn "$SUDO_USER")" "$DIR" 2>/dev/null
fi

# Write VERSION for backend
cp "$DIR/VERSION" "$DIR/backend/VERSION" 2>/dev/null || echo "$NEW_VERSION" > "$DIR/backend/VERSION"
cp "$DIR/agent-go/VERSION" "$DIR/backend/AGENT_VERSION" 2>/dev/null

# Frontend rebuild
if command -v npm >/dev/null 2>&1; then
    info "Rebuilding frontend..."
    cd "$DIR/frontend"

    # Read env from .env file
    DASHBOARD_TOKEN=$(grep '^DASHBOARD_TOKEN=' "$DIR/.env" | cut -d'=' -f2)

    # Run npm as the real user to avoid permission issues
    if [[ -n "$SUDO_USER" ]]; then
        su - "$SUDO_USER" -c "cd '$DIR/frontend' && npm install --silent 2>/dev/null && VITE_API_URL='' VITE_DASHBOARD_TOKEN='${DASHBOARD_TOKEN}' VITE_APP_VERSION='${NEW_VERSION}' npm run build" || err "Frontend build failed."
    else
        npm install --silent 2>/dev/null
        VITE_API_URL="" \
        VITE_DASHBOARD_TOKEN="${DASHBOARD_TOKEN}" \
        VITE_APP_VERSION="${NEW_VERSION}" \
            npm run build || err "Frontend build failed."
    fi
    ok "Frontend rebuilt."
    cd "$DIR"

    # Ensure nginx can read dist
    PARENT="$DIR"
    while [[ "$PARENT" != "/" ]]; do
        chmod o+x "$PARENT" 2>/dev/null
        PARENT="$(dirname "$PARENT")"
    done
    chmod -R o+r "$DIR/frontend/dist" 2>/dev/null
else
    warn "npm not found — skipping frontend rebuild."
fi

# ── Build agent binaries ─────────────────────────────────────
AGENT_VERSION=$(cat "$DIR/agent-go/VERSION" 2>/dev/null || echo "dev")
info "Building agent binaries (v${AGENT_VERSION})..."
AGENT_OUT="$DIR/agent-go/dist"
mkdir -p "$AGENT_OUT"
if command -v go >/dev/null 2>&1; then
    cd "$DIR/agent-go"
    GOOS=linux  GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o "$AGENT_OUT/serverctl-agent-linux-amd64"       .
    GOOS=linux  GOARCH=arm64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o "$AGENT_OUT/serverctl-agent-linux-arm64"       .
    GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${AGENT_VERSION}" -o "$AGENT_OUT/serverctl-agent-windows-amd64.exe" .
    cd "$DIR"
    ok "Agent binaries built with Go"
elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
        -v "$DIR/agent-go:/src" \
        -v "$AGENT_OUT:/out" \
        -w /src \
        golang:1.24-alpine sh -c "
            AGENT_VERSION=\$(cat VERSION 2>/dev/null || echo dev) && \
            GOOS=linux  GOARCH=amd64 go build -ldflags=\"-s -w -X main.agentVersion=\${AGENT_VERSION}\" -o /out/serverctl-agent-linux-amd64       . && \
            GOOS=linux  GOARCH=arm64 go build -ldflags=\"-s -w -X main.agentVersion=\${AGENT_VERSION}\" -o /out/serverctl-agent-linux-arm64       . && \
            GOOS=windows GOARCH=amd64 go build -ldflags=\"-s -w -X main.agentVersion=\${AGENT_VERSION}\" -o /out/serverctl-agent-windows-amd64.exe .
        "
    ok "Agent binaries built with Docker"
else
    warn "Neither Go nor Docker found — using existing agent binaries in agent-go/dist/"
fi

# Restart services
info "Restarting backend service..."
systemctl restart serverctl-backend 2>/dev/null
if systemctl is-active --quiet serverctl-backend 2>/dev/null; then
    ok "Backend restarted."
else
    warn "Backend may not have started. Check: journalctl -u serverctl