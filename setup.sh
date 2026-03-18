#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — Setup & Launch
# Supports: Docker mode or Linux native install (Ubuntu/Debian/CentOS/Fedora)
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'; NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }
ask()  { echo -e "${W}[?]${NC} $1"; }

wait_for_apt() {
    local max=60 i=0
    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
        if [ $i -eq 0 ]; then info "Waiting for apt lock (unattended-upgrades)..."; fi
        sleep 5; i=$((i+1))
        if [ $i -ge $max ]; then err "apt lock held for over 5 minutes — aborting."; fi
    done
}

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
echo -e "  ${W}2)${NC} Linux native install (Ubuntu/Debian/CentOS/Fedora, no Docker)"
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
    if command -v apt-get >/dev/null 2>&1; then
        wait_for_apt; apt-get install -y openssl -qq || err "Cannot install openssl."
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y openssl -q || err "Cannot install openssl."
    elif command -v yum >/dev/null 2>&1; then
        yum install -y openssl -q || err "Cannot install openssl."
    else
        err "Cannot install openssl — unknown package manager."
    fi
}

# ── .env handling ──────────────────────────────────────────────
SKIP_GEN=false
WIPE_DB=false
if [[ -f "$ENV" ]]; then
    warn ".env already exists."
    echo -e "  ${W}1)${NC} Use existing .env  (update/restart — keeps all data)"
    echo -e "  ${W}2)${NC} Generate new tokens (fresh install — optionally wipe database)"
    echo -e "  ${W}3)${NC} Cancel"
    echo ""
    read -rp "  Choice [1/2/3]: " C
    case "$C" in
        1) SKIP_GEN=true ;;
        2) SKIP_GEN=false ;;
        3) exit 0 ;;
        *) err "Unknown choice." ;;
    esac

    if [[ "$SKIP_GEN" == "false" ]]; then
        DB="$DIR/data/serverctl.db"
        if [[ -f "$DB" ]]; then
            echo ""
            warn "Existing database found (servers, users)."
            echo -e "  ${W}1)${NC} Keep existing data"
            echo -e "  ${W}2)${NC} Wipe database (true fresh install)"
            echo ""
            read -rp "  Choice [1/2]: " DC
            case "$DC" in
                2) WIPE_DB=true ;;
                *) WIPE_DB=false ;;
            esac
        fi
    fi
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

    # Auto-detect host LAN IP
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -z "$HOST_IP" ] && HOST_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
    [ -z "$HOST_IP" ] && HOST_IP="localhost"

    cat > "$ENV" << EOF
# ServerCTL — generated $(date "+%Y-%m-%d %H:%M:%S")
# DO NOT commit this file!

AGENT_TOKEN=${AGENT_TOKEN}
DASHBOARD_TOKEN=${DASHBOARD_TOKEN}
SECRET_KEY=${SECRET_KEY}
PROMETHEUS_URL=${PROMETHEUS_URL}
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
PUBLIC_HOST=${HOST_IP}
EOF
    ok ".env created"
    grep -q "^\.env$" "$DIR/.gitignore" 2>/dev/null || echo ".env" >> "$DIR/.gitignore"

    # Wipe database if user requested a true fresh install
    if [[ "$WIPE_DB" == "true" ]]; then
        rm -f "$DIR/data/serverctl.db" "$DIR/data/serverctl.db-shm" "$DIR/data/serverctl.db-wal"
        ok "Database wiped — starting fresh."
    fi

    # If a database already exists, rehash the admin password with the new SECRET_KEY
    # so admin/admin always works after a fresh token generation
    DB="$DIR/data/serverctl.db"
    if [[ -f "$DB" ]] && command -v python3 >/dev/null 2>&1; then
        python3 - <<PYEOF 2>/dev/null
import hashlib, sqlite3
secret = '${SECRET_KEY}'
pw_hash = hashlib.sha256(('admin' + secret).encode()).hexdigest()
conn = sqlite3.connect('${DB}')
conn.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (pw_hash,))
conn.commit()
conn.close()
PYEOF
        ok "Admin password rehashed with new SECRET_KEY (admin/admin)"
    fi
fi

set -a; source "$ENV"; set +a
FRONTEND_PORT="${FRONTEND_PORT}"
BACKEND_PORT="${BACKEND_PORT}"

