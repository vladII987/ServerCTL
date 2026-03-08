#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — Setup & Launch
# Supports: Docker mode or Native mode (Python venv + nginx)
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'; NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }
ask()  { echo -e "${W}[?]${NC} $1"; }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV="$DIR/.env"

echo ""
echo -e "${W}╔══════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}      ${B}ServerCTL — Setup & Launch${NC}           ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Select deployment mode ─────────────────────────────────────
echo -e "  Select deployment mode:"
echo -e "  ${W}1)${NC} Docker"
echo -e "  ${W}2)${NC} Native (Python venv + nginx, no Docker required)"
echo ""
read -rp "  Choice [1/2]: " MODE_CHOICE
case "$MODE_CHOICE" in
    1) MODE="docker" ;;
    2) MODE="native" ;;
    *) err "Unknown choice." ;;
esac
echo ""

# ── Select ports ───────────────────────────────────────────────
ask "Frontend port [8090]: "
read -rp "  → " FRONTEND_PORT_IN
FRONTEND_PORT="${FRONTEND_PORT_IN:-8090}"

ask "Backend port [8765]: "
read -rp "  → " BACKEND_PORT_IN
BACKEND_PORT="${BACKEND_PORT_IN:-8765}"

ok "Frontend port: ${FRONTEND_PORT}"
ok "Backend port:  ${BACKEND_PORT}"
echo ""

# ── openssl ────────────────────────────────────────────────────
command -v openssl >/dev/null 2>&1 || {
    info "Installing openssl..."
    apt-get install -y openssl -qq || err "Cannot install openssl."
}

# ── .env handling ──────────────────────────────────────────────
SKIP_GEN=false
if [[ -f "$ENV" ]]; then
    warn ".env already exists."
    echo -e "  ${W}1)${NC} Use existing .env"
    echo -e "  ${W}2)${NC} Generate new tokens"
    echo -e "  ${W}3)${NC} Cancel"
    echo ""
    read -rp "  Choice [1/2/3]: " C
    case "$C" in
        1) SKIP_GEN=true ;;
        2) SKIP_GEN=false ;;
        3) exit 0 ;;
        *) err "Unknown choice." ;;
    esac
fi

echo ""

if [[ "$SKIP_GEN" == "false" ]]; then
    info "Generating tokens..."
    AGENT_TOKEN=$(openssl rand -hex 32)
    DASHBOARD_TOKEN=$(openssl rand -hex 32)
    SECRET_KEY=$(openssl rand -hex 32)
    ok "AGENT_TOKEN     = ${AGENT_TOKEN:0:16}..."
    ok "DASHBOARD_TOKEN = ${DASHBOARD_TOKEN:0:16}..."

    echo ""
    read -rp "  Prometheus URL [http://localhost:9090]: " PROM
    PROMETHEUS_URL="${PROM:-http://localhost:9090}"

    cat > "$ENV" << EOF
# ServerCTL — generated $(date "+%Y-%m-%d %H:%M:%S")
# DO NOT commit this file!

AGENT_TOKEN=${AGENT_TOKEN}
DASHBOARD_TOKEN=${DASHBOARD_TOKEN}
SECRET_KEY=${SECRET_KEY}
PROMETHEUS_URL=${PROMETHEUS_URL}
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
EOF
    ok ".env created"
    grep -q "^\.env$" "$DIR/.gitignore" 2>/dev/null || echo ".env" >> "$DIR/.gitignore"
fi

set -a; source "$ENV"; set +a
FRONTEND_PORT="${FRONTEND_PORT}"
BACKEND_PORT="${BACKEND_PORT}"

echo ""
info "Configuration:"
echo -e "  AGENT_TOKEN     = ${W}${AGENT_TOKEN:0:16}...${NC}"
echo -e "  DASHBOARD_TOKEN = ${W}${DASHBOARD_TOKEN:0:16}...${NC}"
echo -e "  PROMETHEUS_URL  = ${W}${PROMETHEUS_URL}${NC}"
echo -e "  Frontend port   = ${W}${FRONTEND_PORT}${NC}"
echo -e "  Backend port    = ${W}${BACKEND_PORT}${NC}"
echo ""

