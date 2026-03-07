#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — First Time Setup
# Generates tokens, creates .env, starts Docker.
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────
set -e

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'; NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV="$DIR/.env"

echo ""
echo -e "${W}╔══════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}      ${B}ServerCTL — Setup & Launch${NC}           ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════╝${NC}"
echo ""

command -v docker  >/dev/null 2>&1 || err "Docker is not installed."
command -v openssl >/dev/null 2>&1 || err "openssl not found."

# ── If .env already exists ────────────────────────────────────
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

# ── Generate tokens ───────────────────────────────────────────
if [[ "$SKIP_GEN" == "false" ]]; then
    info "Generating tokens..."
    AGENT_TOKEN=$(openssl rand -hex 32)
    DASHBOARD_TOKEN=$(openssl rand -hex 32)
    SECRET_KEY=$(openssl rand -hex 32)
    ok "AGENT_TOKEN     = ${AGENT_TOKEN:0:16}..."
    ok "DASHBOARD_TOKEN = ${DASHBOARD_TOKEN:0:16}..."
    ok "SECRET_KEY      = ${SECRET_KEY:0:16}..."

    echo ""
    read -rp "  Prometheus URL [http://localhost:9090]: " PROM
    PROMETHEUS_URL="${PROM:-http://localhost:9090}"
    read -rp "  Frontend port [80]: " PORT
    FRONTEND_PORT="${PORT:-80}"

    cat > "$ENV" << EOF
# ServerCTL — generated $(date "+%Y-%m-%d %H:%M:%S")
# DO NOT commit this file!

AGENT_TOKEN=${AGENT_TOKEN}
DASHBOARD_TOKEN=${DASHBOARD_TOKEN}
SECRET_KEY=${SECRET_KEY}
PROMETHEUS_URL=${PROMETHEUS_URL}
FRONTEND_PORT=${FRONTEND_PORT}
EOF
    ok ".env created"

    # Add .env to .gitignore
    GITIGNORE="$DIR/.gitignore"
    grep -q "^\.env$" "$GITIGNORE" 2>/dev/null || echo ".env" >> "$GITIGNORE"
    ok ".env added to .gitignore"
fi

# ── Load and display ───────────────────────────────────────────
set -a; source "$ENV"; set +a
echo ""
info "Configuration:"
echo -e "  AGENT_TOKEN     = ${W}${AGENT_TOKEN:0:16}...${NC}"
echo -e "  DASHBOARD_TOKEN = ${W}${DASHBOARD_TOKEN:0:16}...${NC}"
echo -e "  PROMETHEUS_URL  = ${W}${PROMETHEUS_URL}${NC}"
echo -e "  FRONTEND_PORT   = ${W}${FRONTEND_PORT:-80}${NC}"
echo ""

# ── Docker ────────────────────────────────────────────────────
info "Running: docker compose up --build -d"
echo ""
cd "$DIR"
docker compose up --build -d

echo ""
ok "All services started!"
echo ""
echo -e "  ${W}Dashboard:${NC}  http://localhost:${FRONTEND_PORT:-80}"
echo -e "  ${W}Backend:${NC}    http://localhost:9090/health"
echo -e "  ${W}Logs:${NC}       docker compose logs -f"
echo -e "  ${W}Stop:${NC}       docker compose down"
echo ""
echo -e "  ${Y}Default login: admin / admin — change immediately!${NC}"
echo ""