# Ensure HOST_IP is always set (even when reusing existing .env)
HOST_IP="${PUBLIC_HOST:-}"
[ -z "$HOST_IP" ] && HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$HOST_IP" ] && HOST_IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$HOST_IP" ] && HOST_IP="localhost"

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
                if command -v apt-get >/dev/null 2>&1; then
                    wait_for_apt; apt-get install -y ntpdate -qq 2>/dev/null
                elif command -v dnf >/dev/null 2>&1; then
                    dnf install -y ntpdate -q 2>/dev/null
                elif command -v yum >/dev/null 2>&1; then
                    yum install -y ntpdate -q 2>/dev/null
                fi
            fi
            ntpdate pool.ntp.org 2>/dev/null && ok "Clock synced via ntpdate." || warn "Clock sync failed — continuing anyway."
        fi

        if command -v apt-get >/dev/null 2>&1; then
            wait_for_apt
            apt-get update -qq
            wait_for_apt
            apt-get install -y ca-certificates curl gnupg lsb-release -qq || err "Failed to install prerequisites."
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
                | tee /etc/apt/sources.list.d/docker.list > /dev/null
            wait_for_apt
            apt-get update -qq
            wait_for_apt
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
    mkdir -p "$DIR/data"
    [[ -f "$DIR/backend/servers.json" ]] || echo '{"servers":[]}' > "$DIR/backend/servers.json"
    [[ -f "$DIR/backend/users.json"   ]] || echo '[]'             > "$DIR/backend/users.json"

    APP_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "dev")
    info "Running: docker compose up --build -d (v${APP_VERSION})"
    echo ""
    cd "$DIR"
    FRONTEND_PORT="$FRONTEND_PORT" BACKEND_PORT="$BACKEND_PORT" APP_VERSION="$APP_VERSION" docker compose up --build -d

    echo ""
    ok "All services started!"
    echo ""
    echo -e "  ${W}Dashboard:${NC}  http://${HOST_IP}:${FRONTEND_PORT}"
    echo -e "  ${W}Backend:${NC}    http://${HOST_IP}:${BACKEND_PORT}/health"
    echo -e "  ${W}Logs:${NC}       docker compose logs -f"
    echo -e "  ${W}Stop:${NC}       docker compose down"

fi

