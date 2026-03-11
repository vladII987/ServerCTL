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
from fastapi.responses import PlainTextResponse, FileResponse
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


APP_VERSION = open("/app/VERSION").read().strip() if os.path.exists("/app/VERSION") else "dev"
app = FastAPI(title="ServerCTL Backend", version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Agent WebSocket Registry ─────────────────────────────────
agent_connections: dict[str, WebSocket] = {}
agent_pending: dict[str, asyncio.Future] = {}
agent_metrics: dict[str, dict] = {}
agent_versions: dict[str, str] = {}


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

    await websocket.accept()
    host = server["host"] if server else ""

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=15.0)
        msg = json.loads(raw)

        if msg.get("type") == "register":
            actual_host = msg.get("ip") or websocket.client.host
            hostname = msg.get("hostname", "")
            platform = msg.get("platform", "Linux")

            # Auto-register: agent has a token but no server entry exists
            if not server:
                # Check if server already exists by IP or hostname
                existing = registry.get_by_host(actual_host)
                if not existing and hostname:
                    existing = registry.get_by_hostname(hostname)

                if existing:
                    # Server exists — just update its token to match the agent
                    existing["agent_token"] = token
                    registry.save()
                    server = existing
                    host = existing["host"]
                    print(f"[Agent] Re-linked: {hostname or actual_host} ({actual_host}) — token updated")
                else:
                    s_id = actual_host.replace(".", "-")
                    server = {
                        "id": s_id,
                        "name": hostname or actual_host,
                        "host": actual_host,
                        "group": "auto",
                        "agent_url": f"http://{actual_host}:8080",
                        "agent_token": token,
                        "prometheus_instance": f"{actual_host}:9100",
                        "tags": ["auto-registered"],
                        "platform": platform,
                        "pending_updates": {"count": 0, "packages": None, "reboot_required": False},
                    }
                    registry.add(server)
                    host = actual_host
                    print(f"[Agent] Auto-registered: {hostname or actual_host} ({actual_host}) [{platform}]")
            else:
                # Update host IP if it changed (e.g. DHCP)
                if actual_host and actual_host != host:
                    registry.update_host(server["id"], actual_host)
                    host = actual_host

                if hostname:
                    registry.update_name(server["id"], hostname)
                registry.update_platform(server["id"], platform)

            agent_connections[host] = websocket
            if msg.get("version"):
                agent_versions[host] = msg["version"]
            if msg.get("metrics"):
                agent_metrics[host] = msg["metrics"]
            print(f"[Agent] Connected: {hostname or host} ({host}) [{platform}] v{msg.get('version', '?')}")

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
            "agent_version": agent_versions.get(host, ""),
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


# ─── Probe endpoint ───────────────────────────────────────────────
class ProbeRequest(BaseModel):
    type: str          # ping | tcp | udp | http | db
    host: str
    port: Optional[int] = None
    url: Optional[str] = None
    db_type: Optional[str] = None   # mysql | postgres | mssql | redis | mongo
    timeout: Optional[float] = 3.0

DB_PORTS = {
    "mysql":    3306,
    "postgres": 5432,
    "mssql":    1433,
    "redis":    6379,
    "mongo":    27017,
}

