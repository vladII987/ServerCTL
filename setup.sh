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
ask "Frontend port [8443]: "
read -rp "  → " FRONTEND_PORT_IN
FRONTEND_PORT="${FRONTEND_PORT_IN:-8443}"

ask "Backend port [8765]: "
read -rp "  → " BACKEND_PORT_IN
BACKEND_PORT="${BACKEND_PORT_IN:-8765}"

ok "Frontend port: ${FRONTEND_PORT}"
ok "Backend port:  ${BACKEND_PORT}"
echo ""

# ── SSL / HTTPS ───────────────────────────────────────────────
echo -e "  ${W}Enable HTTPS? (enables clipboard in RDP sessions)${NC}"
echo -e "  ${W}1)${NC} No — plain HTTP"
echo -e "  ${W}2)${NC} Let's Encrypt (free, requires a public domain)"
echo -e "  ${W}3)${NC} Self-signed certificate (works without domain, browser will warn)"
echo ""
read -rp "  Choice [1/2/3]: " SSL_CHOICE
SSL_MODE="none"
SSL_DOMAIN=""
case "$SSL_CHOICE" in
    2)
        SSL_MODE="letsencrypt"
        echo ""
        read -rp "  Domain name (e.g. serverctl.example.com): " SSL_DOMAIN
        [[ -z "$SSL_DOMAIN" ]] && { warn "No domain provided, skipping SSL."; SSL_MODE="none"; }
        ;;
    3) SSL_MODE="selfsigned" ;;
    *) SSL_MODE="none" ;;
esac
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
SSL_MODE=${SSL_MODE}
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

# ── Always persist SSL settings in .env ────────────────────────
# This ensures rebuilds/restarts work without re-running setup
for _var in SSL_MODE SSL_CERT_PATH SSL_KEY_PATH SSL_FRONTEND_CONTAINER_PORT; do
    sed -i "/^${_var}=/d" "$ENV" 2>/dev/null
done
cat >> "$ENV" << EOF
SSL_MODE=${SSL_MODE}
EOF

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
        elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
            PKG_MGR=$(command -v dnf || command -v yum)
            # Detect distro: Fedora uses its own Docker repo, CentOS/RHEL use the centos repo
            if grep -qi "fedora" /etc/os-release 2>/dev/null; then
                DOCKER_REPO="https://download.docker.com/linux/fedora/docker-ce.repo"
            else
                DOCKER_REPO="https://download.docker.com/linux/centos/docker-ce.repo"
            fi
            $PKG_MGR install -y dnf-plugins-core 2>/dev/null || $PKG_MGR install -y yum-utils 2>/dev/null || true
            # dnf5 (Fedora 41+) uses "dnf config-manager addrepo --from-repofile=URL"
            # dnf4 and yum use "config-manager --add-repo URL"
            if dnf config-manager addrepo --help >/dev/null 2>&1; then
                dnf config-manager addrepo --from-repofile="$DOCKER_REPO" \
                    || err "Failed to add Docker repo."
            elif $PKG_MGR config-manager --add-repo "$DOCKER_REPO" 2>/dev/null; then
                true
            elif command -v yum-config-manager >/dev/null 2>&1; then
                yum-config-manager --add-repo "$DOCKER_REPO" \
                    || err "Failed to add Docker repo."
            else
                err "Failed to add Docker repo. Install Docker manually: https://docs.docker.com/engine/install/"
            fi
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

    # SELinux: allow containers to connect to network and manage ports
    if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" != "Disabled" ]; then
        info "SELinux detected — setting required booleans..."
        setsebool -P container_connect_any 1 2>/dev/null || true
        ok "SELinux booleans configured for Docker."
    fi

    # Ensure data files exist as files (not directories)
    mkdir -p "$DIR/data"
    [[ -f "$DIR/backend/servers.json" ]] || echo '{"servers":[]}' > "$DIR/backend/servers.json"
    [[ -f "$DIR/backend/users.json"   ]] || echo '[]'             > "$DIR/backend/users.json"

    APP_VERSION=$(cat "$DIR/VERSION" 2>/dev/null || echo "dev")

    # ── Docker SSL setup ───────────────────────────────────────
    SSL_CERT_PATH="/dev/null"
    SSL_KEY_PATH="/dev/null"
    SSL_FRONTEND_CONTAINER_PORT="80"
    if [[ "$SSL_MODE" == "selfsigned" ]]; then
        SSL_DIR="$DIR/ssl"
        mkdir -p "$SSL_DIR"
        if [[ ! -f "$SSL_DIR/serverctl.crt" ]] || [[ ! -f "$SSL_DIR/serverctl.key" ]]; then
            info "Generating self-signed SSL certificate..."
            openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                -keyout "$SSL_DIR/serverctl.key" -out "$SSL_DIR/serverctl.crt" \
                -subj "/CN=${HOST_IP}/O=ServerCTL" \
                -addext "subjectAltName=IP:${HOST_IP}" 2>/dev/null \
                || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                    -keyout "$SSL_DIR/serverctl.key" -out "$SSL_DIR/serverctl.crt" \
                    -subj "/CN=${HOST_IP}/O=ServerCTL" 2>/dev/null
            ok "Self-signed certificate created."
        fi
        SSL_CERT_PATH="$SSL_DIR/serverctl.crt"
        SSL_KEY_PATH="$SSL_DIR/serverctl.key"
        SSL_FRONTEND_CONTAINER_PORT="443"
    fi

    # Persist Docker SSL paths in .env so rebuilds work
    for _var in SSL_CERT_PATH SSL_KEY_PATH SSL_FRONTEND_CONTAINER_PORT; do
        sed -i "/^${_var}=/d" "$ENV" 2>/dev/null
    done
    cat >> "$ENV" << EOF