# ══════════════════════════════════════════════════════════════
# DOCKER MODE
# ══════════════════════════════════════════════════════════════
if [[ "$MODE" == "docker" ]]; then

    if ! command -v docker >/dev/null 2>&1; then
        warn "Docker is not installed. Installing..."

        # Sync system clock if out of sync (fixes apt 'not valid yet' errors)
        info "Syncing system clock..."
        timedatectl set-ntp true 2>/dev/null
        systemctl restart systemd-timesyncd 2>/dev/null
        # Wait up to 10s for sync
        for i in {1..10}; do
            if timedatectl status 2>/dev/null | grep -q "synchronized: yes"; then
                ok "Clock synchronized."
                break
            fi
            sleep 1
        done
        # Fallback: ntpdate
        if ! timedatectl status 2>/dev/null | grep -q "synchronized: yes"; then
            warn "NTP sync pending, trying ntpdate fallback..."
            if ! command -v ntpdate >/dev/null 2>&1; then
                apt-get install -y ntpdate -qq 2>/dev/null
            fi
            ntpdate pool.ntp.org 2>/dev/null && ok "Clock synced via ntpdate." || warn "Clock sync failed — continuing anyway."
        fi

        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -qq
            apt-get install -y ca-certificates curl gnupg lsb-release -qq || err "Failed to install prerequisites."
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
                | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update -qq
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin -qq \
                || err "Docker installation failed. If you see 'not valid yet' errors, your system clock may be out of sync. Run: sudo timedatectl set-ntp true && sudo systemctl restart systemd-timesyncd"
            systemctl enable docker --now || err "Failed to start Docker service."
        elif command -v yum >/dev/null 2>&1 || command -v dnf >/dev/null 2>&1; then
            PKG_MGR=$(command -v dnf || command -v yum)
            $PKG_MGR install -y yum-utils || err "Failed to install yum-utils."
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            $PKG_MGR install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin \
                || err "Docker installation failed."
            systemctl enable docker --now || err "Failed to start Docker service."
        else
            err "Cannot auto-install Docker. Install manually: https://docs.docker.com/engine/install/"
        fi
        command -v docker >/dev/null 2>&1 || err "Docker installation failed. Install manually: https://docs.docker.com/engine/install/"
        ok "Docker installed."
    else
        ok "Docker is available."
    fi

    if ! docker compose version >/dev/null 2>&1; then
        err "docker compose plugin not found. Install 'docker-compose-plugin'."
    fi

    # Ensure data files exist as files (not directories)
    [[ -f "$DIR/backend/servers.json" ]] || echo "[]" > "$DIR/backend/servers.json"
    [[ -f "$DIR/backend/users.json"   ]] || echo "[]" > "$DIR/backend/users.json"

    info "Running: docker compose up --build -d"
    echo ""
    cd "$DIR"
    FRONTEND_PORT="$FRONTEND_PORT" BACKEND_PORT="$BACKEND_PORT" docker compose up --build -d

    echo ""
    ok "All services started!"
    echo ""
    echo -e "  ${W}Dashboard:${NC}  http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT}"
    echo -e "  ${W}Backend:${NC}    http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}/health"
    echo -e "  ${W}Logs:${NC}       docker compose logs -f"
    echo -e "  ${W}Stop:${NC}       docker compose down"

fi