# ══════════════════════════════════════════════════════════════
# NATIVE MODE
# ══════════════════════════════════════════════════════════════
if [[ "$MODE" == "native" ]]; then

    APP_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "dev")

    _install_pkg() {
        if command -v apt-get >/dev/null 2>&1; then
            wait_for_apt && apt-get update -qq && wait_for_apt && apt-get install -y "$@" -qq
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y "$@"
        elif command -v yum >/dev/null 2>&1; then
            yum install -y "$@"
        else
            err "Unknown package manager. Install manually: $*"
        fi
    }

    # ── Sync system clock ─────────────────────────────────────
    info "Syncing system clock..."
    timedatectl set-ntp true 2>/dev/null
    systemctl restart systemd-timesyncd 2>/dev/null
    for i in {1..10}; do
        if timedatectl status 2>/dev/null | grep -q "synchronized: yes"; then
            ok "Clock synchronized."
            break
        fi
        sleep 1
    done
    if ! timedatectl status 2>/dev/null | grep -q "synchronized: yes"; then
        warn "NTP sync pending, trying ntpdate fallback..."
        if ! command -v ntpdate >/dev/null 2>&1; then
            _install_pkg ntpdate 2>/dev/null
        fi
        ntpdate pool.ntp.org 2>/dev/null && ok "Clock synced via ntpdate." || warn "Clock sync failed — continuing anyway."
    fi

    # ── Prerequisites ─────────────────────────────────────────
    # Python
    if ! command -v python3 >/dev/null 2>&1; then
        info "Installing Python3..."
        _install_pkg python3
    else
        ok "Python3 available: $(python3 --version)"
    fi

    # Always ensure pip and venv packages are installed
    info "Ensuring python3-pip and python3-venv..."
    if command -v apt-get >/dev/null 2>&1; then
        _install_pkg python3-pip python3-venv
    else
        _install_pkg python3-pip python3-libs
    fi

    # curl
    if ! command -v curl >/dev/null 2>&1; then
        info "Installing curl..."
        _install_pkg curl
    fi

    # Node.js / npm
    if ! command -v npm >/dev/null 2>&1; then
        info "Installing Node.js and npm..."
        if command -v apt-get >/dev/null 2>&1; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
            _install_pkg nodejs
        elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
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

    # FreeRDP + TigerVNC (for RDP bridge)
    info "Ensuring FreeRDP and TigerVNC for RDP support..."
    if command -v apt-get >/dev/null 2>&1; then
        _install_pkg freerdp2-x11 tigervnc-standalone-server \
            libx11-6 libxext6 libxinerama1 libxcursor1 libxv1 \
            libxkbfile1 libxrandr2 libxi6 libxrender1 libxfixes3 \
            dbus-x11 xfonts-base
    elif command -v dnf >/dev/null 2>&1; then
        _install_pkg freerdp tigervnc-server xorg-x11-fonts-base dbus-x11
    elif command -v yum >/dev/null 2>&1; then
        _install_pkg freerdp tigervnc-server xorg-x11-fonts-base dbus-x11
    fi
    command -v xfreerdp >/dev/null 2>&1 && ok "xfreerdp available." || warn "xfreerdp not found — RDP will not work."
    command -v Xtigervnc >/dev/null 2>&1 && ok "Xtigervnc available." || warn "Xtigervnc not found — RDP will not work."

    # ── Ensure data files ─────────────────────────────────────
    mkdir -p "$DIR/data"
    [[ -f "$DIR/backend/servers.json" ]] || echo '{"servers":[]}' > "$DIR/backend/servers.json"
    [[ -f "$DIR/backend/users.json"   ]] || echo '[]'             > "$DIR/backend/users.json"

    # ── Write VERSION file for backend ────────────────────────
    echo "$APP_VERSION" > "$DIR/backend/VERSION"

    # ── Python venv for backend ───────────────────────────────
    VENV="$DIR/backend/.venv"
    if [[ ! -d "$VENV" ]] || [[ ! -f "$VENV/bin/pip" ]]; then
        info "Creating Python venv..."
        rm -rf "$VENV"
        python3 -m venv "$VENV" || {
            warn "venv creation failed, installing ensurepip..."
            _install_pkg python3-pip
            python3 -m venv "$VENV" || err "Failed to create Python venv."
        }
    fi
    # Ensure pip exists inside the venv
    if [[ ! -f "$VENV/bin/pip" ]]; then
        info "Bootstrapping pip in venv..."
        "$VENV/bin/python3" -m ensurepip --upgrade 2>/dev/null || {
            _install_pkg python3-pip
            "$VENV/bin/python3" -m ensurepip --upgrade || err "Cannot install pip in venv."
        }
    fi
    info "Installing Python dependencies..."
    "$VENV/bin/pip" install -q --upgrade pip
    "$VENV/bin/pip" install -q -r "$DIR/backend/requirements.txt"
    ok "Backend dependencies installed."

    # ── Build frontend ────────────────────────────────────────
    info "Installing frontend dependencies (npm)..."
    cd "$DIR/frontend"
    npm install --silent

    # Download noVNC ESM source (npm package ships broken CJS, need raw ESM from GitHub)
    if [[ ! -d "$DIR/frontend/src/novnc" ]]; then
        info "Downloading noVNC ESM source..."
        curl -sL https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz -o /tmp/novnc.tar.gz
        tar -xzf /tmp/novnc.tar.gz -C /tmp
        cp -r /tmp/noVNC-1.5.0/core "$DIR/frontend/src/novnc"
        cp -r /tmp/noVNC-1.5.0/vendor "$DIR/frontend/src/vendor"
        rm -rf /tmp/novnc.tar.gz /tmp/noVNC-1.5.0
        ok "noVNC ESM source downloaded."
    else
        ok "noVNC source already present."
    fi

    info "Building frontend (v${APP_VERSION})..."
    VITE_API_URL="" \
    VITE_DASHBOARD_TOKEN="${DASHBOARD_TOKEN}" \
    VITE_APP_VERSION="${APP_VERSION}" \
        npm run build -- --logLevel silent
    ok "Frontend built → frontend/dist/"
    cd "$DIR"

    # ── nginx config ──────────────────────────────────────────
    # Support both sites-available (Debian/Ubuntu) and conf.d (RHEL/Alpine)
    if [[ -d /etc/nginx/sites-available ]]; then
        NGINX_CONF="/etc/nginx/sites-available/serverctl"
        NGINX_LINK="/etc/nginx/sites-enabled/serverctl"
    else
        NGINX_CONF="/etc/nginx/conf.d/serverctl.conf"
        NGINX_LINK=""
    fi

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
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 120;
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

    if [[ -d /etc/nginx/sites-enabled ]]; then
        rm -f /etc/nginx/sites-enabled/default
        ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/serverctl
    fi

    # Ensure nginx can traverse to the frontend dist directory
    PARENT="$DIR"
    while [[ "$PARENT" != "/" ]]; do
        chmod o+x "$PARENT" 2>/dev/null
        PARENT="$(dirname "$PARENT")"
    done
    chmod -R o+r "$DIR/frontend/dist" 2>/dev/null

    nginx -t 2>&1 || err "nginx config is invalid."
    systemctl enable nginx 2>/dev/null
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || systemctl restart nginx || err "Failed to reload nginx."
    else
        systemctl start nginx || err "Failed to start nginx."
    fi
    ok "nginx configured and running."

    # ── Python venv for rdpbridge ─────────────────────────────
    RDPVENV="$DIR/rdpbridge/.venv"
    if [[ ! -d "$RDPVENV" ]] || [[ ! -f "$RDPVENV/bin/pip" ]]; then
        info "Creating Python venv for rdpbridge..."
        rm -rf "$RDPVENV"
        python3 -m venv "$RDPVENV" || err "Failed to create rdpbridge venv."
    fi
    "$RDPVENV/bin/pip" install -q --upgrade pip
    "$RDPVENV/bin/pip" install -q "websockets>=13.0"
    ok "RDP bridge dependencies installed."

    # ── systemd service for rdpbridge ─────────────────────────
    RDPSVC="/etc/systemd/system/serverctl-rdpbridge.service"
    info "Creating systemd service for rdpbridge..."
    cat > "$RDPSVC" << RDPSVCEOF
