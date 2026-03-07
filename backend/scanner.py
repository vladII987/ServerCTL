"""
Network Scanner — scans a subnet and streams results via WebSocket.
Works correctly because the backend uses network_mode: host.
"""
import asyncio
import ipaddress
import json
import socket
from datetime import datetime

try:
    import httpx
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "-q"])
    import httpx

from fastapi import WebSocket, WebSocketDisconnect
from config import settings

AGENT_PORT  = 8080
CONCURRENCY = {24: 64, 16: 256, 32: 1}


async def ping(ip: str) -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", "1", ip,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=2)
        return proc.returncode == 0
    except Exception:
        return False


async def check_agent(ip: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"http://{ip}:{AGENT_PORT}/health")
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return None


def rdns(ip: str) -> str:
    try:
        return socket.gethostbyaddr(ip)[0].split(".")[0]
    except Exception:
        return ""


def auto_group(ip: str) -> str:
    p = ip.split(".")
    prefix = f"{p[0]}.{p[1]}"
    return {"192.168": "lan", "172.16": "internal", "10.0": "private"}.get(prefix, "other")


async def scan_and_stream(websocket: WebSocket, subnets: list[str]):
    all_found = []
    start = datetime.now()

    for subnet in subnets:
        try:
            network = ipaddress.ip_network(subnet.strip(), strict=False)
        except ValueError as e:
            await websocket.send_json({"type": "error", "message": f"Invalid subnet {subnet}: {e}"})
            continue

        hosts   = list(network.hosts())
        total   = len(hosts)
        prefix  = network.prefixlen
        workers = CONCURRENCY.get(prefix, 128)
        scanned = 0
        found_n = 0
        sem     = asyncio.Semaphore(workers)

        await websocket.send_json({"type": "start", "subnet": subnet,
                                   "total": total, "workers": workers})

        async def scan_one(ip):
            nonlocal scanned, found_n
            async with sem:
                ip_str = str(ip)
                alive  = await ping(ip_str)
                scanned += 1

                if scanned % max(1, total // 20) == 0 or scanned == total:
                    try:
                        await websocket.send_json({
                            "type": "progress", "subnet": subnet,
                            "scanned": scanned, "total": total,
                            "pct": round(scanned / total * 100),
                        })
                    except Exception:
                        pass

                if not alive:
                    return

                agent = await check_agent(ip_str)
                # Hostname: preferuj agent hostname, pa rDNS, pa IP
                hostname = (agent.get("hostname", "") if agent else "") or rdns(ip_str)

                host = {
                    "id":                  ip_str.replace(".", "-"),
                    "ip":                  ip_str,
                    "name":                hostname or ip_str,
                    "host":                ip_str,
                    "group":               auto_group(ip_str),
                    "has_agent":           agent is not None,
                    "agent_url":           f"http://{ip_str}:{AGENT_PORT}",
                    "prometheus_instance": f"{ip_str}:9100",
                    "tags":                ["linux"] + (["agent"] if agent else []),
                    "online":              True,
                }
                found_n += 1
                all_found.append(host)
                try:
                    await websocket.send_json({"type": "found", "host": host})
                except Exception:
                    pass

        await asyncio.gather(*[scan_one(ip) for ip in hosts])
        await websocket.send_json({"type": "subnet_done", "subnet": subnet, "found": found_n})

    duration = (datetime.now() - start).seconds
    await websocket.send_json({"type": "done", "total_found": len(all_found), "duration": duration})


async def handle_scan_websocket(websocket: WebSocket, dashboard_token: str, registry, validate_token=None):
    await websocket.accept()

    try:
        init = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "message": "Timeout"})
        await websocket.close(1008); return

    token = init.get("token", "")
    token_valid = (validate_token(token) if validate_token else token == dashboard_token)
    if not token_valid:
        await websocket.send_json({"type": "error", "message": "Unauthorized"})
        await websocket.close(1008)
        return

    subnets = init.get("subnets", [])
    if not subnets:
        await websocket.send_json({"type": "error", "message": "No subnets provided"})
        await websocket.close(1011); return

    try:
        await scan_and_stream(websocket, subnets)
    except WebSocketDisconnect:
        return
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
        return

    # Čekaj na "add_servers" od klijenta (max 5 min)
    try:
        msg = await asyncio.wait_for(websocket.receive_json(), timeout=300.0)
        if msg.get("type") == "add_servers":
            agent_token = msg.get("agent_token") or settings.AGENT_TOKEN
            added = []
            for s in msg.get("servers", []):
                entry = {
                    "id":                  s["id"],
                    "name":                s["name"],
                    "host":                s["host"],
                    "group":               s.get("group", "other"),
                    "agent_url":           s["agent_url"],
                    "agent_token":         agent_token,
                    "prometheus_instance": s.get("prometheus_instance", f"{s['host']}:9100"),
                    "tags":                s.get("tags", []),
                }
                registry.add(entry)
                added.append(s["id"])
            await websocket.send_json({"type": "servers_added", "count": len(added), "ids": added})
    except (asyncio.TimeoutError, WebSocketDisconnect):
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
