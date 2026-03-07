#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# ServerCTL - Ansible Deployment Helper
# Generates inventory from servers.json and runs ansible
# ─────────────────────────────────────────────────────────────────

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INV="$DIR/inventory"
SERVERS_JSON="$DIR/backend/servers.json"

echo ""
echo "ServerCTL - Ansible Deployment"
echo "=============================="
echo ""

if [[ ! -f "$SERVERS_JSON" ]]; then
    echo "Error: servers.json not found"
    exit 1
fi

if ! command -v ansible-playbook &> /dev/null; then
    echo "Error: ansible-playbook not installed"
    echo "Install: apt install ansible"
    exit 1
fi

echo "Generating inventory from servers.json..."
echo ""

cat > "$INV" << 'EOF'
[agents]
EOF

python3 -c "
import json
with open('$SERVERS_JSON') as f:
    data = json.load(f)
    for server in data.get('servers', []):
        host = server.get('host', '')
        token = server.get('agent_token', '')
        if host and token and token != 'REPLACE_WITH_TOKEN':
            print(f'{host} agent_token={token}')
" >> "$INV"

echo "Inventory created: $INV"
echo ""
cat "$INV"
echo ""

echo ""
read -p "Run ansible-playbook? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ansible-playbook -i "$INV" deploy-agent.yml
fi
