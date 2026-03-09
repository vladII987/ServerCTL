# ServerCTL — Official Documentation

> **Language note:** All documentation, labels, and UI text are in English.

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
9. [Activity](#activity)
10. [Schedules](#schedules)
11. [Settings](#settings)
12. [Agent Installation](#agent-installation)
    - [Linux](#linux-agent)
    - [Windows](#windows-agent)

---

## Overview

ServerCTL is a self-hosted infrastructure management dashboard. It lets you monitor, manage, and update multiple servers from a single web interface — no VPN required, no inbound ports on managed servers.

**Architecture:**
```
Browser
  └── Frontend (React, served by nginx)
        └── Backend API (FastAPI, Python)
              └── Agent WebSocket connections
                    └── Agent (Python, runs on each managed server)
```

Agents connect **outbound** to the backend over WebSocket. The backend never initiates a connection to a managed server — this means managed servers only need outbound internet access.

---

## Navigation

The left sidebar contains the main navigation. Each section is described below.

| Icon | Section | Purpose |
|------|---------|---------|
| ⬡ | **Dashboard** | Overview of all servers — health, update status, host list |
| ▦ | **Servers** | Full server list, per-server management, bulk actions |
| ⬡ | **Networks** | Network scan, speed test, probe monitor |
| ≡ | **Logs** | Browse and view log files on any server |
| >_ | **Shell** | Browser-based SSH terminal (Linux servers only) |
| ↑ | **Updates** | Servers with pending package updates — apply in bulk |
| ◷ | **Activity** | Log of all actions performed through the dashboard |
| ⏰ | **Schedules** | Scheduled recurring tasks (cron-style) |
| ⚙ | **Settings** | User management, branding, token configuration |

The **Updates** icon shows a badge with the total number of pending packages across all servers.

The **◑ / ◐** button in the top-right toggles between dark and light interface mode.

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

A compact list of all registered servers with their online/offline status indicator, reboot warning (`⚠`), and pending package count badge.

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
| **Bulk Actions** | Opens the bulk action panel for selected servers |
| **Select All / Deselect All** | Toggles selection of all visible servers |

#### Per-server row buttons

| Button | Description |
|--------|-------------|
| **Checkbox** | Select this server for bulk actions |
| **Status dot** | Green = online, Red = offline, animated glow when online |
| **Manage** (or click row) | Opens full per-server management view |
| **SSH** button (>_) | Jumps directly to the Shell tab with this server selected |
| **↺ Reboot** | Appears only for servers with `reboot_required` flag — initiates a reboot with confirmation |

#### Quick filter banners

When a quick filter is active (e.g. "Needs Reboot"), a banner appears at the top with:
- Count of affected servers
- **↺ Rebootuj sve** — reboot all filtered servers at once (admin only)
- **✕ Resetuj filter** — clear the filter

---

### Managing a Server

Click any server row to open the full management view. The header shows the server name, IP, platform, and last-seen time.

#### Header buttons

| Button | Description |
|--------|-------------|
| **← Back** | Return to the server list |
| **↺ Refresh** | Re-fetch all data for this server |
| **✕ Delete** | Permanently remove this server from the registry (admin only) |

---

### Overview Tab

Shows live system data fetched from the agent:

- **CPU Usage** — current load percentage with a visual bar
- **RAM Usage** — used / total with percentage bar
- **Disk Usage** — per-partition usage table (`df -h` output)
- **System Info** — hostname, OS, kernel, uptime, architecture
- **Top Processes** — list of processes sorted by CPU usage with PID, user, CPU%, MEM%, and command

---

### Services Tab

Lists all systemd services (Linux) or Windows services on the managed server.

| Button | Description |
|--------|-------------|
| **▶ Start** | Start the selected service |
| **■ Stop** | Stop the selected service |
| **↺ Restart** | Restart the selected service |
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
| **System Info** | Returns `uname -a` and basic system details |
| **Disk Usage** | Returns `df -h` — disk space per partition |
| **Memory** | Returns `free -h` — RAM and swap usage |
| **CPU Info** | Returns `lscpu` output |
| **Top Processes** | Returns `ps aux` sorted by CPU usage |
| **Netstat** | Returns active network connections (`ss -tulnp`) |
| **Docker PS** | Lists running Docker containers (`docker ps -a`) |
| **Docker Images** | Lists Docker images on the server |
| **Running Services** | Lists all currently running systemd services |
| **Failed Services** | Lists services in a failed state |
| **Check Updates** | Runs `apt-get update` (or equivalent) and reports available packages |
| **Upgrade** | Runs full package upgrade (`apt-get upgrade -y` or equivalent). Requires confirmation. Admin only. |
| **Check Reboot** | Checks whether the server requires a reboot |
| **Reboot** | Reboots the server. Requires confirmation. Admin only. |
| **Update Agent** | Downloads the latest agent script from the backend and restarts the agent service |
| **Ping** | Pings a target host from this server (ICMP) |
| **Traceroute** | Runs traceroute from this server to a target |
| **NSLookup** | Runs DNS lookup from this server |
| **Kill Process** | Sends SIGTERM to a process by PID |

All action output is displayed in a formatted terminal-style output box below the buttons.

---

### Bulk Actions

Select multiple servers using checkboxes, then click **Bulk Actions** to perform an operation on all selected servers simultaneously.

| Button | Description |
|--------|-------------|
| **Check Updates** | Runs `apt-get update` on all selected servers in parallel and reports available packages |
| **Upgrade All** | Runs full package upgrade on all selected servers. Requires confirmation. Admin only. |
| **Check Reboot** | Checks reboot status on all selected servers |
| **Reboot All** | Reboots all selected servers. Requires confirmation. Admin only. |
| **Update Agent** | Updates the agent on all selected servers |

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
| **▶ Run Test** | Starts the speed test |

- On **Linux servers**: tests Ubuntu Archive, Ubuntu Security, and Ubuntu Updates repositories
- On **Windows servers**: tests Microsoft Update CDN, Winget CDN, and Cloudflare
- If **From backend server** is selected: runs from the ServerCTL host itself

Results show download speed in Mbps per endpoint.

---

### Probe Monitor

Tests network connectivity to all registered servers using various protocols. Select servers using checkboxes, choose a probe type, configure options, and click **▶ Run** to test all selected servers at once.

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
| **▶ Run** | Run the probe against all selected servers. Button shows `⟳ Probing...` while in progress and re-enables when complete. |

#### Result display

Each server row shows:
- **Status dot** — green = up/open, amber = filtered/redirect, red = down/timeout/refused
- **Result label** — latency in ms, HTTP status code, or status string
- **Timestamp** — time of the last probe
- **ⓘ icon** — hover to see a human-readable explanation of the result

#### Info tooltip examples

| Result | Tooltip |
|--------|---------|
| `timeout` | Host did not respond within the time limit. Firewall may be blocking ICMP/TCP/UDP. |
| `refused` | Port is closed or the service is not running. Firewall may be sending TCP RST. |
| `open\|filtered` | UDP port returned no ICMP unreachable. Port is likely open but not responding, or filtered. |
| HTTP `200` | OK — Request successful. |
| HTTP `502` | Bad Gateway — Server received an invalid response from an upstream server (reverse proxy problem). |
| HTTP `503` | Service Unavailable — Server temporarily unavailable (overloaded or in maintenance). |

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

The Updates section shows all servers that have pending package updates.

#### Toolbar

| Button | Description |
|--------|-------------|
| **Select All / Deselect All** | Toggle selection of all servers with pending updates |
| **↑ Upgrade Selected** | Runs `apt-get upgrade -y` (or equivalent) on all selected servers. Requires confirmation. Admin only. |

#### Per-server row

| Element | Description |
|---------|-------------|
| **Package count badge** | Number of packages with available updates (e.g. `↑ 14 pkg`) |
| **⚠ Reboot badge** | Indicates the server requires a reboot after previous upgrades |
| **Upgrade** button | Run upgrade on this single server only |
| **Manage** button | Jump to the full server management view |

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
| **Upload Logo** | Upload a custom logo image shown in the top-left of the sidebar |
| **Change Logo** | Replace the current custom logo |
| **Dashboard Title** | Set a custom title shown in the browser tab and sidebar |

If no custom logo is uploaded, the default ServerCTL logo is displayed.

### Tokens

Displays the current `AGENT_TOKEN` and `DASHBOARD_TOKEN` values. These are read from the backend environment at runtime.

---

## Agent Installation

### Linux Agent

**Triggered from:** Servers → Add Server wizard → Step 3

The wizard generates a one-line install command that:
1. Downloads the agent script from the backend (`/api/agent/install`)
2. Creates `/opt/serverctl-agent/agent.py`
3. Writes config to `/etc/serverctl/config.yml`
4. Creates and enables a `serverctl-agent` **systemd service** (auto-starts on boot, restarts on failure)

**Requirement:** Python 3.8+ and `python3-pip` must be installed on the managed server.

**Run on the target server as root:**
```bash
curl -fsSL "http://<serverctl-host>/api/agent/install?token=<TOKEN>&server_id=<ID>" | sudo sh
```

After installation, the agent appears online in the dashboard within seconds.

**Update agent:**
- Per-server: **Manage → Actions → Update Agent**
- Bulk: **Bulk Actions → Update Agent**
- Manual: re-run the install command (it overwrites the existing agent)

---

### Windows Agent

**Triggered from:** Servers → Add Server wizard → Step 3 (select Windows)

The wizard generates a PowerShell command that:
1. Downloads embedded Python 3.11 (portable, no system install required) to `C:\ServerCTL\python\`
2. Installs required Python packages (`websockets`, `pyyaml`, `psutil`)
3. Downloads the Windows agent script to `C:\ServerCTL\agent.py`
4. Writes config to `C:\ServerCTL\config.yml`
5. Downloads **WinSW** (Windows Service Wrapper) from GitHub releases
6. Installs the agent as a **Windows Service** (`ServerCTL-Agent`) visible in `services.msc`
7. Configures the service to auto-start and auto-restart on failure

**Run in PowerShell as Administrator:**
```powershell
iex (iwr -UseBasicParsing "http://<serverctl-host>/api/agent/install-windows?token=<TOKEN>&server_id=<ID>").Content
```

The agent will appear online in the dashboard within seconds.

**Notes:**
- No existing Python installation required on the Windows server
- The service survives logoff and Windows Update reboots
- Service is visible in `services.msc` as `ServerCTL Agent`
- Logs are written to `C:\ServerCTL\logs\agent.log`

**Update agent:**
- Per-server: **Manage → Actions → Update Agent**
- This downloads the latest `agent_windows.py` from the backend and restarts the `ServerCTL-Agent` Windows service

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
- HTTPS is not handled by ServerCTL — put it behind a reverse proxy (nginx, Caddy, Traefik) for production use
- The backend port should not be directly exposed to the internet — only the frontend port needs to be reachable
- Change the default `admin` / `admin` credentials immediately after first login

---

*ServerCTL — Infrastructure Control Interface*
