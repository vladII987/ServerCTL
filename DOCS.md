# ServerCTL — Official Documentation

> **Version:** 1.4.0 | **Agent:** Go (cross-platform)

---

## Table of Contents

1. [Overview](#overview)
2. [Navigation](#navigation)
3. [Dashboard](#dashboard)
4. [Servers](#servers)
   - [Server List](#server-list)
   - [Managing a Server](#managing-a-server)
   - [Overview Tab](#overview-tab)
   - [Services Tab](#services-tab)
   - [Logs Tab](#logs-tab)
   - [Actions Tab](#actions-tab)
   - [Bulk Actions](#bulk-actions)
5. [Networks](#networks)
   - [Network Scan](#network-scan)
   - [Speed Test](#speed-test)
   - [Probe Monitor](#probe-monitor)
6. [Logs](#logs)
7. [Shell](#shell)
8. [RDP](#rdp)
9. [Updates](#updates)
10. [Agents](#agents)
11. [Activity](#activity)
12. [Schedules](#schedules)
13. [Settings](#settings)
14. [Installation & Configuration](#installation--configuration)
    - [setup.sh — First-Time Setup](#setupsh--first-time-setup)
    - [update.sh — Update & Rebuild](#updatesh--update--rebuild)
    - [uninstall.sh — Complete Removal](#uninstallsh--complete-removal)
    - [SSL/HTTPS Configuration](#sslhttps-configuration)
15. [Agent Installation](#agent-installation)
    - [Linux](#linux-agent)
    - [Windows](#windows-agent)
16. [Ansible Playbooks](#ansible-playbooks)
    - [deploy-agent.yml — Bulk Agent Deployment](#deploy-agentyml--bulk-agent-deployment)
    - [update-token.yml — Token Rotation](#update-tokenyml--token-rotation)
17. [Inventory & Discovery Tools](#inventory--discovery-tools)
    - [gen-inventory.py — Ansible Inventory Generator](#gen-inventorypy--ansible-inventory-generator)
    - [scan.py — Network Scanner & Host Discovery](#scanpy--network-scanner--host-discovery)
18. [Docker Compose Services](#docker-compose-services)
19. [Environment Variables](#environment-variables)
20. [API Endpoints](#api-endpoints)
21. [Versioning](#versioning)
22. [Security Notes](#security-notes)

---

## Overview

ServerCTL is a self-hosted infrastructure management dashboard. It lets you monitor, manage, and update multiple servers from a single web interface — no VPN required, no inbound ports on managed servers.

**Architecture:**
```
Browser
  └── Frontend (React + Vite, served by nginx)
        └── Backend API (FastAPI, Python)
              ├── WebSocket hub ← Agent connections
              └── RDP Bridge (FreeRDP + TigerVNC + noVNC)
```

Agents connect **outbound** to the backend over WebSocket. The backend never initiates a connection to a managed server — managed servers only need outbound access to the ServerCTL host.

**Deployment modes:**
- **Docker mode** — backend, rdpbridge, and frontend run as Docker containers (recommended)
- **Native mode** — Python venvs + nginx, no Docker required

---

## Navigation

The left sidebar contains the main navigation. It can be collapsed to icon-only mode using the toggle button. The sidebar auto-collapses when the browser window is resized below 1100px.

| Icon | Section | Purpose |
|------|---------|---------|
| ⬡ | **Dashboard** | Overview of all servers — health, update status, host list |
| ▦ | **Servers** | Full server list, per-server management, bulk actions |
| ⬡ | **Networks** | Network scan, speed test, probe monitor |
| ≡ | **Logs** | Browse and view log files on any server |
| >_ | **Shell** | Browser-based SSH terminal (Linux servers only) |
| 🖥 | **RDP** | Browser-based remote desktop (Windows + Linux) |
| ↑ | **Updates** | Servers with pending OS/package updates — apply in bulk |
| ◈ | **Agents** | Agent version tracking, selective updates, status overview |
| ◷ | **Activity** | Log of all actions performed through the dashboard |
| ⏰ | **Schedules** | Scheduled recurring tasks (cron-style) |
| ⚙ | **Settings** | User management, branding, token configuration |

The **Updates** icon shows a badge with the total number of pending packages across all servers.

The sidebar bottom contains:
- **Dark/Light theme toggle**
- **Sign out button**

---

## Dashboard

The Dashboard section provides a high-level summary of your infrastructure.

### Stats Cards (top row)

| Card | Description |
|------|-------------|
| **Total Servers** | Total number of registered servers |
| **Online** | Servers currently reachable (agent connected) |
| **Offline** | Servers not reachable |
| **Backend** | Health status of the ServerCTL backend itself |

Clicking **Needs Reboot** or **Needs Updates** filters the server list to show only affected servers.

### Update Status Panel

Shows a breakdown of servers by update state:
- **Up to date** — no pending packages
- **Need updates** — packages available
- **Needs reboot** — reboot required after a previous upgrade
- **Offline** — unreachable

Displays a **compliance rate** percentage (how many servers are fully up to date).

### Host Status Panel

A compact list of all registered servers with their online/offline status indicator, reboot warning, and pending package count badge.

### Ping Monitor

ICMP ping sweep of all registered servers from the backend. Shows latency in ms or timeout status for each server.

### Servers Needing Updates

If any servers have pending updates, a full list appears with:
- Online/offline indicator
- Server name and IP
- Reboot badge (if required)
- Package count badge
- **Manage** button — jumps directly to that server's management view

---

## Servers

### Server List

The main Servers section shows all registered servers in a table.

#### Toolbar buttons

| Button | Description |
|--------|-------------|
| **+ Add Server** | Opens the Add Server wizard to register a new server |
| **Import CSV** | Bulk import servers from a CSV file |
| **Search** | Filter the server list by name or IP |
| **Status filter** | Dropdown to filter by: All / Online / Offline / Needs Reboot / Needs Updates |
| **Group filter** | Filter servers by group |
| **Bulk Actions** | Opens the bulk action panel for selected servers |
| **Select All / Deselect All** | Toggles selection of all visible servers |

#### Per-server row buttons

| Button | Description |
|--------|-------------|
| **Checkbox** | Select this server for bulk actions |
| **Status dot** | Green = online, Red = offline |
| **Manage** (or click row) | Opens full per-server management view |
| **SSH** button (>_) | Jumps directly to the Shell tab with this server selected |
| **Reboot** | Appears only for servers with `reboot_required` flag — initiates a reboot with confirmation |

#### Quick filter banners

When a quick filter is active (e.g. "Needs Reboot"), a banner appears at the top with:
- Count of affected servers
- **Reboot All** — reboot all filtered servers at once (admin only)
- **Reset filter** — clear the filter

---

### Managing a Server

Click any server row to open the full management view. The header shows the server name, IP, platform, pending update count, and last-seen time.

#### Header buttons

| Button | Description |
|--------|-------------|
| **Back** | Return to the server list |
| **Refresh** | Re-fetch all data for this server |
| **Delete** | Permanently remove this server from the registry (admin only) |

---

### Overview Tab

Shows live system data fetched from the agent:

- **CPU Usage** — current load percentage with a visual bar
- **RAM Usage** — used / total with percentage bar
- **Disk Usage** — per-partition usage table
- **System Info** — hostname, OS, kernel, uptime, architecture, CPU model, cores, RAM, swap
- **Network Interfaces** — interface names, IPs, MAC addresses
- **Top Processes** — list of processes sorted by CPU usage with PID, user, CPU%, MEM%, and command

---

### Services Tab

Lists all systemd services (Linux) or Windows services on the managed server.

| Button | Description |
|--------|-------------|
| **Start** | Start the selected service |
| **Stop** | Stop the selected service |
| **Restart** | Restart the selected service |
| **Status** | Query and display current service status and recent log lines |

Services are color-coded: green = running, red = failed/stopped, grey = unknown.

---

### Logs Tab

Browse and view log files on the managed server.

| Control | Description |
|---------|-------------|
| **Log file selector** | Dropdown of available log files (`/var/log/` on Linux, Event Log on Windows) |
| **View** | Load and display the selected log file (last 500 lines) |
| **Refresh** | Reload the current log file |
| **Search / filter** | Filter displayed log lines by keyword (client-side) |

Windows servers expose:
- `Agent Log` — the agent's own log file at `C:\ServerCTL\logs\agent.log`
- `Event Log: System`
- `Event Log: Application`
- `Event Log: Security`

---

### Actions Tab

Allows running individual diagnostic and maintenance commands on the selected server.

| Button | Description |
|--------|-------------|
| **System Info** | Returns basic system details |
| **Disk Usage** | Disk space per partition |
| **Memory** | RAM and swap usage |
| **CPU Info** | CPU model and core details |
| **Top Processes** | Processes sorted by CPU usage |
| **Netstat** | Active network connections |
| **Docker PS** | Running Docker containers |
| **Running Services** | All currently running services |
| **Failed Services** | Services in a failed state |
| **Check Updates** | Refresh package index and report available packages |
| **Upgrade** | Full package upgrade. Requires confirmation. Admin only. |
| **Check Reboot** | Check if server requires a reboot |
| **Reboot** | Reboot the server. Requires confirmation. Admin only. |
| **Update Agent** | Download latest agent binary and restart agent service |
| **Ping** | Pings a target host from this server (ICMP) |
| **Traceroute** | Runs traceroute from this server to a target |
| **NSLookup** | Runs DNS lookup from this server |
| **Kill Process** | Terminate a process by PID |

All action output is displayed in a formatted terminal-style output box below the buttons.

---

### Bulk Actions

Select multiple servers using checkboxes, then click **Bulk Actions** to perform an operation on all selected servers simultaneously.

| Button | Description |
|--------|-------------|
| **Check Updates** | Refresh package index on all selected servers |
| **Upgrade All** | Full package upgrade on all selected servers. Requires confirmation. Admin only. |
| **Check Reboot** | Check reboot status on all selected servers |
| **Reboot All** | Reboot all selected servers. Requires confirmation. Admin only. |
| **Update Agent** | Update the agent binary on all selected servers |

A progress modal appears during bulk operations showing per-server status in real time.

---

## Networks

### Network Scan

Scans a subnet for active hosts using ICMP ping sweep from the backend server.

| Control | Description |
|---------|-------------|
| **Subnet (CIDR)** | Enter a subnet in CIDR notation, e.g. `192.168.1.0/24` |
| **Start Scan** | Opens the scan dialog and begins the sweep |

Results show each discovered host with its IP address and response time. You can register any discovered host directly as a new server from the scan results.

---

### Speed Test

Tests download speed from package repositories or CDN endpoints.

| Control | Description |
|---------|-------------|
| **Server selector** | Choose which server runs the test, or leave blank to run from the backend |
| **Run Test** | Starts the speed test |

- On **Linux servers**: tests Ubuntu Archive, Ubuntu Security, and Ubuntu Updates repositories
- On **Windows servers**: tests Microsoft Update CDN, Winget CDN, and Cloudflare
- If **From backend server** is selected: runs from the ServerCTL host itself

Results show download speed in Mbps per endpoint.

---

### Probe Monitor

Tests network connectivity to all registered servers using various protocols. Select servers using checkboxes, choose a probe type, configure options, and click **Run** to test all selected servers at once.

#### Probe types

| Type | Description |
|------|-------------|
| **Ping (ICMP)** | Standard ICMP echo request. Returns latency in ms or timeout. |
| **TCP Port** | Opens a TCP connection to the specified port. Confirms the port is open and measures connect time. |
| **UDP Port** | Sends a UDP probe to the specified port. Detects open, open\|filtered, or closed state. |
| **HTTP** | Sends an HTTP GET request to a URL. Returns HTTP status code and response time. If blank, tests `http://<host>`. |
| **DB Port** | TCP connection test to a well-known database port. Select from preset: MySQL (3306), PostgreSQL (5432), MSSQL (1433), Redis (6379), MongoDB (27017). |

#### Controls

| Control | Description |
|---------|-------------|
| **Probe type dropdown** | Select: Ping / TCP Port / UDP Port / HTTP / DB Port |
| **Port field** | Appears for TCP and UDP — enter the port number to test |
| **URL field** | Appears for HTTP — enter full URL or leave blank for root |
| **DB preset dropdown** | Appears for DB — select the database engine |
| **Select All / Deselect All** | Toggle selection of all servers |
| **Run** | Run the probe against all selected servers |

#### Result display

Each server row shows:
- **Status dot** — green = up/open, amber = filtered/redirect, red = down/timeout/refused
- **Result label** — latency in ms, HTTP status code, or status string
- **Timestamp** — time of the last probe
- **Info icon** — hover to see a human-readable explanation of the result

---

## Logs

The Logs section provides a centralized log viewer. Select a server from the list, then select a log source to view its contents.

| Control | Description |
|---------|-------------|
| **Server list** | Click a server to load its available log files |
| **Log selector** | Dropdown of log files available on the selected server |
| **View** | Load the selected log |
| **Refresh** | Reload the current log |
| **Filter** | Filter displayed lines by keyword (client-side, instant) |

---

## Shell

Browser-based SSH terminal. Only Linux servers are listed (Windows does not support SSH in this way).

| Control | Description |
|---------|-------------|
| **Server list** (left panel) | Click a server to select it for connection |
| **Username** | SSH username (default: `administrator`) |
| **Auth method** | `Password`, `Key path` (path on the backend), or `Key upload` (paste/upload private key) |
| **Password / Key** | Credential field — changes based on auth method |
| **Connect** | Establishes the SSH WebSocket tunnel |
| **Disconnect** | Closes the active SSH session |

The terminal emulator supports full color output, resize, scrollback, and copy/paste.

---

## RDP

Browser-based remote desktop using FreeRDP + TigerVNC + noVNC. Works with both Windows and Linux servers that have RDP/VNC enabled.

| Control | Description |
|---------|-------------|
| **Server list** (left panel) | Click a server to select it for connection |
| **Username** | RDP username |
| **Password** | RDP password |
| **Domain** | Windows domain (optional) |
| **Port** | RDP port (default: `3389`) |
| **Resolution** | Screen width x height |
| **Security** | RDP security mode (rdp, tls, nla) |
| **Connect** | Establishes the RDP session via WebSocket |
| **Disconnect** | Closes the active RDP session |

**Clipboard support:** requires HTTPS (self-signed or Let's Encrypt). The browser clipboard API is only available in secure contexts.

---

## Updates

The Updates section shows all servers that have pending **OS/package updates**. This is for operating system updates only — agent updates are managed in the [Agents](#agents) tab.

#### How it works

- **Linux**: The agent detects pending updates using the system package manager (apt, dnf, yum, zypper)
- **Windows**: The agent uses the `PSWindowsUpdate` PowerShell module to detect Windows Updates. The module is **auto-installed** by the agent if not present — no manual setup required.

#### Toolbar

| Button | Description |
|--------|-------------|
| **Select All / Deselect All** | Toggle selection of all servers with pending updates |
| **Sync Updates** | Refresh update counts from all agents |
| **Upgrade Selected** | Install updates on all selected servers. Admin only. |

#### Per-server row

| Element | Description |
|---------|-------------|
| **Checkbox** | Select this server for bulk upgrade |
| **Package count badge** | Number of packages with available updates |
| **Reboot badge** | Indicates the server requires a reboot after previous upgrades |
| **Upgrade** button | Install updates on this single server only |
| **Package list** | Expandable list showing individual package names |

---

## Agents

The Agents tab provides a centralized view of all agent installations across your servers.

#### Features

- **Version tracking** — see which version each agent is running
- **Platform display** — Linux or Windows indicator per agent
- **Online/offline status** — real-time connection status
- **Selective updates** — checkboxes to select which agents to update
- **Select All / Deselect All** — toggle all agent selections
- **Update Selected (N)** — push the latest agent binary to selected servers
- **Sync Status** — refresh agent information from all connected servers

#### Update flow

1. Select agents using checkboxes (or Select All)
2. Click **Update Selected**
3. The backend sends the latest pre-compiled binary to each selected agent
4. Each agent downloads the new binary, replaces itself, and restarts
5. On **Linux**: the systemd service restarts automatically
6. On **Windows**: a scheduled task (`ServerCtlUpdater`) handles the update process

---

## Activity

Shows a chronological log of all actions performed through the dashboard.

Each entry records:
- **Timestamp**
- **User** who triggered the action
- **Server** it was performed on
- **Action** type (upgrade, reboot, update agent, etc.)
- **Result** — success or error

---

## Schedules

Create scheduled tasks that run automatically on a recurring basis.

| Control | Description |
|---------|-------------|
| **+ New Schedule** | Create a new scheduled task |
| **Server** | Target server for the task |
| **Command** | Action to perform (upgrade, check_updates, reboot, etc.) |
| **Schedule** | Cron expression defining when to run |
| **Enable / Disable** toggle | Activate or pause a schedule without deleting it |
| **Delete** | Remove the schedule permanently |

---

## Settings

### User Management (Admin only)

| Button | Description |
|--------|-------------|
| **+ Add User** | Create a new user account with username, password, and role |
| **Change Password** | Update the password for any user account |
| **Delete** | Remove a user account |

Roles:
- **admin** — full access: add/delete servers, manage users, run upgrades and reboots
- **user** — read access + add servers; cannot delete servers, run upgrades, or reboot

### Branding

| Control | Description |
|---------|-------------|
| **Upload Logo** | Upload a custom logo image shown in the sidebar |
| **Change Logo** | Replace the current custom logo |
| **App Name** | Set a custom title shown in the browser tab and sidebar |

### Tokens

Displays the current `AGENT_TOKEN` and `DASHBOARD_TOKEN` values. These are read from the backend environment at runtime.

---

## Installation & Configuration

### `setup.sh` — First-Time Setup

The interactive setup script handles first-time installation. Run it once after cloning the repository:

```bash
bash setup.sh
```

#### Step-by-step walkthrough

**1. Deployment mode**
Choose between **Docker** (recommended) or **Native** (direct install on Linux — Ubuntu, Debian, Fedora, CentOS, RHEL).

**2. Port configuration**
- **Frontend port** (default `8090`) — the port you open in your browser to access the dashboard
- **Backend port** (default `8765`) — the API and WebSocket port. Agents connect to this port. Also used internally by the frontend's nginx reverse proxy to reach the API.

**3. Token generation**
Three secrets are generated automatically using `openssl rand -hex 32`:
| Token | Purpose |
|-------|---------|
| `AGENT_TOKEN` | Shared secret for agent authentication. Each server also receives a unique per-server token on registration. The shared token is used as a fallback for auto-registration of new agents. |
| `DASHBOARD_TOKEN` | Legacy admin login token. Superseded by user accounts but kept as a fallback if no users exist. |
| `SECRET_KEY` | JWT signing key for user session tokens. Used to sign and verify login sessions. |

**4. Prometheus (optional)**
Prometheus URL (default: `http://localhost:9090`). Prometheus is an **optional metrics source** — if configured with `node_exporter` running on your servers, the backend can query Prometheus for CPU, RAM, and disk metrics. This provides historical data and richer metrics than agent-reported snapshots. If Prometheus is not configured or unreachable, the backend falls back to real-time agent metrics automatically.

**5. SSL/HTTPS**
| Mode | Description |
|------|-------------|
| **None** | Plain HTTP only. Default option. |
| **Self-signed** | Generates a 10-year self-signed certificate using OpenSSL. Good for internal/lab environments. Browsers will show a security warning on first visit. Enables clipboard support in RDP sessions. |
| **Let's Encrypt** | Free trusted certificate from Let's Encrypt with automatic renewal via certbot. Requires a public domain name with DNS pointing to the server. No browser warnings. |

SSL settings (`SSL_MODE`, `SSL_CERT_PATH`, `SSL_KEY_PATH`) are persisted in `.env` so they survive rebuilds and updates.

**6. Database initialization**
Creates an SQLite database at `./data/serverctl.db`. Stores servers, users, settings, and activity logs. A default admin user (`admin` / `admin`) is created on first run — change this immediately.

**7. Build and start**
- **Docker mode:** installs Docker and Docker Compose if not present, handles SELinux on Fedora/RHEL, syncs system clock, then runs `docker compose up --build -d` to start three containers (backend, rdpbridge, frontend).
- **Native mode:** installs Python 3, Node.js, npm, nginx, FreeRDP, TigerVNC. Creates Python venvs, builds the frontend with Vite, downloads noVNC source, configures nginx as reverse proxy (API at `/api/`, WebSockets at `/ws/`), creates systemd services (`serverctl-backend`, `serverctl-rdpbridge`).

---

### `update.sh` — Update & Rebuild

Safely updates ServerCTL to the latest version while preserving all configuration and data.

```bash
sudo bash update.sh
```

#### What it does

1. **Validates environment** — checks that `.env` exists and contains required tokens (`SECRET_KEY`, `DASHBOARD_TOKEN`, `AGENT_TOKEN`). Refuses to proceed if tokens are missing to prevent data loss.

2. **Creates timestamped backup** — copies `.env`, database, and config files to `.backup/<YYYYMMDD_HHMMSS>/`.

3. **Pulls latest code** — offers three methods:
   - **HTTPS (public)** — no authentication needed
   - **HTTPS with credentials** — GitHub username + personal access token
   - **SSH** — uses the current user's SSH keys

4. **Reports version** — shows the upgrade path (e.g., `1.3.0 → 1.4.0`).

> **Note:** After updating, log out and log back in to the dashboard to refresh your session token.

5. **Auto-detects SSL** — if SSL certificates exist on disk but `SSL_MODE` is missing from `.env` (e.g., upgrading from an older version), the script automatically adds the correct SSL variables.

6. **Rebuilds**:
   - **Docker mode:** loads `.env`, runs `docker compose up --build -d`, then prunes old Docker images (`docker image prune -a -f --filter "until=24h"`) to free disk space.
   - **Native mode:** updates Python dependencies (`pip install -r requirements.txt`), rebuilds the frontend (`npm run build` with `VITE_API_URL`, `VITE_DASHBOARD_TOKEN`, `VITE_APP_VERSION`), fixes file permissions for nginx, restarts the backend service, reloads nginx.

---

### `uninstall.sh` — Complete Removal

Completely removes ServerCTL from the system.

```bash
sudo bash uninstall.sh
```

**Docker mode:**
- Stops and removes all containers, images, and volumes
- Deletes `.env`
- Optionally deletes the entire project directory

**Native mode:**
- Stops and disables `serverctl-backend` and `serverctl-rdpbridge` systemd services
- Removes service files from `/etc/systemd/system/`
- Removes nginx config (`/etc/nginx/sites-available/serverctl` or `/etc/nginx/conf.d/serverctl.conf`)
- Deletes Python venvs, frontend build, and `node_modules`
- Removes `.env`
- Optionally deletes the entire project directory

---

### SSL/HTTPS Configuration

SSL is configured during `setup.sh` and persisted in `.env`. It works the same way for both Docker and native installs.

**Docker mode:** The frontend nginx container reads SSL cert/key paths from environment variables and mounts them as read-only volumes. The container listens on port 443 internally (mapped to your frontend port).

**Native mode:** The nginx config is swapped to include SSL directives pointing to the certificate files. For self-signed certs, they are stored in `./ssl/`. For Let's Encrypt, they are at `/etc/letsencrypt/live/<domain>/`.

**Why HTTPS matters:**
- **RDP clipboard:** The browser clipboard API (`navigator.clipboard`) only works in secure contexts (HTTPS). Without it, copy/paste in RDP sessions is disabled.
- **Security:** Tokens and credentials are transmitted in the clear over HTTP.

---

## Agent Installation

### Linux Agent

**Triggered from:** Servers → Add Server wizard → Step 3

The wizard generates a one-line install command that:
1. Detects system architecture (amd64 / arm64)
2. Downloads the pre-compiled Go agent binary from the backend
3. Verifies checksum integrity
4. Installs to `/usr/local/bin/serverctl-agent`
5. Writes config to `/etc/serverctl/config.yml`
6. Creates and enables a `serverctl-agent` **systemd service** (auto-starts on boot, restarts on failure)

**No dependencies required** — the agent is a single static binary.

**Run on the target server as root:**
```bash
curl -fsSL "http://<serverctl-host>:<BACKEND_PORT>/api/agent/install?token=<TOKEN>&server_id=<ID>" | sudo sh
```

After installation, the agent appears online in the dashboard within seconds.

**Update agent:**
- **Agents tab** → select agent → **Update Selected** (recommended)
- Per-server: **Manage → Actions → Update Agent**
- Manual: re-run the install command

---

### Windows Agent

**Triggered from:** Servers → Add Server wizard → Step 3 (select Windows)

The wizard generates a PowerShell command that:
1. Downloads the pre-compiled Go agent binary (`serverctl-agent.exe`) to `C:\ServerCTL\`
2. Writes config to `C:\ServerCTL\config.yml`
3. Installs the agent as a **Windows Service** (`ServerCtl Agent`) via `sc.exe`
4. Creates a scheduled task (`ServerCtlUpdater`) for remote agent updates
5. Configures the service to auto-start and auto-restart on failure

**Run in PowerShell as Administrator:**
```powershell
iex (iwr -UseBasicParsing "http://<serverctl-host>:<BACKEND_PORT>/api/agent/install-windows?token=<TOKEN>&server_id=<ID>").Content
```

The agent will appear online in the dashboard within seconds.

**Windows Update detection:**
- The agent automatically installs the `PSWindowsUpdate` PowerShell module if not present
- Once installed, Windows Updates are detected and reported to the dashboard
- Install updates from the **Updates** tab just like Linux servers

**Notes:**
- No dependencies required on the Windows server — single binary
- The service survives logoff and Windows Update reboots
- Service is visible in `services.msc` as `ServerCtl Agent`
- Logs are written to `C:\ServerCTL\logs\agent.log`

---

## Ansible Playbooks

### `deploy-agent.yml` — Bulk Agent Deployment

Deploys and auto-registers agents across multiple servers using Ansible. Useful for large-scale rollouts.

#### Variables (edit at the top of the playbook)

| Variable | Description |
|----------|-------------|
| `backend_url` | Backend HTTP URL (e.g., `http://192.168.1.100:9090`) |
| `backend_token` | Admin dashboard token for the server registration API |
| `serverctl_ws_url` | WebSocket endpoint for agents (e.g., `ws://192.168.1.100:9090/ws/agent`) |

#### What it does

1. **Registers each server** — POST to `/api/servers` to create the server entry and receive a unique per-server agent token
2. **Installs dependencies** — Python 3, pip, curl on the target
3. **Creates directories** — `/opt/serverctl-agent`, `/etc/serverctl`, `/etc/serverctl/logs`
4. **Downloads the agent** — fetches the Python agent script from the backend
5. **Installs Python packages** — `websockets`, `pyyaml`, `psutil`
6. **Writes config** — `/etc/serverctl/config.yml` with the unique per-server token
7. **Creates systemd service** — `/etc/systemd/system/serverctl-agent.service` with auto-restart
8. **Verifies connection** — waits 3 seconds and reports per-server status

#### Usage

```bash
# Deploy to all hosts in inventory
ansible-playbook -i inventory/hosts.yml deploy-agent.yml --ask-pass

# Deploy to a specific host only
ansible-playbook -i inventory/hosts.yml deploy-agent.yml --ask-pass --limit server-05
```

---

### `update-token.yml` — Token Rotation

Updates agent tokens on existing installations without reinstalling. Use this after rotating tokens on the backend.

#### What it does

1. **Checks for existing agent** — skips servers that don't have the agent installed
2. **Backs up config** — creates `config.yml.backup` before modifying
3. **Updates config** — writes new `api_token` and `server_url` to `/etc/serverctl/config.yml`
4. **Restarts agent** — restarts the `serverctl-agent` service
5. **Verifies** — waits 3 seconds and checks `systemctl is-active serverctl-agent`

#### Usage

```bash
# Update all hosts
ansible-playbook -i inventory update-token.yml

# Update a specific host
ansible-playbook -i inventory update-token.yml --limit 192.168.1.201

# Dry run (check mode)
ansible-playbook -i inventory update-token.yml --check
```

---

## Inventory & Discovery Tools

### `gen-inventory.py` — Ansible Inventory Generator

Generates an Ansible-compatible inventory file from the ServerCTL server registry (SQLite database).

#### Features

- Reads servers from the backend database
- Filters out gateway/infrastructure IPs (default: `192.168.1.1`, `192.168.1.2`, `192.168.1.5`)
- Includes only servers with valid agent tokens
- Outputs `[agents]` group with per-server tokens as host variables
- Auto-detects the backend host IP

#### Usage

```bash
# Print inventory to stdout
python3 gen-inventory.py

# Write to file
python3 gen-inventory.py -o inventory/hosts

# Specify SSH user
python3 gen-inventory.py --user root

# Manually set backend host
python3 gen-inventory.py --backend-host 10.0.0.5

# Skip additional IPs
python3 gen-inventory.py --skip-ips 192.168.1.1,192.168.1.254
```

#### Output format

```ini
[agents]
192.168.1.100  ansible_user=administrator  agent_token=abc123...  # Production DB
192.168.1.101  ansible_user=administrator  agent_token=def456...  # Web Server

[agents:vars]
serverctl_url=ws://192.168.1.50:8765/ws/agent
ansible_ssh_common_args=-o StrictHostKeyChecking=no -o ConnectTimeout=10
```

---

### `scan.py` — Network Scanner & Host Discovery

Scans local subnets for active hosts and optionally imports them as managed servers.

#### Features

- Async ICMP ping sweep with parallel workers (64 for /24, 512 for /16)
- Checks each host for an existing ServerCTL agent health endpoint (port 8080)
- Reverse DNS lookup for hostname detection
- Live progress bar during scan
- Interactive host selection: `all`, `agent` (only those with agent), or specific numbers `1,3,5` or ranges `1-5`
- Auto-assigns group based on subnet
- Creates backup of existing server registry before saving

#### Configuration (edit at the top of the script)

| Setting | Default | Description |
|---------|---------|-------------|
| `SUBNETS` | `192.168.0.0/24`, `192.168.1.0/24`, `172.16.0.0/16` | Subnets to scan |
| `AGENT_PORT` | `8080` | Port to check for agent health endpoint |
| `OUTPUT_FILE` | `backend/servers.json` | Where to save discovered servers |

#### Usage

```bash
python3 scan.py
```

The script is interactive — it scans, shows results, lets you select which hosts to import, previews the JSON, and asks for confirmation before saving.

---

## Docker Compose Services

| Service | Container | Default Port | Purpose |
|---------|-----------|--------------|---------|
| `backend` | serverctl-backend | `8765` | FastAPI API server + WebSocket hub |
| `rdpbridge` | serverctl-rdpbridge | `8080` (internal) | FreeRDP + TigerVNC remote desktop proxy |
| `frontend` | serverctl-frontend | `8090` | nginx serving the React SPA |

All containers communicate on the `guac-net` bridge network.

**Persistent data volumes:**
- `./data/` → SQLite database (servers, users, settings, activity)
- `./agent-go/dist/` → Agent binaries (mounted read-only)
- `./VERSION` → App version file (mounted read-only)

---

## Environment Variables

All configuration is stored in `.env` (never committed to git).

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_TOKEN` | Yes | Shared agent authentication secret |
| `DASHBOARD_TOKEN` | Yes | Legacy token-based login fallback |
| `SECRET_KEY` | Yes | JWT signing secret for user sessions |
| `BACKEND_PORT` | No | Backend API port (default: `8765`) |
| `FRONTEND_PORT` | No | Frontend web port (default: `8090`) |
| `PROMETHEUS_URL` | No | Prometheus endpoint for metrics (falls back to agent if empty) |
| `PUBLIC_HOST` | No | Public IP/hostname for agent install URLs (auto-detected) |
| `SSL_MODE` | No | `none`, `selfsigned`, or `letsencrypt` (default: `none`) |
| `SSL_CERT_PATH` | No | Path to SSL certificate (auto-set by setup) |
| `SSL_KEY_PATH` | No | Path to SSL private key (auto-set by setup) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*`) |

---

## API Endpoints

### REST APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | User authentication, returns JWT token |
| `GET` | `/api/me` | Current user info |
| `GET` | `/api/servers` | List all servers with status |
| `POST` | `/api/servers` | Add a new server |
| `DELETE` | `/api/servers/{id}` | Remove a server (admin only) |
| `GET` | `/api/servers/{id}/status` | Single server status |
| `GET` | `/api/ping-all` | ICMP ping all servers |
| `POST` | `/api/action` | Execute a command on a server |
| `GET` | `/api/metrics/{id}` | Fetch metrics (Prometheus or agent) |
| `POST` | `/api/probe` | Connectivity test (ping/TCP/UDP/HTTP/DB) |
| `POST` | `/api/speedtest` | Backend download speed test |
| `POST` | `/api/servers/csv` | Bulk import from CSV |
| `GET` | `/api/users` | List users (admin only) |
| `POST` | `/api/users` | Create user (admin only) |
| `DELETE` | `/api/users/{username}` | Delete user (admin only) |
| `PUT` | `/api/users/{username}/password` | Change password |
| `GET` | `/api/agent/install-command` | Get agent install one-liners |
| `GET` | `/api/agent/download/{platform}` | Download agent binary |
| `GET` | `/api/agent/checksum/{platform}` | Agent binary SHA256 checksum |

### WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws/agent?token=<TOKEN>` | Agent connection hub |
| `/ws/logs/{server_id}` | Log file streaming |
| `/ws/ssh/{server_id}` | SSH terminal proxy |
| `/ws/rdp/{server_id}` | RDP remote desktop proxy |
| `/ws/scan` | Network scanner |

---

## Versioning

The app version is managed from a single file: **`VERSION`** in the project root.

All components read from this file:
- **docker-compose.yml** — `${APP_VERSION}` build arg (set via `export APP_VERSION=$(cat VERSION)`)
- **backend/main.py** — reads `VERSION` file at runtime
- **agent-go/Makefile** — reads `../VERSION` and injects into the binary via Go ldflags

To bump the version:
1. Edit the `VERSION` file
2. Rebuild agent binaries: `cd agent-go && make all`
3. Rebuild and deploy: `export APP_VERSION=$(cat VERSION) && docker compose up --build -d`

---

## Security Notes

- Agent tokens are per-server and stored in the backend database
- All agent commands go through an explicit allowlist — no arbitrary shell execution possible
- The Go agent is a compiled binary — no script injection possible
- Agents connect outbound only — no inbound ports needed on managed servers
- HTTPS supported via `setup.sh` (self-signed or Let's Encrypt) or external reverse proxy
- The backend port should not be directly exposed to the internet — only the frontend port needs to be reachable
- Default credentials are `admin` / `admin` — change immediately after first login
- `.env` contains all secrets — never commit it to version control

---

*ServerCTL v1.4.0 — Infrastructure Control Interface*
