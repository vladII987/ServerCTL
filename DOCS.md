# ServerCTL — Official Documentation

> **Version:** 1.3.3 | **Agent:** Go (cross-platform)

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
8. [Updates](#updates)
9. [Agents](#agents)
10. [Activity](#activity)
11. [Schedules](#schedules)
12. [Settings](#settings)
13. [Agent Installation](#agent-installation)
    - [Linux](#linux-agent)
    - [Windows](#windows-agent)
14. [Versioning](#versioning)

---

## Overview

ServerCTL is a self-hosted infrastructure management dashboard. It lets you monitor, manage, and update multiple servers from a single web interface — no VPN required, no inbound ports on managed servers.

**Architecture:**
```
Browser
  └── Frontend (React + Vite, served by nginx)
        └── Backend API (FastAPI, Python)
              └── Agent WebSocket connections
                    └── Agent (Go binary, runs on each managed server)
```

Agents connect **outbound** to the backend over WebSocket. The backend never initiates a connection to a managed server — this means managed servers only need outbound internet access.

**Deployment modes:**
- **Docker mode** — backend and frontend run as Docker containers (recommended)
- **Native mode** — Python venv + nginx, no Docker required

---

## Navigation

The left sidebar contains the main navigation. The sidebar can be collapsed to icon-only mode using the toggle button.

| Icon | Section | Purpose |
|------|---------|---------|
| ⬡ | **Dashboard** | Overview of all servers — health, update status, host list |
| ▦ | **Servers** | Full server list, per-server management, bulk actions |
| ⬡ | **Networks** | Network scan, speed test, probe monitor |
| ≡ | **Logs** | Browse and view log files on any server |
| >_ | **Shell** | Browser-based SSH terminal (Linux servers only) |
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
| **Search** | Filter the server list by name or IP |
| **Status filter** | Dropdown to filter by: All / Online / Offline / Needs Reboot / Needs Updates |
| **Group filter** | Filter servers by group |
| **Bulk Actions** | Opens the bulk action panel for selected servers |
| **Select All / Deselect All** | Toggles selection of all visible servers |

#### Per-server row buttons

| Button | Description |
|--------|-------------|
| **Checkbox** | Select this server for bulk actions |
| **Status dot** | Green = online, Red = offline, animated glow when online |
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
| **Package count badge** | Number of packages with available updates (e.g. `↑ 14 pkg`) |
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

If no custom logo is uploaded, a default emerald icon is displayed.

### Tokens

Displays the current `AGENT_TOKEN` and `DASHBOARD_TOKEN` values. These are read from the backend environment at runtime.

---

## Agent Installation

### Linux Agent

**Triggered from:** Servers → Add Server wizard → Step 3

The wizard generates a one-line install command that:
1. Detects system architecture (amd64 / arm64)
2. Downloads the pre-compiled Go agent binary from the backend
3. Writes config to `/etc/serverctl/config.yml`
4. Creates and enables a `serverctl-agent` **systemd service** (auto-starts on boot, restarts on failure)

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

**Update agent:**
- **Agents tab** → select agent → **Update Selected** (recommended)
- Per-server: **Manage → Actions → Update Agent**

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

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Submit login form / connect SSH |
| `Esc` | Close modal / dialog |

---

## Security Notes

- Agent tokens are per-server and stored only in the backend registry
- All agent commands go through an explicit allowlist — no arbitrary shell execution is possible
- The Go agent is a compiled binary — no script injection possible
- HTTPS is not handled by ServerCTL — put it behind a reverse proxy (nginx, Caddy, Traefik) for production use
- The backend port should not be directly exposed to the internet — only the frontend port needs to be reachable
- Change the default `admin` / `admin` credentials immediately after first login

---

*ServerCTL v1.3.3 — Infrastructure Control Interface*