@app.post("/api/probe", dependencies=[Depends(verify)])
async def probe(req: ProbeRequest):
    import socket, time, subprocess, platform

    host    = req.host.strip()
    timeout = min(float(req.timeout or 3.0), 10.0)
    ts      = datetime.utcnow().isoformat() + "Z"

    # ── PING ──────────────────────────────────────────────────────
    if req.type == "ping":
        flag = "-n" if platform.system().lower() == "windows" else "-c"
        try:
            t0 = time.monotonic()
            result = subprocess.run(
                ["ping", flag, "1", "-W", "2", host],
                capture_output=True, text=True, timeout=5
            )
            latency_ms = round((time.monotonic() - t0) * 1000)
            if result.returncode == 0:
                # Try to extract real RTT from ping output
                import re
                m = re.search(r"time[=<]([\d.]+)\s*ms", result.stdout)
                if m:
                    latency_ms = round(float(m.group(1)))
                return {"status": "up", "latency_ms": latency_ms, "ts": ts}
            else:
                return {"status": "timeout", "latency_ms": None, "ts": ts}
        except Exception as e:
            return {"status": "error", "error": str(e), "ts": ts}

    # ── TCP ───────────────────────────────────────────────────────
    if req.type == "tcp":
        port = req.port
        if not port:
            return {"status": "error", "error": "Port required", "ts": ts}
        try:
            t0 = time.monotonic()
            conn = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(conn, timeout=timeout)
            latency_ms = round((time.monotonic() - t0) * 1000)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return {"status": "open", "latency_ms": latency_ms, "ts": ts}
        except asyncio.TimeoutError:
            return {"status": "timeout", "latency_ms": None, "ts": ts}
        except ConnectionRefusedError:
            return {"status": "refused", "latency_ms": None, "ts": ts}
        except Exception as e:
            return {"status": "error", "error": str(e), "ts": ts}

    # ── UDP ───────────────────────────────────────────────────────
    if req.type == "udp":
        port = req.port
        if not port:
            return {"status": "error", "error": "Port required", "ts": ts}
        try:
            loop = asyncio.get_event_loop()
            def _udp_probe():
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(timeout)
                t0 = time.monotonic()
                try:
                    sock.sendto(b"\x00", (host, port))
                    sock.recvfrom(64)
                    latency = round((time.monotonic() - t0) * 1000)
                    return {"status": "open", "latency_ms": latency}
                except socket.timeout:
                    # No ICMP unreachable received — port is likely open/filtered
                    return {"status": "open|filtered", "latency_ms": None}
                except ConnectionResetError:
                    # ICMP port unreachable — port is closed
                    return {"status": "closed", "latency_ms": None}
                except Exception as e:
                    return {"status": "error", "error": str(e)}
                finally:
                    sock.close()
            result = await loop.run_in_executor(None, _udp_probe)
            result["ts"] = ts
            return result
        except Exception as e:
            return {"status": "error", "error": str(e), "ts": ts}

    # ── HTTP ──────────────────────────────────────────────────────
    if req.type == "http":
        url = req.url or f"http://{host}"
        if not url.startswith("http"):
            url = f"http://{url}"
        try:
            t0 = time.monotonic()
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, verify=False) as client:
                r = await client.get(url)
            latency_ms = round((time.monotonic() - t0) * 1000)
            redirect = str(r.headers.get("location", "")) or None
            return {
                "status": "ok",
                "http_status": r.status_code,
                "latency_ms": latency_ms,
                "redirect": redirect,
                "ts": ts,
            }
        except httpx.ConnectTimeout:
            return {"status": "timeout", "ts": ts}
        except httpx.ConnectError:
            return {"status": "unreachable", "ts": ts}
        except Exception as e:
            return {"status": "error", "error": str(e), "ts": ts}

    # ── DB ────────────────────────────────────────────────────────
    if req.type == "db":
        db  = (req.db_type or "mysql").lower()
        port = DB_PORTS.get(db, req.port or 3306)
        try:
            t0 = time.monotonic()
            conn = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(conn, timeout=timeout)
            latency_ms = round((time.monotonic() - t0) * 1000)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return {"status": "open", "latency_ms": latency_ms, "port": port, "ts": ts}
        except asyncio.TimeoutError:
            return {"status": "timeout", "latency_ms": None, "port": port, "ts": ts}
        except ConnectionRefusedError:
            return {"status": "refused", "latency_ms": None, "port": port, "ts": ts}
        except Exception as e:
            return {"status": "error", "error": str(e), "port": port, "ts": ts}

    return {"status": "error", "error": f"Unknown probe type: {req.type}", "ts": ts}


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