SSL_CERT_PATH=${SSL_CERT_PATH}
SSL_KEY_PATH=${SSL_KEY_PATH}
SSL_FRONTEND_CONTAINER_PORT=${SSL_FRONTEND_CONTAINER_PORT}
EOF

    info "Running: docker compose up --build -d (v${APP_VERSION})"
    echo ""
    cd "$DIR"
    APP_VERSION="$APP_VERSION" docker compose up --build -d

    echo ""
    ok "All services started!"
    echo ""
    if [[ "$SSL_MODE" == "selfsigned" ]]; then
        echo -e "  ${W}Dashboard:${NC}  https://${HOST_IP}:${FRONTEND_PORT}"
        echo -e "  ${Y}Note:${NC}       Browser will show a security warning — click Advanced → Proceed"
    else
        echo -e "  ${W}Dashboard:${NC}  http://${HOST_IP}:${FRONTEND_PORT}"
    fi
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
            wait_for_apt; apt-get update -qq 2>/dev/null || true; wait_for_apt && apt-get install -y "$@" -qq
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

    # Always ensure pip, venv and build tools are installed
    info "Ensuring python3-pip, python3-venv and build tools..."
    if command -v apt-get >/dev/null 2>&1; then
        _install_pkg python3-pip python3-venv build-essential
    elif command -v dnf >/dev/null 2>&1; then
        _install_pkg python3-pip python3-devel gcc gcc-c++ make
        # Fedora 41+ ships Python 3.13/3.14 — pin pydantic to versions with pre-built wheels
        # Ensure cc symlink exists for Rust/maturin builds
        if ! command -v cc >/dev/null 2>&1 && command -v gcc >/dev/null 2>&1; then
            ln -sf "$(command -v gcc)" /usr/local/bin/cc
        fi
    elif command -v yum >/dev/null 2>&1; then
        _install_pkg python3-pip python3-devel gcc gcc-c++ make
        if ! command -v cc >/dev/null 2>&1 && command -v gcc >/dev/null 2>&1; then
            ln -sf "$(command -v gcc)" /usr/local/bin/cc
        fi
    fi

    # curl
    if ! command -v curl >/dev/null 2>&1; then
        info "Installing curl..."
        _install_pkg curl
    fi

    # Node.js / npm
    if ! command -v npm >/dev/null 2>&1; then
        info "Installing Node.js and npm..."
        if command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
            PKG_MGR=$(command -v dnf || command -v yum)
            if $PKG_MGR list installed nodejs &>/dev/null; then
                ok "Node.js already available."
            else
                if command -v dnf >/dev/null 2>&1; then
                    dnf module reset nodejs -y 2>/dev/null
                    dnf module enable nodejs:20 -y 2>/dev/null || true
                    dnf install -y nodejs npm
                else
                    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                    $PKG_MGR install -y nodejs npm
                fi
            fi
        elif command -v apt-get >/dev/null 2>&1; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
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
    if command -v dnf >/dev/null 2>&1; then
        _install_pkg freerdp tigervnc-server xorg-x11-fonts-base dbus-x11 xorg-x11-server-Xvfb xauth
    elif command -v yum >/dev/null 2>&1; then
        _install_pkg freerdp tigervnc-server xorg-x11-fonts-base dbus-x11 xorg-x11-server-Xvfb xauth
    elif command -v apt-get >/dev/null 2>&1; then
        _install_pkg freerdp2-x11 tigervnc-standalone-server \
            libx11-6 libxext6 libxinerama1 libxcursor1 libxv1 \
            libxkbfile1 libxrandr2 libxi6 libxrender1 libxfixes3 \
            dbus-x11 xfonts-base xvfb
    fi
    command -v xfreerdp >/dev/null 2>&1 && ok "xfreerdp available." || warn "xfreerdp not found — RDP will not work."
    (command -v Xtigervnc >/dev/null 2>&1 || command -v Xvnc >/dev/null 2>&1 || command -v vncserver >/dev/null 2>&1) && ok "TigerVNC available." || warn "Xtigervnc/Xvnc not found — RDP will not work."

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

    # Fix ownership so non-root users can rebuild later
    REAL_USER="${SUDO_USER:-$USER}"
    if [[ -n "$REAL_USER" ]] && [[ "$REAL_USER" != "root" ]]; then
        chown -R "$REAL_USER":"$REAL_USER" "$DIR/frontend/node_modules" "$DIR/frontend/dist" 2>/dev/null || true
    fi
    cd "$DIR"

    # ── Build agent binaries ─────────────────────────────────────
    info "Building agent binaries (v${APP_VERSION})..."
    AGENT_OUT="$DIR/agent-go/dist"
    mkdir -p "$AGENT_OUT"
    if command -v go >/dev/null 2>&1; then
        cd "$DIR/agent-go"
        GOOS=linux  GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${APP_VERSION}" -o "$AGENT_OUT/serverctl-agent-linux-amd64"       .
        GOOS=linux  GOARCH=arm64 go build -ldflags="-s -w -X main.agentVersion=${APP_VERSION}" -o "$AGENT_OUT/serverctl-agent-linux-arm64"       .
        GOOS=windows GOARCH=amd64 go build -ldflags="-s -w -X main.agentVersion=${APP_VERSION}" -o "$AGENT_OUT/serverctl-agent-windows-amd64.exe" .
        cd "$DIR"
        ok "Agent binaries built with Go"
    elif command -v docker >/dev/null 2>&1; then
        docker run --rm \
            -v "$DIR/agent-go:/src" \
            -v "$AGENT_OUT:/out" \
            -w /src \
            golang:1.24-alpine sh -c "
                GOOS=linux  GOARCH=amd64 go build -ldflags='-s -w -X main.agentVersion=${APP_VERSION}' -o /out/serverctl-agent-linux-amd64       . && \
                GOOS=linux  GOARCH=arm64 go build -ldflags='-s -w -X main.agentVersion=${APP_VERSION}' -o /out/serverctl-agent-linux-arm64       . && \
                GOOS=windows GOARCH=amd64 go build -ldflags='-s -w -X main.agentVersion=${APP_VERSION}' -o /out/serverctl-agent-windows-amd64.exe .
            "
        ok "Agent binaries built with Docker"
    else
        warn "Neither Go nor Docker found — using existing agent binaries in agent-go/dist/"
    fi

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

    # ── SSL: generate certs if needed ──────────────────────────
    SSL_CERT=""
    SSL_KEY=""
    if [[ "$SSL_MODE" == "selfsigned" ]]; then
        SSL_DIR="/etc/nginx/ssl"
        mkdir -p "$SSL_DIR"
        SSL_CERT="$SSL_DIR/serverctl.crt"
        SSL_KEY="$SSL_DIR/serverctl.key"
        if [[ ! -f "$SSL_CERT" ]] || [[ ! -f "$SSL_KEY" ]]; then
            info "Generating self-signed SSL certificate..."
            openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                -keyout "$SSL_KEY" -out "$SSL_CERT" \
                -subj "/CN=${HOST_IP}/O=ServerCTL" \
                -addext "subjectAltName=IP:${HOST_IP}" 2>/dev/null \
                || openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
                    -keyout "$SSL_KEY" -out "$SSL_CERT" \
                    -subj "/CN=${HOST_IP}/O=ServerCTL" 2>/dev/null
            ok "Self-signed certificate created (valid 10 years)."
        else
            ok "Self-signed certificate already exists."
        fi
    elif [[ "$SSL_MODE" == "letsencrypt" ]]; then
        info "Installing certbot for Let's Encrypt..."
        if command -v apt-get >/dev/null 2>&1; then
            _install_pkg certbot python3-certbot-nginx
        elif command -v dnf >/dev/null 2>&1; then
            dnf install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            yum install -y certbot python3-certbot-nginx
        fi
        ok "Certbot installed."
    fi

    # ── Write nginx config ─────────────────────────────────────
    if [[ "$SSL_MODE" == "none" ]]; then
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
    elif [[ "$SSL_MODE" == "selfsigned" ]]; then
        cat > "$NGINX_CONF" << NGINXEOF
