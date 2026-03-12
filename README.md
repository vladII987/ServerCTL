<p align="center">
  <img src="frontend/public/logo.png" alt="ServerCTL Logo" width="320"/>
</p>

<h1 align="center">ServerCTL</h1>

<p align="center">
  A self-hosted infrastructure management dashboard.<br/>
  Monitor, manage, and update your servers from a single web interface — no VPN, no inbound ports required.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-CC%20BY--ND%204.0-lightgrey.svg" alt="License"/>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/deploy-Docker%20Compose-2496ED" alt="Docker"/>
</p>

---

## Features

- **Real-time monitoring** — CPU, RAM, disk, uptime across all servers
- **Package updates** — view pending updates, run upgrades per-server or in bulk
- **Reboot management** — identify servers requiring reboot, reboot selectively with confirmation
- **SSH terminal** — browser-based SSH shell via WebSocket (Linux servers)
- **Service management** — start, stop, restart and inspect systemd / Windows services
- **Log viewer** — browse and read log files remotely (`/var/log/` on Linux, Event Log on Windows)
- **Probe Monitor** — test connectivity via Ping, TCP, UDP, HTTP, or DB port with per-result tooltips
- **Network scanner** — discover active hosts on any subnet
- **Speed test** — measure download speed to package repositories or CDN endpoints
- **Scheduled tasks** — run recurring commands on a cron schedule
- **Bulk actions** — upgrade, reboot, or update agents across multiple servers at once
- **User management** — role-based access control (admin / user)
- **Custom branding** — upload your own logo and set a custom dashboard title
- **Windows support** — full agent support for Windows servers (installed as a Windows Service via WinSW)
- **No inbound ports** — agents connect outbound to the backend over WebSocket

---

## Architecture

```
Browser
  └── Frontend  (React + Vite, served by nginx)
        └── Backend API  (FastAPI + Python)
              └── WebSocket hub
                    └── Agent  (Python, runs on each managed server)
```

- **Frontend** — React single-page app, Vite build, served by nginx, Hack monospace font
- **Backend** — FastAPI, manages agent WebSocket connections, proxies commands, stores server registry
- **Agent (Linux)** — lightweight Python script, runs as a systemd service, connects outbound
- **Agent (Windows)** — Python script, runs as a Windows Service (WinSW), connects outbound

---

## Requirements

- **Docker + Docker Compose** — on the host running ServerCTL
- **Python 3.8+** — on each managed Linux server (for the agent)
- **Outbound internet access** — managed servers must be able to reach the ServerCTL host on the backend port

No inbound firewall rules needed on managed servers.

---

## Quick Start

```bash
git clone https://github.com/vladII987/ServerCTL.git
cd ServerCTL
bash setup.sh
```

`setup.sh` will:
1. Generate `AGENT_TOKEN` and `DASHBOARD_TOKEN` automatically
2. Ask for your frontend port and optional Prometheus URL
3. Write `.env`
4. Run `docker compose up --build -d`

Dashboard will be available at:
```
http://<your-host>:<FRONTEND_PORT>
```
Default frontend port: **8090**. Default backend port: **8765**.

**Default credentials:** `admin` / `admin` — change immediately after first login.

---

## Manual Setup

```bash
cp .env.example .env
# Fill in the values
docker compose up --build -d
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_TOKEN` | ✅ | Shared secret used by agents to authenticate with the backend |
| `DASHBOARD_TOKEN` | ✅ | Legacy token-based login (fallback if no users exist) |
| `SECRET_KEY` | ✅ | JWT signing secret for session tokens |
| `BACKEND_PORT` | ❌ | Backend port (default: `8765`) |
| `FRONTEND_PORT` | ❌ | Frontend port (default: `8090`) |
| `PROMETHEUS_URL` | ❌ | Prometheus endpoint for metrics (optional) |
| `FRONTEND_URL` | ❌ | Public URL of the frontend (for CORS, optional) |

> **Never commit `.env` to version control.** It is in `.gitignore`.

---

## Adding a Managed Server

1. Open the dashboard → **Servers** → **+ Add Server**
2. Fill in server name, host/IP, and select OS (Linux or Windows)
3. Copy the generated install command
4. Run it on the target server

**Linux** (bash, run as root):
```bash
curl -fsSL "http://<serverctl-host>:<BACKEND_PORT>/api/agent/install?token=<TOKEN>&server_id=<ID>" | sudo sh
```

The installer will:
- Install Python dependencies
- Write agent script to `/opt/serverctl-agent/`
- Write config to `/etc/serverctl/config.yml`
- Create and enable a `serverctl-agent` **systemd service**