[Unit]
Description=ServerCTL RDP Bridge (FreeRDP + TigerVNC)
After=network.target

[Service]
WorkingDirectory=${DIR}/rdpbridge
Environment="MANAGER_PORT=8080"
ExecStart=${RDPVENV}/bin/python manager.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
RDPSVCEOF

    # ── systemd service for backend ───────────────────────────
    SVCFILE="/etc/systemd/system/serverctl-backend.service"
    info "Creating systemd service for backend..."
    cat > "$SVCFILE" << SVCEOF
[Unit]
Description=ServerCTL Backend
After=network.target serverctl-rdpbridge.service

[Service]
WorkingDirectory=${DIR}/backend
Environment="BACKEND_PORT=${BACKEND_PORT}"
Environment="AGENT_TOKEN=${AGENT_TOKEN}"
Environment="DASHBOARD_TOKEN=${DASHBOARD_TOKEN}"
Environment="SECRET_KEY=${SECRET_KEY}"
Environment="PROMETHEUS_URL=${PROMETHEUS_URL}"
Environment="CORS_ORIGINS=*"
Environment="AGENT_BINS_DIR=${DIR}/agent-go/dist"
Environment="PUBLIC_HOST=${PUBLIC_HOST:-${HOST_IP}}"
Environment="SERVERCTL_DB=${DIR}/data/serverctl.db"
Environment="RDPBRIDGE_HOST=127.0.0.1"
Environment="RDPBRIDGE_PORT=8080"
ExecStart=${VENV}/bin/python -m uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable serverctl-rdpbridge --now
    systemctl enable serverctl-backend --now
    ok "serverctl-rdpbridge service started."
    ok "serverctl-backend service started."

    sleep 2
    if systemctl is-active --quiet serverctl-rdpbridge; then
        ok "RDP bridge running on port 8080."
    else
        warn "RDP bridge may not have started. Check: journalctl -u serverctl-rdpbridge -n 30"
    fi
    if systemctl is-active --quiet serverctl-backend; then
        ok "Backend running on port ${BACKEND_PORT}."
    else
        warn "Backend may not have started. Check: journalctl -u serverctl-backend -n 30"
    fi

    echo ""
    ok "Setup complete (v${APP_VERSION})!"
    echo ""
    echo -e "  ${W}Dashboard:${NC}   http://${HOST_IP}:${FRONTEND_PORT}"
    echo -e "  ${W}Backend:${NC}     http://${HOST_IP}:${BACKEND_PORT}/health"
    echo -e "  ${W}Backend log:${NC} journalctl -u serverctl-backend -f"
    echo -e "  ${W}Stop:${NC}        systemctl stop serverctl-backend"
    echo -e "  ${W}Restart:${NC}     systemctl restart serverctl-backend"
    echo -e "  ${W}Update:${NC}      cd ${DIR} && git pull && bash setup.sh"

fi

echo ""
echo -e "  ${Y}Default login: admin / admin — change it immediately!${NC}"
echo ""