# Self-signed HTTPS
server {
    listen ${FRONTEND_PORT} ssl;
    server_name _;

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

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
    elif [[ "$SSL_MODE" == "letsencrypt" ]]; then
        # Write HTTP-only config first so certbot can verify
        cat > "$NGINX_CONF" << NGINXEOF
server {
    listen 80;
    server_name ${SSL_DOMAIN};

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
    fi

    if [[ -d /etc/nginx/sites-enabled ]]; then
        rm -f /etc/nginx/sites-enabled/default
        ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/serverctl
    fi

    # On RHEL/Fedora with conf.d, disable the default server block in nginx.conf
    # so it doesn't conflict with our config on port 80 or cause startup failures
    if [[ ! -d /etc/nginx/sites-available ]] && [[ -f /etc/nginx/nginx.conf ]]; then
        # Comment out the default server{} block inside nginx.conf if present
        if grep -q '^\s*server\s*{' /etc/nginx/nginx.conf 2>/dev/null; then
            info "Disabling default server block in /etc/nginx/nginx.conf..."
            # Backup original
            cp -n /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak 2>/dev/null
            # Use sed to comment out the server block inside http{}
            sed -i '/^\s*server\s*{/,/^\s*}/s/^/#/' /etc/nginx/nginx.conf 2>/dev/null
        fi
    fi

    # Ensure nginx can traverse to the frontend dist directory
    PARENT="$DIR"
    while [[ "$PARENT" != "/" ]]; do
        chmod o+x "$PARENT" 2>/dev/null
        PARENT="$(dirname "$PARENT")"
    done
    chmod -R o+r "$DIR/frontend/dist" 2>/dev/null

    # SELinux: allow nginx to connect to backend (for proxy_pass)
    if command -v setsebool >/dev/null 2>&1; then
        setsebool -P httpd_can_network_connect 1 2>/dev/null && ok "SELinux: httpd_can_network_connect enabled."
    fi

    nginx -t 2>&1 || err "nginx config is invalid."
    systemctl enable nginx 2>/dev/null
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx 2>/dev/null || systemctl restart nginx || err "Failed to reload nginx."
    else
        systemctl start nginx || err "Failed to start nginx."
    fi
    ok "nginx configured and running."

    # ── Let's Encrypt: run certbot after nginx is running ─────
    if [[ "$SSL_MODE" == "letsencrypt" ]]; then
        info "Obtaining Let's Encrypt certificate for ${SSL_DOMAIN}..."
        certbot --nginx -d "$SSL_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email \
            --redirect 2>&1 || {
            warn "Certbot failed. You can retry later with:"
            echo "  sudo certbot --nginx -d ${SSL_DOMAIN}"
        }
        # Certbot modifies the nginx config to add SSL and redirect
        # Inject WebSocket proxy settings if certbot overwrote them
        if ! grep -q "proxy_set_header Upgrade" "$NGINX_CONF" 2>/dev/null; then
            warn "Re-adding WebSocket config to nginx (certbot may have simplified it)..."
            # Certbot should preserve location blocks, but just in case
            nginx -t 2>&1 && systemctl reload nginx
        fi
        ok "Let's Encrypt SSL configured with auto-renewal."
    fi

    # ── Python venv for rdpbridge ─────────────────────────────
    RDPVENV="$DIR/rdpbridge/.venv"
    if [[ ! -d "$RDPVENV" ]] || [[ ! -f "$RDPVENV/bin/pip" ]]; then
        info "Creating Python venv for rdpbridge..."
        rm -rf "$RDPVENV"
        python3 -m venv "$RDPVENV" || err "Failed to create rdpbridge venv."
    fi
    "$RDPVENV/bin/pip" install -q --upgrade pip
    "$RDPVENV/bin/pip" install -q -r "$DIR/rdpbridge/requirements.txt"
    ok "RDP bridge dependencies installed."

    # Ensure FreeRDP config dirs exist (xfreerdp needs these when running as root)
    mkdir -p /root/.config/freerdp/certs /root/.config/freerdp/server

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
Environment="HOME=/root"
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
    if [[ "$SSL_MODE" == "letsencrypt" ]]; then
        echo -e "  ${W}Dashboard:${NC}   https://${SSL_DOMAIN}"
    elif [[ "$SSL_MODE" == "selfsigned" ]]; then
        echo -e "  ${W}Dashboard:${NC}   https://${HOST_IP}:${FRONTEND_PORT}"
        echo -e "  ${Y}Note:${NC}        Browser will show a security warning — click Advanced → Proceed"
    else
        echo -e "  ${W}Dashboard:${NC}   http://${HOST_IP}:${FRONTEND_PORT}"
    fi
    echo -e "  ${W}Backend:${NC}     http://${HOST_IP}:${BACKEND_PORT}/health"
    echo -e "  ${W}Backend log:${NC} journalctl -u serverctl-backend -f"
    echo -e "  ${W}Stop:${NC}        systemctl stop serverctl-backend"
    echo -e "  ${W}Restart:${NC}     systemctl restart serverctl-backend"
    echo -e "  ${W}Update:${NC}      cd ${DIR} && git pull && bash setup.sh"

fi

echo ""
echo -e "  ${Y}Default login: admin / admin — change it immediately!${NC}"
echo ""