@app.get("/api/agent/install-command", dependencies=[Depends(verify)])
async def agent_install_command(request: Request, server_id: str = Query("")):
    """Return the one-liner install commands (Linux + Windows) using the per-server token."""
    server = registry.get(server_id) if server_id else None
    if not server:
        raise HTTPException(404, "Server not found — add the server first")
    token = server["agent_token"]
    base = _get_base_url(request)
    linux_cmd   = f'curl -fsSL "{base}/api/agent/install?token={token}" | sudo sh'
    windows_cmd = f"powershell -Command \"irm '{base}/api/agent/install-windows?token={token}' | iex\""
    return {"command": linux_cmd, "windows_command": windows_cmd}


AGENT_BINS_DIR = os.environ.get("AGENT_BINS_DIR", "/app/agent-bins")

def _get_base_url(request: Request):
    """Build the base URL for agent install scripts.
    Uses PUBLIC_HOST env if set, otherwise extracts the host IP from
    the incoming request and combines with BACKEND_PORT."""
    public_host = os.environ.get("PUBLIC_HOST", "")
    if public_host:
        return f"http://{public_host}:{settings.BACKEND_PORT}"
    # Extract IP from request Host header (user accesses from this IP)
    req_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    host_ip = req_host.split(":")[0] if req_host else "localhost"
    return f"http://{host_ip}:{settings.BACKEND_PORT}"

PLATFORM_MAP = {
    "linux-amd64":    "serverctl-agent-linux-amd64",
    "linux-arm64":    "serverctl-agent-linux-arm64",
    "windows-amd64":  "serverctl-agent-windows-amd64.exe",
}


@app.get("/api/agent/download/{platform}")
async def agent_download(platform: str):
    """Serve a pre-built agent binary. platform = linux-amd64 | linux-arm64 | windows-amd64"""
    filename = PLATFORM_MAP.get(platform)
    if not filename:
        raise HTTPException(400, f"Unknown platform '{platform}'. Use: {', '.join(PLATFORM_MAP)}")
    path = os.path.join(AGENT_BINS_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, f"Binary not found for {platform}. Build with: cd agent-go && make all")
    media = "application/octet-stream"
    return FileResponse(path, media_type=media, filename=filename)


@app.get("/api/agent/install")
async def agent_install(request: Request, token: str = Query("")):
    """Return a shell install script that downloads and installs the Go agent binary."""
    if not token:
        return PlainTextResponse(
            '#!/bin/sh\necho "ERROR: Missing token. Use the install command from the ServerCTL dashboard."\nexit 1\n',
            media_type="text/plain",
        )
    if not registry.get_by_token(token):
        return PlainTextResponse(
            '#!/bin/sh\necho "ERROR: Invalid token. Use the install command from the ServerCTL dashboard."\nexit 1\n',
            media_type="text/plain",
        )

    base_url = _get_base_url(request)

    script = f"""#!/bin/sh
set -e

echo "=========================================="
echo " ServerCtl Agent Installer"
echo "=========================================="

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64)  PLATFORM="linux-amd64" ;;
  aarch64|arm64) PLATFORM="linux-arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

INSTALL_DIR=/usr/local/bin
CONFIG_DIR=/etc/serverctl-agent
BIN=$INSTALL_DIR/serverctl-agent
DL_URL="{base_url}/api/agent/download/$PLATFORM"

# Stop existing agent if running (so binary is not locked)
if systemctl is-active --quiet serverctl-agent 2>/dev/null; then
    echo "[*] Stopping existing agent..."
    systemctl stop serverctl-agent
fi

# Install curl if missing
if ! command -v curl >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y curl
    elif command -v dnf >/dev/null 2>&1; then
        dnf install -y curl
    elif command -v yum >/dev/null 2>&1; then
        yum install -y curl
    fi
fi

echo "[*] Downloading agent ($PLATFORM)..."
curl -fsSL "$DL_URL" -o "$BIN"
chmod 755 "$BIN"

echo "[*] Writing config..."
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.yaml" << 'CFGEOF'
server_url: {base_url}
token: {token}
interval: 30
CFGEOF
chmod 600 "$CONFIG_DIR/config.yaml"

echo "[*] Installing systemd service..."
cat > /etc/systemd/system/serverctl-agent.service << 'SVCEOF'
[Unit]
Description=ServerCtl Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/serverctl-agent
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=serverctl-agent

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable serverctl-agent
systemctl restart serverctl-agent

echo ""
echo "=========================================="
echo " ServerCtl Agent installed!"
echo " Binary:  $BIN"
echo " Config:  $CONFIG_DIR/config.yaml"
echo " Logs:    journalctl -u serverctl-agent -f"
echo "=========================================="
"""
    return PlainTextResponse(script, media_type="text/plain")


