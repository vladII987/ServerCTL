<p align="center">
  <img src="frontend/public/logo.png" alt="ServerCTL Logo" width="320"/>
</p>

<h1 align="center">ServerCTL</h1>

<p align="center">
  A self-hosted infrastructure management dashboard.<br/>
  Monitor, manage, and update your servers from a single web interface — no VPN, no inbound ports required.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.3-green" alt="Version"/>
  <img src="https://img.shields.io/badge/License-CC%20BY--ND%204.0-lightgrey.svg" alt="License"/>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/agent-Go%201.24-00ADD8" alt="Go Agent"/>
  <img src="https://img.shields.io/badge/deploy-Docker%20Compose-2496ED" alt="Docker"/>
</p>

---

## Features

- **Real-time monitoring** — CPU, RAM, disk, network, uptime across all servers
- **Package updates** — view pending updates, install upgrades per-server or in bulk with selective checkboxes
- **Reboot management** — identify servers requiring reboot, reboot selectively with confirmation
- **SSH terminal** — browser-based SSH shell via WebSocket (Linux servers)
- **Service management** — start, stop, restart and inspect systemd / Windows services
- **Log viewer** — browse and read log files remotely (`/var/log/` on Linux, Event Log on Windows)
- **Probe Monitor** — test connectivity via Ping, TCP, UDP, HTTP, or DB port with per-result tooltips
- **Network scanner** — discover active hosts on any subnet
- **Speed test** — measure download speed to package repositories or CDN endpoints
- **Scheduled tasks** — run recurring commands on a cron schedule
- **Bulk actions** — upgrade, reboot, or update agents across multiple servers at once
- **Agent management** — dedicated Agents tab with selective update checkboxes, version tracking, and one-click updates
- **User management** — role-based access control (admin / user)
- **Custom branding** — upload your own logo and set a custom dashboard title
- **Dark/Light theme** — emerald-accented dark theme with JetBrains Mono font, plus a light theme option
- **Collapsible sidebar** — toggle sidebar between expanded and icon-only mode
- **Windows support** — native Go agent with automatic PSWindowsUpdate module installation for Windows Update detection
- **No inbound ports** — agents connect outbound to the backend over WebSocket

---

## Architecture

```
Browser
  └── Frontend  (React + Vite, served by nginx)
        └── Backend API  (FastAPI + Python)
              └── WebSocket hub
                    └── Agent  (Go binary, runs on each managed server)
```

- **Frontend** — React SPA, Vite build, served by nginx, JetBrains Mono font (bundled offline)
- **Backend** — FastAPI, manages agent WebSocket connections, proxies commands, stores server registry
- **Agent (Linux)** — pre-compiled Go binary, runs as a systemd service, connects outbound via WebSocket
- **Agent (Windows)** — pre-compiled Go binary, runs as a Windows Service, connects outbound via WebSocket

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React + Vite | React 18.3, Vite 6.0 |
| Backend | FastAPI + Uvicorn | Python 3.12 |
| Agent | Go (cross-compiled) | Go 1.24 |
| Terminal | xterm.js | 6.0 |
| Font | JetBrains Mono | Bundled woff2 |
| Deployment | Docker Compose | - |

---

## Requirements

### Docker Mode (recommended)
- **Docker + Docker Compose** — on the host running ServerCTL

### Native Mode (no Docker)
- **Python 3.8+** and **Node.js 18+** — on the host running ServerCTL
- **nginx** — for serving the frontend

### Managed Servers
- **Outbound internet access** — managed servers must be able to reach the ServerCTL host on the backend port
- No inbound firewall rules needed on managed servers
- No dependencies required — the agent is a single static binary

---

## Quick Start

```bash
git clone https://github.com/vladII987/ServerCTL.git
cd ServerCTL
bash setup.sh
```

