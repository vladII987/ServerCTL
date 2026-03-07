#!/bin/bash
# Register servers via API and deploy agent via Ansible
#
# Usage:
#   bash register-and-deploy.sh hosts.txt [ansible_user] [--ask-pass]
#
# hosts.txt format (one per line):
#   192.168.1.201
#   192.168.1.202  web-server-01  production
#   192.168.1.203  db-server-01   database
#   # lines starting with # are ignored

set -e

HOSTS_FILE="${1:-hosts.txt}"
ANSIBLE_USER="${2:-administrator}"
EXTRA_ARGS="${@:3}"

BACKEND="http://192.168.1.100:9090"
SERVERS_JSON="$(dirname "$0")/backend/servers.json"
INVENTORY_OUT="$(dirname "$0")/inventory-generated"
WS_URL="ws://192.168.1.100:9090/ws/agent"

G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; R='\033[0;31m'; W='\033[1m'; NC='\033[0m'
ok()   { echo -e "${G}[✓]${NC} $1"; }
info() { echo -e "${B}[→]${NC} $1"; }
err()  { echo -e "${R}[✗]${NC} $1"; exit 1; }

[[ ! -f "$HOSTS_FILE" ]] && err "hosts.txt not found: $HOSTS_FILE"
command -v ansible-playbook >/dev/null 2>&1 || err "ansible-playbook not found"
command -v python3 >/dev/null 2>&1 || err "python3 not found"

echo ""
echo -e "${W}╔══════════════════════════════════════════╗${NC}"
echo -e "${W}║${NC}   ${B}ServerCTL — Bulk Register & Deploy${NC}      ${W}║${NC}"
echo -e "${W}╚══════════════════════════════════════════╝${NC}"
echo ""

info "Registering servers via backend API..."

python3 - "$HOSTS_FILE" "$SERVERS_JSON" << 'PYEOF'
import json, sys, secrets
from pathlib import Path

hosts_file = sys.argv[1]
servers_file = sys.argv[2]

# Load existing servers
data = json.loads(Path(servers_file).read_text()) if Path(servers_file).exists() else {"servers": []}
existing = {s["host"]: s for s in data["servers"]}

added = []
with open(hosts_file) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        ip = parts[0]
        name = parts[1] if len(parts) > 1 else ip
        group = parts[2] if len(parts) > 2 else "ansible-deploy"

        if ip in existing:
            print(f"  SKIP  {ip} (already registered, token preserved)")
            added.append(existing[ip])
            continue

        token = secrets.token_hex(32)
        s_id = ip.replace(".", "-")
        entry = {
            "id": s_id, "name": name, "host": ip, "group": group,
            "agent_url": f"http://{ip}:8080",
            "agent_token": token,
            "prometheus_instance": f"{ip}:9100",
            "tags": ["ansible"],
        }
        existing[ip] = entry
        added.append(entry)
        print(f"  ADD   {ip} ({name}) token: {token[:16]}...")

data["servers"] = list(existing.values())
Path(servers_file).write_text(json.dumps(data, indent=2, ensure_ascii=False))
print(f"\nTotal servers in registry: {len(data['servers'])}")
PYEOF

ok "Servers registered in servers.json"

info "Generating Ansible inventory..."
python3 gen-inventory.py -o "$INVENTORY_OUT" --user "$ANSIBLE_USER" --backend-host 192.168.1.100 2>/dev/null
ok "Inventory written to: $INVENTORY_OUT"

echo ""
info "Running Ansible deploy..."
echo ""

ansible-playbook -i "$INVENTORY_OUT" deploy-agent.yml $EXTRA_ARGS

echo ""
ok "Done! Restart backend to load new tokens:"
echo -e "  ${W}docker compose restart backend${NC}"
echo ""