@app.get("/api/agent/install-windows-command", dependencies=[Depends(verify)])
async def agent_install_windows_command(request: Request, server_id: str = Query("")):
    """Return the PowerShell one-liner install command for Windows."""
    server = registry.get(server_id) if server_id else None
    if not server:
        raise HTTPException(404, "Server not found — add the server first")
    token = server["agent_token"]
    base = _get_base_url(request)
    cmd = f"powershell -Command \"irm '{base}/api/agent/install-windows?token={token}' | iex\""
    return {"command": cmd}


@app.get("/api/agent/install-windows")
async def agent_install_windows(request: Request, token: str = Query(...)):
    """Return a PowerShell install script that downloads and installs the Go agent binary."""
    if not registry.get_by_token(token):
        raise HTTPException(403, "Invalid token")

    base_url = _get_base_url(request)

    script = f"""# ServerCtl Agent Installer — Windows
# Run as Administrator in PowerShell

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ServerCtl Agent Installer (Windows)"      -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {{
    Write-Error "Run this script as Administrator."; exit 1
}}

$installDir = 'C:\\serverctl-agent'
$exe        = "$installDir\\serverctl-agent.exe"
$cfgFile    = "$installDir\\config.yaml"
$dlUrl      = '{base_url}/api/agent/download/windows-amd64'
$svcName    = 'serverctl-agent'

# Stop and remove existing service/process
Get-Process -Name 'serverctl-agent' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$existing = sc.exe query $svcName 2>&1
if ($existing -notmatch 'FAILED') {{
    Write-Host '[*] Removing existing service...' -ForegroundColor Yellow
    sc.exe stop $svcName 2>&1 | Out-Null
    Start-Sleep 2
    Get-Process -Name 'serverctl-agent' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
    sc.exe delete $svcName 2>&1 | Out-Null
    Start-Sleep 1
}}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host '[*] Downloading agent binary...' -ForegroundColor Yellow
Invoke-WebRequest -Uri $dlUrl -OutFile $exe -UseBasicParsing

Write-Host '[*] Writing config...' -ForegroundColor Yellow
$cfgContent = "server_url: {base_url}`ntoken: {token}`ninterval: 30"
[System.IO.File]::WriteAllText($cfgFile, $cfgContent)

Write-Host '[*] Installing Windows service...' -ForegroundColor Yellow
$binPath = "`"$exe`" -config `"$cfgFile`""
sc.exe create $svcName binPath= $binPath start= auto DisplayName= "ServerCtl Agent"
sc.exe description $svcName "ServerCtl monitoring agent" | Out-Null
sc.exe failure $svcName reset= 60 actions= restart/5000/restart/10000/restart/30000 | Out-Null

Write-Host '[*] Starting service...' -ForegroundColor Yellow
sc.exe start $svcName

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host ' ServerCtl Agent installed!' -ForegroundColor Green
Write-Host " Binary:  $exe" -ForegroundColor Green
Write-Host " Config:  $cfgFile" -ForegroundColor Green
Write-Host " Service: $svcName (services.msc)" -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
"""
    return PlainTextResponse(script, media_type="text/plain")


if __name__ == "__main__":
    print(f"[Backend] Port {settings.BACKEND_PORT}")
    print(f"[Backend] Prometheus: {settings.PROMETHEUS_URL}")
    print(f"[Backend] Servers: {len(registry.all())}")
    uvicorn.run("main:app", host="0.0.0.0", port=settings.BACKEND_PORT, reload=False)
