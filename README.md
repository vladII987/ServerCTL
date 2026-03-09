# ServerCTL

A self-hosted server management dashboard. Monitor, manage, and update your Linux servers from a single web interface — no VPN, no open inbound ports required.

![ServerCTL Logo](frontend/public/logo.png)

---

## Features

- **Real-time monitoring** — CPU, RAM, disk usage across all servers
- **Package updates** — view pending updates, run upgrades in bulk or per-server
- **Reboot management** — identify servers requiring reboot, selectively reboot with confirmation
- **SSH terminal** — browser-based SSH shell via WebSocket
- **Service management** — view running/failed systemd services
- **Logs viewer** — browse and tail log files remotely
- **Network scanner** — discover hosts on a subnet
- **User management** — role-based access (admin / user)
- **Dark/light mode**, custom branding (logo + title)
- **No inbound ports on managed servers** — agents connect outbound to the backend

---

## Architecture

```
Browser
  └── Frontend (React + Vite, served by nginx)
        └── Backend API (FastAPI)
              └── Agent WebSocket connections (one per managed server)
                    └── Agent (Python, runs on each managed server)
```

- **Frontend** — React SPA, no framework/router, inline styles
- **Backend** — FastAPI, manages agent WebSocket connections, proxies commands, stores server registry
- **Agent** — lightweight Python script, connects outbound via WebSocket, executes allowed commands, reports metrics

---

## Requirements

- Docker + Docker Compose (on the host running ServerCTL)
- Python 3.8+ (on each managed server, for the agent)
- Outbound connectivity from managed servers to the ServerCTL host on port 9090

---

## Quick Start

```bash
git clone https://github.com/youruser/serverctl-docker.git
cd serverctl-docker
bash setup.sh
```

`setup.sh` will:
1. Generate `AGENT_TOKEN` and `DASHBOARD_TOKEN` using `openssl rand`
2. Ask for Prometheus URL and frontend port
3. Write `.env`
4. Run `docker compose up --build -d`

Dashboard will be available at `http://<your-host>:<FRONTEND_PORT>` (default port 80).

---

## Manual Setup

```bash
cp .env.example .env
# Edit .env and fill in the values
docker compose up --build -d
```

### `.env` variables

| Variable | Description |
|---|---|
| `AGENT_TOKEN` | Shared secret — agents use this to authenticate with the backend |
| `DASHBOARD_TOKEN` | Legacy token-based login (fallback if no users exist) |
| `PROMETHEUS_URL` | Prometheus endpoint (optional, for metrics) |
| `FRONTEND_PORT` | Port to expose the dashboard on (default: `80`) |

> **Never commit `.env` to version control.** It is in `.gitignore` by default.

---

## Adding a Managed Server

1. Open the dashboard and go to **Servers**
2. Click **Add Server** and fill in the server details
3. Copy the generated install command
4. Run the install command on the target server as root:

```bash
curl -fsSL "http://<serverctl-host>:9090/api/agent/install?token=<token>" | sudo sh
```

The installer will:
- Create `/opt/serverctl-agent/agent.py`
- Write config to `/etc/serverctl/config.yml`
- Create and enable a `serverctl-agent` systemd service

The agent connects back to the backend automatically and the server appears online within seconds.

---

## Updating Agents

When the ServerCTL backend is updated, agents on managed servers may need to be updated to support new features.

From the dashboard:
- Go to **Updates** tab → click **Update All Agents**

Or per-server:
- **Manage** a server → **Actions** tab → **Update Agent**

This downloads the latest `agent.py` from the backend and restarts the agent service.

---

## Agent — Supported Commands

The agent only executes an explicit allowlist of commands. No arbitrary shell execution.

| Command | Description |
|---|---|
| `system_info` | `uname -a` |
| `disk_usage` | `df -h` |
| `memory` / `memory_info` | `free -h` |
| `cpu_info` | `lscpu` |
| `running_services` | `systemctl list-units --state=running` |
| `failed_services` | `systemctl list-units --state=failed` |
| `top_processes` | `ps aux --sort=-%cpu` |
| `netstat` | `ss -tulnp` |
| `docker_ps` | `docker ps -a` |
| `docker_images` | `docker images` |
| `update` | `apt-get update` / `dnf check-update` / etc. |
| `upgrade` | `apt-get upgrade -y` / `dnf upgrade -y` / etc. |
| `upgradable_packages` | List packages with available upgrades |
| `check_reboot` | Check if reboot is required |
| `reboot` | `shutdown -r +0` |
| `sysinfo_json` | Detailed system info as JSON |
| `update_agent` | Download latest agent from backend and restart |
| `ping` / `traceroute` / `nslookup` | Network diagnostics |
| `service_status` | `systemctl status <service>` |
| `list_logs` / `view_log` | Browse and read `/var/log/` files |
| `kill_process` | `kill -15 <pid>` |
| `repo_speedtest` | Test download speed from package repositories |

Supported package managers: `apt`, `dnf`, `yum`, `zypper` (auto-detected).

---

## User Management

Admin users can manage access via **Settings → User Management**.

| Role | Permissions |
|---|---|
| `admin` | Full access — add/delete servers, manage users, run upgrades, reboot |
| `user` | Read access + add servers, no delete, no upgrades |

Default admin credentials (first run, if no `users.json` exists): `admin` / `admin`

> Change the default password immediately after first login.

---

## Project Structure

```
serverctl-docker/
├── frontend/           # React app (Vite)
│   └── src/
│       └── Dashboard.jsx   # Main component (~3500 lines)
├── backend/            # FastAPI backend
│   ├── main.py         # API routes, WebSocket hub
│   ├── config.py       # Settings (pydantic-settings)
│   ├── users.py        # User management, token auth
│   ├── scanner.py      # Network scanner
│   └── requirements.txt
├── agent/              # Agent Docker image (for testing)
│   └── requirements.txt
├── agent.py            # Agent source served to managed servers
├── setup.sh            # First-time setup script
├── docker-compose.yml  # (or compose.yaml)
└── .env.example        # Environment template
```

---

## Docker Compose Services

| Service | Description | Default Port |
|---|---|---|
| `frontend` | nginx serving the React build | `80` (configurable) |
| `backend` | FastAPI + WebSocket server | `9090` (internal) |

---

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 9090

# Frontend
cd frontend
npm install
npm run dev
```

---

## Security Notes

- Agent tokens are per-server and stored in the backend registry
- `DASHBOARD_TOKEN` is a legacy fallback — prefer creating named users
- All agent commands go through an explicit allowlist — no shell injection possible
- HTTPS is not handled by ServerCTL itself — put it behind a reverse proxy (nginx, Caddy, Traefik) for production
- The backend port (9090) should not be exposed to the internet directly — only the frontend port needs to be public

---

## License

AGPL-3.0
