"""
ServerCTL Central Backend
API Gateway: Frontend ← → Backend ← → Agents (WebSocket) / Prometheus
Port: 9090  |  network_mode: host
"""
import asyncio
import json
import csv
import io
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import httpx
import uvicorn
import websockets as ws_lib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header, Query, UploadFile, File
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from server_registry import registry
from ssh_handler import handle_ssh_websocket
from scanner import handle_scan_websocket
import users as user_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    user_module.ensure_default_admin(settings.SECRET_KEY)
    registry.migrate_shared_token(settings.AGENT_TOKEN)
    yield


app = FastAPI(title="ServerCTL Backend", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Agent WebSocket Registry ─────────────────────────────────
agent_connections: dict[str, WebSocket] = {}
agent_pending: dict[str, asyncio.Future] = {}
agent_metrics: dict[str, dict] = {}


# ─── Auth ─────────────────────────────────────────────────────
def _resolve_user(token: str) -> dict:
    """Accept DASHBOARD_TOKEN (legacy admin) or a valid user session token."""
    if token == settings.DASHBOARD_TOKEN:
        return {"username": "admin", "role": "admin"}
    u = user_module.verify_token(token, settings.SECRET_KEY)
    if u:
        return u
    raise HTTPException(status_code=401, detail="Invalid or expired token")


def verify(
    x_session_token: Optional[str] = Header(None),
    x_dashboard_token: Optional[str] = Header(None),
) -> dict:
    token = x_session_token or x_dashboard_token or ""
    return _resolve_user(token)


def verify_admin(user: dict = Depends(verify)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ─── Models ───────────────────────────────────────────────────
class ActionRequest(BaseModel):
    server_id: str
    command:   str
    target:    Optional[str] = None


class ManualServerRequest(BaseModel):
    host:  str
    name:  Optional[str] = None
    group: Optional[str] = "manual"


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role:     str = "user"


# ─── Health ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "online", "timestamp": datetime.utcnow().isoformat()}


# ─── Auth endpoints ───────────────────────────────────────────
@app.post("/api/login")
async def login(req: LoginRequest):
    u = user_module.authenticate(req.username, req.password, settings.SECRET_KEY)
    if not u:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = user_module.make_token(u["username"], u["role"], settings.SECRET_KEY)
    return {"token": token, "username": u["username"], "role": u["role"]}


@app.get("/api/me")
async def me(user: dict = Depends(verify)):
    return user


# ─── User management (admin only) ─────────────────────────────
@app.get("/api/users", dependencies=[Depends(verify_admin)])
async def list_users():
    return {"users": [{"username": u["username"], "role": u["role"]} for u in user_module.load_users()]}


@app.post("/api/users", dependencies=[Depends(verify_admin)])
async def create_user(req: CreateUserRequest):
    if req.role not in ("admin", "user"):
        raise HTTPException(400, "Role must be 'admin' or 'user'")
    existing = user_module.load_users()
    if any(u["username"] == req.username for u in existing):
        raise HTTPException(409, "Username already exists")
    existing.append({
        "username": req.username,
        "password_hash": user_module._hash(req.password, settings.SECRET_KEY),
        "role": req.role,
    })
    user_module.save_users(existing)
    return {"status": "created", "username": req.username, "role": req.role}


@app.delete("/api/users/{username}", dependencies=[Depends(verify_admin)])
async def delete_user(username: str):
    users = user_module.load_users()
    new = [u for u in users if u["username"] != username]
    if len(new) == len(users):
        raise HTTPException(404, "User not found")
    if not any(u["role"] == "admin" for u in new):
        raise HTTPException(400, "Cannot delete the last admin")
    user_module.save_users(new)
    return {"status": "deleted"}


@app.put("/api/users/{username}/password")
async def change_password(username: str, body: dict, user: dict = Depends(verify)):
    if user["role"] != "admin" and user["username"] != username:
        raise HTTPException(403, "Forbidden")
    users = user_module.load_users()
    for u in users:
        if u["username"] == username:
            u["password_hash"] = user_module._hash(body.get("password", ""), settings.SECRET_KEY)
            user_module.save_users(users)
            return {"status": "updated"}
    raise HTTPException(404, "User not found")


# ─── Agent WebSocket endpoint ─────────────────────────────────
@app.websocket("/ws/agent")
async def agent_connect(websocket: WebSocket, token: str = Query(...)):
    server = registry.get_by_token(token)
    if not server:
        await websocket.close(1008)
        return

    await websocket.accept()
    host = server["host"]

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
        msg = json.loads(raw)

        if msg.get("type") == "register":
            actual_host = msg.get("ip") or websocket.client.host
            hostname = msg.get("hostname", "")
            platform = msg.get("platform", "Linux")

            # Update host IP if it changed (e.g. DHCP)
            if actual_host and actual_host != host:
                registry.update_host(server["id"], actual_host)
                host = actual_host

            if hostname:
                registry.update_name(server["id"], hostname)
            registry.update_platform(server["id"], platform)

            agent_connections[host] = websocket
            if msg.get("metrics"):
                agent_metrics[host] = msg["metrics"]
            print(f"[Agent] Connected: {hostname or host} ({host}) [{platform}]")

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "result":
                rid = msg.get("request_id")
                if rid and rid in agent_pending:
                    fut = agent_pending.pop(rid)
                    if not fut.done():
                        fut.set_result(msg.get("result", {}))
            elif msg.get("type") == "report":
                if msg.get("metrics"):
                    agent_metrics[host] = msg["metrics"]
                if msg.get("pending_updates") is not None:
                    pu = msg["pending_updates"]
                    registry.update_pending_updates(host, pu.get("count", 0), pu.get("packages", []), pu.get("reboot_required", False))

    except (WebSocketDisconnect, asyncio.TimeoutError, Exception) as e:
        print(f"[Agent] Disconnected: {host} — {e}")
    finally:
        if host and host in agent_connections:
            del agent_connections[host]


# ─── Servers: List & Ping ──────────────────────────────────────
@app.get("/api/servers", dependencies=[Depends(verify)])
async def get_servers():
    servers = registry.all()
    results = await asyncio.gather(*[_ping(s) for s in servers], return_exceptions=True)
    return {"servers": [r for r in results if isinstance(r, dict)]}


async def _ping(server: dict) -> dict:
    host = server["host"]
    online = host in agent_connections
    return {**server, "online": online,
            "last_seen": datetime.utcnow().isoformat() if online else None}


# ─── Servers: Add / Delete / Import ───────────────────────────
@app.post("/api/servers", dependencies=[Depends(verify)])
async def add_manual_server(req: ManualServerRequest):
    s_id = req.host.replace(".", "-")
    agent_token = secrets.token_hex(32)
    entry = {
        "id":                  s_id,
        "name":                req.name or req.host,
        "host":                req.host,
        "group":               req.group,
        "agent_url":           f"http://{req.host}:8080",
        "agent_token":         agent_token,
        "prometheus_instance": f"{req.host}:9100",
        "tags":                ["manual"],
    }
    registry.add(entry)
    return {"status": "success", "server": entry, "agent_token": agent_token}


@app.post("/api/servers/{server_id}/pending-updates", dependencies=[Depends(verify)])
async def set_pending_updates(server_id: str, body: dict):
    server = registry.get(server_id)
    if not server:
        raise HTTPException(404, "Server not found")
    registry.update_pending_updates(
        server["host"],
        body.get("count", 0),
        body.get("packages", []),
        body.get("reboot_required", False),
    )
    return {"status": "ok"}


@app.delete("/api/servers/{server_id}", dependencies=[Depends(verify_admin)])
async def delete_server(server_id: str):
    if registry.remove(server_id):
        return {"status": "success", "message": f"Server {server_id} removed"}
    raise HTTPException(status_code=404, detail="Server not found")


@app.get("/api/servers/{server_id}/status", dependencies=[Depends(verify)])
async def server_status(server_id: str):
    """Lightweight endpoint — checks only one server, no mass ping."""
    server = registry.get(server_id)
    if not server:
        raise HTTPException(404, "Server not found")
    host = server["host"]
    online = host in agent_connections
    return {**server, "online": online, "last_seen": datetime.utcnow().isoformat() if online else None}


@app.post("/api/servers/csv", dependencies=[Depends(verify)])
async def import_csv(file: UploadFile = File(...)):
    content = await file.read()
    stream  = io.StringIO(content.decode("utf-8"))
    reader  = csv.DictReader(stream)
    added   = 0
    for row in reader:
        if "host" in row:
            host = row["host"]
            entry = {
                "id":                  host.replace(".", "-"),
                "name":                row.get("name") or host,
                "host":                host,
                "group":               row.get("group", "csv-import"),
                "agent_url":           f"http://{host}:8080",
                "agent_token":         secrets.token_hex(32),
                "prometheus_instance": f"{host}:9100",
                "tags":                ["manual", "csv"],
            }
            registry.add(entry)
            added += 1
    return {"status": "success", "imported": added}


# ─── Metrics (Prometheus / Zabbix / Agent) ────────────────────
@app.get("/api/metrics/{server_id}", dependencies=[Depends(verify)])
async def get_metrics(server_id: str):
    server = registry.get(server_id)
    if not server:
        raise HTTPException(404, f"Server '{server_id}' not found")

    host = server["host"]

    # 1. Try Prometheus
    inst     = server.get("prometheus_instance", host)
    prom_url = settings.PROMETHEUS_URL
    queries = {
        "cpu_percent":  f'100-(avg by(instance)(rate(node_cpu_seconds_total{{mode="idle",instance=~"{inst}.*"}}[2m]))*100)',
        "ram_percent":  f'(1-(node_memory_MemAvailable_bytes{{instance=~"{inst}.*"}}/node_memory_MemTotal_bytes{{instance=~"{inst}.*\"}}))*100',
        "ram_used_gb":  f'(node_memory_MemTotal_bytes{{instance=~"{inst}.*"}}-node_memory_MemAvailable_bytes{{instance=~"{inst}.*"}})/1024^3',
        "ram_total_gb": f'node_memory_MemTotal_bytes{{instance=~"{inst}.*"}}/1024^3',
        "disk_percent": f'(1-(node_filesystem_avail_bytes{{instance=~"{inst}.*",mountpoint="/",fstype!="tmpfs"}}/node_filesystem_size_bytes{{instance=~"{inst}.*",mountpoint="/",fstype!="tmpfs"}}))*100',
        "disk_used_gb": f'(node_filesystem_size_bytes{{instance=~"{inst}.*",mountpoint="/",fstype!="tmpfs"}}-node_filesystem_avail_bytes{{instance=~"{inst}.*",mountpoint="/",fstype!="tmpfs"}})/1024^3',
        "disk_total_gb":f'node_filesystem_size_bytes{{instance=~"{inst}.*",mountpoint="/",fstype!="tmpfs"}}/1024^3',
    }
    metrics = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        tasks   = [_prom(client, prom_url, q) for q in queries.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for k, v in zip(queries.keys(), results):
            metrics[k] = round(float(v), 1) if isinstance(v, (int, float)) else None

    # 2. Fall back to WebSocket agent metrics
    if all(v is None for v in metrics.values()):
        if host in agent_metrics:
            return {"server_id": server_id, "metrics": agent_metrics[host],
                    "source": "agent", "timestamp": datetime.utcnow().isoformat()}

    return {"server_id": server_id, "metrics": metrics,
            "source": "prometheus", "timestamp": datetime.utcnow().isoformat()}




async def _prom(client, prom_url, query):
    try:
        r = await client.get(f"{prom_url}/api/v1/query", params={"query": query})
        r.raise_for_status()
        res = r.json().get("data", {}).get("result", [])
        if res: return float(res[0]["value"][1])
    except Exception: pass
    return None


# ─── Actions ──────────────────────────────────────────────────
@app.post("/api/action", dependencies=[Depends(verify)])
async def proxy_action(req: ActionRequest):
    server = registry.get(req.server_id)
    if not server: raise HTTPException(404, "Server not found")

    host = server["host"]

    if host in agent_connections:
        rid = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        fut  = loop.create_future()
        agent_pending[rid] = fut
        try:
            await agent_connections[host].send_json({
                "type":       "command",
                "request_id": rid,
                "command":    req.command,
                "target":     req.target,
            })
            result = await asyncio.wait_for(fut, timeout=130.0)
            return result
        except asyncio.TimeoutError:
            raise HTTPException(504, "Agent command timed out")
        except Exception as e:
            raise HTTPException(502, f"Agent error: {str(e)}")
        finally:
            agent_pending.pop(rid, None)

    try:
        async with httpx.AsyncClient(timeout=130.0) as client:
            r = await client.post(
                f"{server['agent_url']}/api/action",
                json={"command": req.command, "target": req.target},
                headers={"X-API-Token": server["agent_token"]},
            )
            try:
                return r.json()
            except Exception:
                text = r.text.strip() or "(empty response)"
                raise HTTPException(502, f"Agent returned non-JSON (HTTP {r.status_code}): {text[:500]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Agent unreachable: {str(e)}")


# ─── WebSocket: SSH & Logs & Scan ─────────────────────────────
@app.websocket("/ws/logs/{server_id}")
async def proxy_log_stream(websocket: WebSocket, server_id: str):
    await websocket.accept()
    server = registry.get(server_id)
    if not server:
        await websocket.send_json({"error": "Server not found"})
        await websocket.close(); return

    agent_ws_url = server["agent_url"].replace("http://", "ws://") + "/ws/logs"
    try:
        async with ws_lib.connect(agent_ws_url, extra_headers={"X-API-Token": server["agent_token"]}) as aw:
            async def fwd():
                try:
                    while True: await aw.send(await websocket.receive_text())
                except Exception: pass

            async def bwd():
                try:
                    async for msg in aw: await websocket.send_text(msg)
                except Exception: pass

            t = asyncio.create_task(fwd())
            await bwd()
            t.cancel()
    except Exception as e:
        try: await websocket.send_json({"error": str(e)})
        except Exception: pass


def _validate_ws_token(token: str) -> bool:
    if token == settings.DASHBOARD_TOKEN:
        return True
    return user_module.verify_token(token, settings.SECRET_KEY) is not None


@app.websocket("/ws/ssh/{server_id}")
async def ssh_terminal(websocket: WebSocket, server_id: str):
    server = registry.get(server_id)
    if not server:
        await websocket.accept()
        await websocket.send_json({"type": "error", "data": f"\r\nServer '{server_id}' not found\r\n"})
        await websocket.close(1011); return
    await handle_ssh_websocket(websocket, server, settings.DASHBOARD_TOKEN, _validate_ws_token)


@app.websocket("/ws/scan")
async def network_scan(websocket: WebSocket):
    await handle_scan_websocket(websocket, settings.DASHBOARD_TOKEN, registry, _validate_ws_token)


# ─── Agent installer endpoints ────────────────────────────────
@app.post("/api/speedtest", dependencies=[Depends(verify)])
async def backend_speedtest():
    """Run a download speed test to Ubuntu repos from the backend server."""
    import time, urllib.request
    repos = [
        ("Ubuntu Archive",  "http://archive.ubuntu.com/ubuntu/dists/noble/Release"),
        ("Ubuntu Security", "http://security.ubuntu.com/ubuntu/dists/noble-security/Release"),
        ("Ubuntu Updates",  "http://archive.ubuntu.com/ubuntu/dists/noble-updates/Release"),
    ]
    lines = ["[From backend server]"]
    for name, url in repos:
        try:
            start = time.time()
            req = urllib.request.urlopen(url, timeout=10)
            data = req.read(512 * 1024)
            elapsed = time.time() - start
            speed = round(len(data) / elapsed / 1024 / 1024 * 8, 2)
            lines.append(f"{name}: {speed} Mbps  ({round(len(data)/1024)} KB in {round(elapsed,2)}s)")
        except Exception as e:
            lines.append(f"{name}: Error — {e}")
    return {"output": "\n".join(lines)}


@app.get("/api/agent/update-command", dependencies=[Depends(verify)])
async def agent_update_command(request: Request):
    """Return a one-liner that updates an existing agent (download latest + restart)."""
    backend_host = os.environ.get("PUBLIC_HOST", "")
    if not backend_host:
        req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        backend_host = req_host.split(":")[0] if req_host else "localhost"
    dl_url = f"http://{backend_host}:{settings.BACKEND_PORT}/api/agent/script"
    cmd = f'sudo curl -fsSL "{dl_url}" -o /opt/serverctl-agent/agent.py && sudo systemctl restart serverctl-agent'
    return {"command": cmd}


@app.get("/api/agent/install-command", dependencies=[Depends(verify)])
async def agent_install_command(request: Request, server_id: str = Query("")):
    """Return the one-liner install command using the per-server token."""
    server = registry.get(server_id) if server_id else None
    if not server:
        raise HTTPException(404, "Server not found — add the server first")
    token = server["agent_token"]
    backend_host = os.environ.get("PUBLIC_HOST", "")
    if not backend_host:
        req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        backend_host = req_host.split(":")[0] if req_host else "localhost"
    cmd = f'curl -fsSL "http://{backend_host}:{settings.BACKEND_PORT}/api/agent/install?token={token}" | sudo sh'
    return {"command": cmd}


@app.get("/api/agent/script")
async def agent_script():
    """Serve the agent.py source file for download during installation."""
    script_path = os.path.join(os.path.dirname(__file__), "agent.py")
    if not os.path.exists(script_path):
        raise HTTPException(404, "Agent script not found on server")
    with open(script_path) as f:
        content = f.read()
    return PlainTextResponse(content, media_type="text/plain")


@app.get("/api/agent/install")
async def agent_install(request: Request, token: str = Query(...)):
    """Return a shell install script that sets up the ServerCTL agent on a Linux host."""
    if not registry.get_by_token(token):
        raise HTTPException(403, "Invalid token")

    # Detect the public host
    backend_host = os.environ.get("PUBLIC_HOST", "")
    if not backend_host:
        req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        backend_host = req_host.split(":")[0] if req_host else "localhost"

    ws_url = f"ws://{backend_host}:{settings.BACKEND_PORT}/ws/agent"
    dl_url = f"http://{backend_host}:{settings.BACKEND_PORT}/api/agent/script"

    script = f"""#!/bin/bash
set -e

echo "=========================================="
echo " ServerCTL Agent Installer"
echo "=========================================="

# Detect package manager
if command -v apt-get &>/dev/null; then
    PKG=apt
elif command -v yum &>/dev/null; then
    PKG=yum
elif command -v dnf &>/dev/null; then
    PKG=dnf
else
    PKG=unknown
fi

# Install Python3 if missing
if ! command -v python3 &>/dev/null; then
    echo "[*] Installing python3..."
    if [ "$PKG" = "apt" ]; then
        apt-get update -qq && apt-get install -y python3 python3-pip curl
    elif [ "$PKG" = "yum" ]; then
        yum install -y python3 python3-pip curl
    elif [ "$PKG" = "dnf" ]; then
        dnf install -y python3 python3-pip curl
    fi
fi

# Create directories
mkdir -p /opt/serverctl-agent /etc/serverctl/logs

# Download agent script
echo "[*] Downloading agent..."
curl -fsSL "{dl_url}" -o /opt/serverctl-agent/agent.py

# Write config
echo "[*] Writing config..."
cat > /etc/serverctl/config.yml << 'CFGEOF'
server_url: {ws_url}
api_token: {token}
log_file: /etc/serverctl/logs/agent.log
report_interval: 60
CFGEOF

# Install systemd service
echo "[*] Installing systemd service..."
cat > /etc/systemd/system/serverctl-agent.service << 'SVCEOF'
[Unit]
Description=ServerCTL Agent
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/serverctl-agent/agent.py
Restart=always
RestartSec=10
StandardOutput=append:/etc/serverctl/logs/agent.log
StandardError=append:/etc/serverctl/logs/agent.log

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable serverctl-agent
systemctl restart serverctl-agent

echo ""
echo "=========================================="
echo " ServerCTL Agent installed successfully!"
echo " Service: serverctl-agent (systemd)"
echo " Config:  /etc/serverctl/config.yml"
echo " Logs:    /etc/serverctl/logs/agent.log"
echo "=========================================="
"""
    return PlainTextResponse(script, media_type="text/plain")


@app.get("/api/agent/script-windows")
async def agent_script_windows():
    """Serve the Windows agent script for download."""
    script_path = os.path.join(os.path.dirname(__file__), "agent_windows.py")
    if not os.path.exists(script_path):
        raise HTTPException(404, "Windows agent script not found on server")
    with open(script_path) as f:
        content = f.read()
    return PlainTextResponse(content, media_type="text/plain")


@app.get("/api/agent/install-windows-command", dependencies=[Depends(verify)])
async def agent_install_windows_command(request: Request, server_id: str = Query("")):
    """Return the PowerShell one-liner install command for Windows."""
    server = registry.get(server_id) if server_id else None
    if not server:
        raise HTTPException(404, "Server not found — add the server first")
    token = server["agent_token"]
    backend_host = os.environ.get("PUBLIC_HOST", "")
    if not backend_host:
        req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        backend_host = req_host.split(":")[0] if req_host else "localhost"
    cmd = f'powershell -Command "irm \'http://{backend_host}:{settings.BACKEND_PORT}/api/agent/install-windows?token={token}\' | iex"'
    return {"command": cmd}


@app.get("/api/agent/install-windows")
async def agent_install_windows(request: Request, token: str = Query(...)):
    """Return a PowerShell install script for Windows."""
    if not registry.get_by_token(token):
        raise HTTPException(403, "Invalid token")

    backend_host = os.environ.get("PUBLIC_HOST", "")
    if not backend_host:
        req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        backend_host = req_host.split(":")[0] if req_host else "localhost"

    ws_url  = f"ws://{backend_host}:{settings.BACKEND_PORT}/ws/agent"
    dl_url  = f"http://{backend_host}:{settings.BACKEND_PORT}/api/agent/script-windows"

    script = f"""# ServerCTL Agent Installer — Windows
# Run as Administrator in PowerShell

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ServerCTL Agent Installer (Windows)"      -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check admin
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {{
    Write-Error "Run this script as Administrator."; exit 1
}}

# Install Python if missing
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {{
    Write-Host "[*] Installing Python via winget..." -ForegroundColor Yellow
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements -h
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}}

# Install pip dependencies
Write-Host "[*] Installing Python packages..." -ForegroundColor Yellow
python -m pip install --quiet pyyaml psutil "websockets>=12.0"

# Create directories
New-Item -ItemType Directory -Force -Path "C:\\ServerCTL\\logs" | Out-Null

# Download agent
Write-Host "[*] Downloading agent..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "{dl_url}" -OutFile "C:\\ServerCTL\\agent.py" -UseBasicParsing

# Write config
Write-Host "[*] Writing config..." -ForegroundColor Yellow
@"
server_url: {ws_url}
api_token: {token}
log_file: C:\\ServerCTL\\logs\\agent.log
report_interval: 60
"@ | Out-File -FilePath "C:\\ServerCTL\\config.yml" -Encoding UTF8

# Install as Scheduled Task (runs as SYSTEM, restarts on failure)
Write-Host "[*] Installing Scheduled Task..." -ForegroundColor Yellow
$action   = New-ScheduledTaskAction -Execute "python" -Argument "C:\\ServerCTL\\agent.py"
$trigger  = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Unregister-ScheduledTask -TaskName "ServerCTL Agent" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "ServerCTL Agent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "ServerCTL Agent"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " ServerCTL Agent installed successfully!" -ForegroundColor Green
Write-Host " Task:   ServerCTL Agent (Task Scheduler)" -ForegroundColor Green
Write-Host " Config: C:\\ServerCTL\\config.yml"        -ForegroundColor Green
Write-Host " Logs:   C:\\ServerCTL\\logs\\agent.log"   -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
"""
    return PlainTextResponse(script, media_type="text/plain")


if __name__ == "__main__":
    print(f"[Backend] Port {settings.BACKEND_PORT}")
    print(f"[Backend] Prometheus: {settings.PROMETHEUS_URL}")
    print(f"[Backend] Servers: {len(registry.all())}")
    uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=False)
