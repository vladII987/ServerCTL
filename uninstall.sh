#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — Uninstall Script
# Supports: Docker mode and Linux native mode
# Usage: sudo bash uninstall.sh
# ─────────────────────────────────────────────────────────────────

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'
NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }
ask()  { echo -e "${W}[?]${NC} $1"; }

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${W}╔══════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}      ${R}ServerCTL — Uninstall${NC}               ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════╝${NC}"
echo ""

echo -e "  Select what was installed:"
echo -e "  ${W}1)${NC} Docker"
echo -e "  ${W}2)${NC} Linux native"
echo ""
read -rp "  Choice [1/2]: " MODE_CHOICE
case "$MODE_CHOICE" in
    1) MODE="docker" ;;
    2) MODE="native" ;;
    *) err "Unknown choice." ;;
esac

echo ""
warn "This will completely remove ServerCTL from this system."
read -rp "  Are you sure? [y/N]: " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
echo ""

# ── Docker uninstall ──────────────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
    info "Stopping and removing Docker containers..."
    if command -v docker >/dev/null 2>&1; then
        cd "$DIR"
        docker compose down --rmi local --volumes 2>/dev/null || docker-compose down --rmi local --volumes 2>/dev/null
        ok "Docker containers, images, and volumes removed."
    else
        warn "Docker not found, skipping container cleanup."
    fi

    # Remove .env
    if [[ -f "$DIR/.env" ]]; then
        rm -f "$DIR/.env"
        ok "Removed .env file."
    fi

    ok "Docker uninstall complete."
fi

# ── Native uninstall ──────────────────────────────────────────
if [[ "$MODE" == "native" ]]; then
    # Stop and remove backend service
    if [[ -f /etc/systemd/system/serverctl-backend.service ]]; then
        info "Stopping ServerCTL backend service..."
        systemctl stop serverctl-backend 2>/dev/null
        systemctl disable serverctl-backend 2>/dev/null
        rm -f /etc/systemd/system/serverctl-backend.service
        systemctl daemon-reload 2>/dev/null
        ok "Backend service removed."
    else
        warn "Backend service not found, skipping."
    fi

    # Remove nginx config
    info "Removing nginx configuration..."
    if [[ -f /etc/nginx/sites-available/serverctl ]]; then
        rm -f /etc/nginx/sites-enabled/serverctl
        rm -f /etc/nginx/sites-available/serverctl
        ok "Nginx site config removed."
    elif [[ -f /etc/nginx/conf.d/serverctl.conf ]]; then
        rm -f /etc/nginx/conf.d/serverctl.conf
        ok "Nginx conf.d config removed."
    else
        warn "Nginx config not found, skipping."
    fi

    # Reload nginx if still running
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx 2>/dev/null
        ok "Nginx reloaded."
    fi

    # Remove Python venv
    if [[ -d "$DIR/backend/.venv" ]]; then
        info "Removing Python virtual environment..."
        rm -rf "$DIR/backend/.venv"
        ok "Python venv removed."
    fi

    # Remove built frontend
    if [[ -d "$DIR/frontend/dist" ]]; then
        info "Removing frontend build..."
        rm -rf "$DIR/frontend/dist"
        ok "Frontend dist removed."
    fi

    # Remove node_modules
    if [[ -d "$DIR/frontend/node_modules" ]]; then
        info "Removing node_modules..."
        rm -rf "$DIR/frontend/node_modules"
        ok "node_modules removed."
    fi

    # Remove .env
    if [[ -f "$DIR/.env" ]]; then
        rm -f "$DIR/.env"
        ok "Removed .env file."
    fi

    # Remove generated VERSION in backend
    rm -f "$DIR/backend/VERSION" 2>/dev/null

    ok "Native uninstall complete."
fi

echo ""
ask "Delete ServerCTL project folder ($DIR)? [y/N]: "
read -rp "  → " DEL_DIR
if [[ "$DEL_DIR" =~ ^[Yy]$ ]]; then
    rm -rf "$DIR"
    ok "Project folder deleted."
    echo ""
    ok "ServerCTL has been fully removed."
else
    ok "Project folder kept. Services removed but source files remain."
fi
