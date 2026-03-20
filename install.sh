#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL — One-Line Installer
# Usage:  sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/vladII987/ServerCTL/main/install.sh)"
# ─────────────────────────────────────────────────────────────────

set -e

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'; NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
warn() { echo -e "${Y}[!]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }
ask()  { echo -e "${W}[?]${NC} $1"; }

echo ""
echo -e "${W}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}      ${B}ServerCTL — One-Line Installer${NC}              ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Must run as root ──────────────────────────────────────────
if [[ "$EUID" -ne 0 ]]; then
    err "Please run as root: sudo bash -c \"\$(curl -sSL https://raw.githubusercontent.com/vladII987/ServerCTL/main/install.sh)\""
fi

# ── Choose install location ───────────────────────────────────
DEFAULT_DIR="/opt/ServerCTL"
ask "Install directory [${DEFAULT_DIR}]: "
read -rp "  → " INSTALL_DIR_IN
INSTALL_DIR="${INSTALL_DIR_IN:-$DEFAULT_DIR}"

# ── Check if already installed ────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
    warn "ServerCTL already exists at ${INSTALL_DIR}"
    echo -e "  ${W}1)${NC} Update existing installation (git pull + setup)"
    echo -e "  ${W}2)${NC} Fresh install (removes existing and re-clones)"
    echo -e "  ${W}3)${NC} Cancel"
    echo ""
    read -rp "  Choice [1/2/3]: " EXIST_CHOICE
    case "$EXIST_CHOICE" in
        1)
            info "Updating existing installation..."
            cd "$INSTALL_DIR"
            git pull || err "git pull failed."
            ok "Repository updated."
            echo ""
            info "Running setup..."
            bash setup.sh
            exit 0
            ;;
        2)
            warn "Removing ${INSTALL_DIR}..."
            # Preserve .env and data if they exist
            if [[ -f "$INSTALL_DIR/.env" ]]; then
                mkdir -p /tmp/serverctl-backup
                cp "$INSTALL_DIR/.env" /tmp/serverctl-backup/.env 2>/dev/null
                cp -r "$INSTALL_DIR/data" /tmp/serverctl-backup/data 2>/dev/null
                ok "Backed up .env and data to /tmp/serverctl-backup/"
            fi
            rm -rf "$INSTALL_DIR"
            ;;
        3) exit 0 ;;
        *) err "Unknown choice." ;;
    esac
fi

# ── Install git if missing ────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
    info "Installing git..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y git -qq
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y git -q
    elif command -v yum >/dev/null 2>&1; then
        yum install -y git -q
    else
        err "Cannot install git — unknown package manager. Install git manually and re-run."
    fi
    command -v git >/dev/null 2>&1 || err "git installation failed."
    ok "git installed."
else
    ok "git available."
fi

# ── Install curl if missing ──────────────────────────────────
if ! command -v curl >/dev/null 2>&1; then
    info "Installing curl..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y curl -qq
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y curl -q
    elif command -v yum >/dev/null 2>&1; then
        yum install -y curl -q
    else
        err "Cannot install curl — unknown package manager."
    fi
    ok "curl installed."
fi

# ── Clone repository ─────────────────────────────────────────
REPO_URL="https://github.com/vladII987/ServerCTL.git"
info "Cloning ServerCTL to ${INSTALL_DIR}..."
mkdir -p "$(dirname "$INSTALL_DIR")"

if ! git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
    warn "Clone failed — repository may be private. Trying with authentication..."
    echo ""
    echo -e "  ${W}1)${NC} GitHub personal access token"
    echo -e "  ${W}2)${NC} GitHub username & password"
    echo -e "  ${W}3)${NC} Cancel"
    echo ""
    read -rp "  Choice [1/2/3]: " AUTH_CHOICE
    case "$AUTH_CHOICE" in
        1)
            ask "GitHub token: "
            read -rp "  → " GH_TOKEN
            [[ -z "$GH_TOKEN" ]] && err "No token provided."
            git clone "https://${GH_TOKEN}@github.com/vladII987/ServerCTL.git" "$INSTALL_DIR" \
                || err "Clone failed with token. Check that the token has repo access."
            ;;
        2)
            ask "GitHub username: "
            read -rp "  → " GH_USER
            ask "GitHub password/token: "
            read -rp "  → " GH_PASS
            [[ -z "$GH_USER" ]] && err "No username provided."
            git clone "https://${GH_USER}:${GH_PASS}@github.com/vladII987/ServerCTL.git" "$INSTALL_DIR" \
                || err "Clone failed with credentials."
            ;;
        3) exit 0 ;;
        *) err "Unknown choice." ;;
    esac
fi
ok "Repository cloned."

# ── Restore backup if exists ─────────────────────────────────
if [[ -f /tmp/serverctl-backup/.env ]]; then
    cp /tmp/serverctl-backup/.env "$INSTALL_DIR/.env"
    cp -r /tmp/serverctl-backup/data "$INSTALL_DIR/data" 2>/dev/null
    ok "Restored .env and data from backup."
    rm -rf /tmp/serverctl-backup
fi

# ── Run setup ─────────────────────────────────────────────────
cd "$INSTALL_DIR"
echo ""
info "Starting ServerCTL setup..."
echo ""
bash setup.sh