**Windows** (PowerShell, run as Administrator):
```powershell
iex (iwr -UseBasicParsing "http://<serverctl-host>:<BACKEND_PORT>/api/agent/install-windows?token=<TOKEN>&server_id=<ID>").Content
```

The installer will:
- Download embedded Python 3.11 portable to `C:\ServerCTL\python\`
- Install required packages
- Download agent script to `C:\ServerCTL\agent.py`
- Download WinSW and install agent as a **Windows Service** (`ServerCTL-Agent`)
- Service auto-starts on boot and restarts on failure — visible in `services.msc`

The agent appears online in the dashboard within seconds of installation.

---

## Updating Agents

When the ServerCTL backend is updated, agents on managed servers may need to be updated.

**Per-server:** Manage a server → **Actions** tab → **Update Agent**

**Bulk:** Select servers → **Bulk Actions** → **Update Agent**

---

## Agent — Supported Commands

Agents execute only an explicit allowlist of commands. No arbitrary shell execution is possible.

| Command | Description |
|---------|-------------|
| `system_info` | Basic system info (`uname -a`) |
| `disk_usage` | Disk space per partition (`df -h`) |
| `memory` | RAM and swap usage (`free -h`) |
| `cpu_info` | CPU details (`lscpu`) |
| `top_processes` | Processes sorted by CPU usage |
| `netstat` | Active network connections (`ss -tulnp`) |
| `running_services` | Running systemd / Windows services |
| `failed_services` | Failed systemd services |
| `docker_ps` | Running Docker containers |
| `docker_images` | Docker images |
| `update` | Refresh package index |
| `upgrade` | Full package upgrade |
| `upgradable_packages` | List packages with available upgrades |
| `check_reboot` | Check if reboot is required |
| `reboot` | Reboot the server |
| `update_agent` | Download latest agent and restart service |
| `ping_count` | ICMP ping to a target |
| `traceroute` | Traceroute to a target |
| `nslookup` | DNS lookup |
| `service_status` | Status of a specific service |
| `list_logs` | List available log files |
| `view_log` | Read a log file or Event Log |
| `kill_process` | Send SIGTERM to a process by PID |
| `repo_speedtest` | Test download speed to package repos / CDN |

Supported package managers: `apt`, `dnf`, `yum`, `zypper` (auto-detected).

---

## User Management

Manage users via **Settings → User Management** (admin only).

| Role | Permissions |
|------|-------------|
| `admin` | Full access — add/delete servers, manage users, run upgrades and reboots |
| `user` | Read access + add servers — no delete, no upgrades, no reboots |

---

## Project Structure

```
ServerCTL/
├── frontend/                 # React app (Vite)
│   ├── public/
│   │   └── logo.png          # Default logo
│   └── src/
│       └── Dashboard.jsx     # Main UI component
├── backend/                  # FastAPI backend
│   ├── main.py               # API routes, WebSocket hub, agent installer scripts
│   ├── config.py             # Settings (pydantic-settings)
│   ├── users.py              # User management, JWT auth
│   ├── scanner.py            # Network scanner
│   ├── ssh_handler.py        # SSH WebSocket proxy
│   ├── servers.json          # Server registry
│   └── requirements.txt
├── agent/
│   ├── agent.py              # Linux agent
│   └── agent_windows.py      # Windows agent
├── setup.sh                  # First-time setup script
├── docker-compose.yml
├── .env.example
├── DOCS.md                   # Full feature documentation
└── LICENSE                   # AGPL-3.0
```

---

## Docker Compose Services

| Service | Description | Default Port |
|---------|-------------|--------------|
| `frontend` | nginx serving the React build | `8090` |
| `backend` | FastAPI + WebSocket server | `8765` |

---

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8765

# Frontend
cd frontend
npm install
npm run dev
```

---

## Security Notes

- All agent commands go through an explicit allowlist — no shell injection possible
- Agent tokens are per-server and stored in the backend registry
- HTTPS is not handled by ServerCTL — use a reverse proxy (nginx, Caddy, Traefik) in production
- The backend port should not be exposed directly to the internet
- `DASHBOARD_TOKEN` is a legacy fallback — prefer named user accounts

---

## Documentation

Full documentation for all features, buttons, and controls: **[DOCS.md](DOCS.md)**

---

## License

License & Contributions: This project is licensed under CC BY-ND 4.0. It is free for everyone to use (including companies). However, to maintain the integrity of the tool, code modifications and redistributing altered versions are not allowed. I am the sole maintainer, but I welcome bug reports and feature suggestions!