`setup.sh` will:
1. Ask you to choose deployment mode: **Docker** or **Native**
2. Generate `AGENT_TOKEN`, `DASHBOARD_TOKEN`, and `SECRET_KEY` automatically
3. Ask for frontend port (default: 8090) and backend port (default: 8765)
4. Write `.env`
5. Docker mode: run `docker compose up --build -d`
6. Native mode: set up Python venv, build frontend, configure nginx + systemd

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
export APP_VERSION=$(cat VERSION)
docker compose up --build -d
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_TOKEN` | ✅ | Shared secret used by agents to authenticate with the backend |
| `DASHBOARD_TOKEN` | ✅ | Legacy token-based login (fallback if no users exist) |
| `SECRET_KEY` | ✅ | JWT signing secret for session tokens |
| `APP_VERSION` | ❌ | Read from `VERSION` file — passed to Docker build args |
| `BACKEND_PORT` | ❌ | Backend port (default: `8765`) |
| `FRONTEND_PORT` | ❌ | Frontend port (default: `8090`) |
| `PROMETHEUS_URL` | ❌ | Prometheus endpoint for metrics (optional) |
| `PUBLIC_HOST` | ❌ | Public hostname/IP for agent install scripts (auto-detected if empty) |
| `FRONTEND_URL` | ❌ | Public URL of the frontend (for CORS, optional) |

> **Never commit `.env` to version control.** It is in `.gitignore`.

---

## Versioning

The app version is defined in a single file: **`VERSION`**

All components read from it:
- `docker-compose.yml` — via `${APP_VERSION}` env var
- `backend/main.py` — reads `/app/VERSION` at runtime
- `agent-go/Makefile` — reads `../VERSION` and injects via `-ldflags`

To bump the version, edit `VERSION` and rebuild.

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
- Download the pre-compiled Go agent binary for your architecture (amd64 / arm64)
- Write config to `/etc/serverctl/config.yml`
- Create and enable a `serverctl-agent` **systemd service**

**Windows** (PowerShell, run as Administrator):
```powershell
iex (iwr -UseBasicParsing "http://<serverctl-host>:<BACKEND_PORT>/api/agent/install-windows?token=<TOKEN>&server_id=<ID>").Content
```

The installer will:
- Download the pre-compiled Go agent binary (`serverctl-agent.exe`)
- Write config to `C:\ServerCTL\config.yml`
- Install agent as a **Windows Service** (`ServerCtl Agent`) via `sc.exe`
- Create a scheduled task (`ServerCtlUpdater`) for remote agent updates
- Service auto-starts on boot and restarts on failure — visible in `services.msc`

The agent appears online in the dashboard within seconds of installation.

---

## Updating Agents

**Agents tab** (recommended):
- View all connected agents with their version, platform, and online status
- Select specific agents using checkboxes → **Update Selected**
- Or use **Select All / Deselect All** for bulk operations

**Per-server:** Manage a server → **Actions** tab → **Update Agent**

When the agent is updated, it downloads the latest binary from the backend and restarts itself.

---

## Agent — Supported Commands

The Go agent executes only an explicit allowlist of commands. No arbitrary shell execution is possible.

| Command | Description |
|---------|-------------|
| `system_info` | Basic system info (hostname, OS, kernel, uptime) |
| `sysinfo_json` | Full system info as structured JSON |
| `disk_usage` | Disk space per partition |
| `memory` | RAM and swap usage |
| `cpu_info` | CPU model, cores, architecture |
| `top_processes` | Processes sorted by CPU usage |
| `netstat` | Active network connections |
| `ip_info` | Network interfaces and addresses |
| `listening_ports` | Open listening ports |
| `firewall_status` | Firewall rules (iptables/nftables on Linux, Windows Firewall) |
| `list_services` | All services (systemd on Linux, Windows services) |
| `service_status` | Status of a specific service |
| `docker_ps` | Running Docker containers |
| `list_logs` | Available log files |
| `view_log` | Read a log file or Windows Event Log |
| `update` | Refresh package index |
| `upgrade` | Full package upgrade (apt/dnf/yum/zypper or Windows Update) |
| `upgradable_packages` | List packages with available upgrades |
| `check_reboot` | Check if reboot is required |
| `reboot` | Reboot the server |
| `update_agent` | Download latest agent binary and restart service |
| `uninstall_agent` | Remove agent and its configuration |
| `ping_count` | ICMP ping to a target |
| `traceroute` | Traceroute to a target |
| `nslookup` | DNS lookup |
| `kill_process` | Terminate a process by PID |
| `repo_speedtest` | Test download speed to package repos / CDN |
| `df` | Disk free (raw output) |
| `free` | Memory free (raw output) |
| `uptime` | System uptime |
| `who` | Logged-in users |

**Linux package managers:** `apt`, `dnf`, `yum`, `zypper` (auto-detected)
**Windows updates:** Uses `PSWindowsUpdate` PowerShell module (auto-installed by the agent if missing)

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
│   │   ├── logo.png          # Default logo
│   │   └── fonts/            # JetBrains Mono woff2 (bundled)
│   └── src/
│       ├── Dashboard.jsx     # Main UI component
│       ├── main.jsx          # App entry point
│       └── index.css         # Font-face declarations, base styles
├── backend/                  # FastAPI backend
│   ├── main.py               # API routes, WebSocket hub, agent installer scripts
│   ├── config.py             # Settings (pydantic-settings)
│   ├── users.py              # User management, JWT auth
│   ├── scanner.py            # Network scanner
│   ├── ssh_handler.py        # SSH WebSocket proxy
│   ├── server_registry.py    # Server registry class
│   ├── zabbix.py             # Zabbix integration
│   ├── servers.json          # Server registry (persisted)
│   ├── users.json            # User database (persisted)
│   └── requirements.txt
├── agent-go/                 # Go agent (cross-platform)
│   ├── main.go               # Agent source code
│   ├── go.mod
│   ├── Makefile              # Build targets: linux, windows, deb, rpm
│   └── dist/                 # Pre-compiled binaries
│       ├── serverctl-agent-linux-amd64
│       ├── serverctl-agent-linux-arm64
│       └── serverctl-agent-windows-amd64.exe
├── setup.sh                  # First-time setup (Docker or Native mode)
├── docker-compose.yml
├── VERSION                   # Single source of truth for app version
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

Agent binaries in `agent-go/dist/` are mounted read-only into the backend container at `/app/agent-bins`.

---

## Building Agent Binaries

Agent binaries are pre-compiled and included in `agent-go/dist/`. To rebuild:

```bash
cd agent-go
make all      # Builds linux-amd64, linux-arm64, and windows-amd64
```

The Makefile reads the version from `../VERSION` automatically.

Individual targets: `make linux`, `make windows`, `make deb`, `make rpm`

Requires **Go 1.24+** installed on the build machine.

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
- Change the default `admin` / `admin` credentials immediately after first login

---

## Documentation

Full documentation for all features, buttons, and controls: **[DOCS.md](DOCS.md)**

---

## License

[AGPL-3.0](LICENSE)