# ══════════════════════════════════════════════════════════════
# NATIVE MODE
# ══════════════════════════════════════════════════════════════
if [[ "$MODE" == "native" ]]; then

    _install_pkg() {
        if command -v apt-get >/dev/null 2>&1; then
            apt-get update -qq && apt-get install -y "$@" -qq
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y "$@"
        elif command -v yum >/dev/null 2>&1; then
            yum install -y "$@"
        else
            err "Unknown package manager. Install manually: $*"
        fi
    }

    # Python
    if ! command -v python3 >/dev/null 2>&1; then
        info "Installing Python3..."
        _install_pkg python3 python3-pip python3-venv
    else
        ok "Python3 available: $(python3 --version)"
    fi

    if ! python3 -m venv --help >/dev/null 2>&1; then
        info "Installing python3-venv..."
        _install_pkg python3-venv
    fi

    # Node.js / npm
    if ! command -v npm >/dev/null 2>&1; then
        info "Installing Node.js and npm..."
        if command -v apt-get >/dev/null 2>&1; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            _install_pkg nodejs
        else
            _install_pkg nodejs npm
        fi
    else
        ok "Node.js available: $(node --version)"
    fi

    # nginx
    if ! command -v nginx >/dev/null 2>&1; then
        info "Installing nginx..."
        _install_pkg nginx
    else
        ok "nginx available."
    fi

    # ── Python venv for backend ───────────────────────────────
    VENV="$DIR/backend/.venv"
    if [[ ! -d "$VENV" ]]; then
        info "Creating Python venv..."
        python3 -m venv "$VENV"
    fi
    info "Installing Python dependencies..."
    "$VENV/bin/pip" install -q --upgrade pip
    "$VENV/bin/pip" install -q -r "$DIR/backend/requirements.txt"
    ok "Backend dependencies installed."

    # ── Build frontend ────────────────────────────────────────
    info "Installing frontend dependencies (npm)..."
    cd "$DIR/frontend"
    npm install --silent

    info "Building frontend..."
    VITE_API_URL="http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}" \
    VITE_DASHBOARD_TOKEN="${DASHBOARD_TOKEN}" \
        npm run build -- --logLevel silent
    ok "Frontend built → frontend/dist/"

    # ── nginx config ──────────────────────────────────────────
    NGINX_CONF="/etc/nginx/sites-available/serverctl"
    info "Configuring nginx (port ${FRONTEND_PORT} → frontend, /api/ and /ws/ → :${BACKEND_PORT})..."
    cat > "$NGINX_CONF" << NGINXEOF
server {
    listen ${FRONTEND_PORT};
    server_name _;

    root ${DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600;
    }
}
NGINXEOF

    rm -f /etc/nginx/sites-enabled/default
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/serverctl

    nginx -t && systemctl reload nginx || err "nginx config is invalid."
    ok "nginx configured and reloaded."

    # ── systemd service for backend ───────────────────────────
    SVCFILE="/etc/systemd/system/serverctl-backend.service"
    info "Creating systemd service for backend..."
    cat > "$SVCFILE" << SVCEOF
[Unit]
Description=ServerCTL Backend
After=network.target

[Service]
WorkingDirectory=${DIR}/backend
Environment="BACKEND_PORT=${BACKEND_PORT}"
Environment="AGENT_TOKEN=${AGENT_TOKEN}"
Environment="DASHBOARD_TOKEN=${DASHBOARD_TOKEN}"
Environment="SECRET_KEY=${SECRET_KEY}"
Environment="PROMETHEUS_URL=${PROMETHEUS_URL}"
Environment="CORS_ORIGINS=http://localhost,http://localhost:${FRONTEND_PORT},http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT}"
ExecStart=${VENV}/bin/python -m uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable serverctl-backend --now
    ok "serverctl-backend service started."

    sleep 2
    if systemctl is-active --quiet serverctl-backend; then
        ok "Backend running on port ${BACKEND_PORT}."
    else
        warn "Backend may not have started. Check: journalctl -u serverctl-backend -n 30"
    fi

    echo ""
    ok "Setup complete!"
    echo ""
    echo -e "  ${W}Dashboard:${NC}   http://$(hostname -I | awk '{print $1}'):${FRONTEND_PORT}"
    echo -e "  ${W}Backend:${NC}     http://$(hostname -I | awk '{print $1}'):${BACKEND_PORT}/health"
    echo -e "  ${W}Backend log:${NC} journalctl -u serverctl-backend -f"
    echo -e "  ${W}Stop:${NC}        systemctl stop serverctl-backend"
    echo -e "  ${W}Restart:${NC}     systemctl restart serverctl-backend"

fi

echo ""
echo -e "  ${Y}Default login: admin / admin — change it immediately!${NC}"
echo ""
