#!/usr/bin/env python3
"""
ServerCTL Agent — lightweight WebSocket client
No inbound ports required. Agent connects OUT to the backend.
Config: /etc/serverctl/config.yml
"""
import asyncio, json, logging, os, platform, socket, subprocess, sys
from pathlib import Path

try:
    import yaml
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml", "-q"])
    import yaml

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil", "-q", "--break-system-packages"])
    import psutil

try:
    import websockets
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets>=12.0", "-q"])
    import websockets

CONFIG_PATH = os.environ.get("SERVERCTL_CONFIG", "/etc/serverctl/config.yml")

ALLOWED_COMMANDS = {
    "system_info":      ["uname", "-a"],
    "disk_usage":       ["df", "-h"],
    "memory":           ["free", "-h"],
    "memory_info":      ["free", "-h"],
    "cpu_info":         ["lscpu"],
    "running_services": ["systemctl", "list-units", "--type=service", "--state=running"],
    "failed_services":  ["systemctl", "list-units", "--type=service", "--state=failed"],
    "top_processes":    ["ps", "aux", "--sort=-%cpu"],
    "netstat":          ["ss", "-tulnp"],
    "docker_ps":        ["docker", "ps", "-a", "--format", "{{.Names}}|{{.Image}}|{{.Status}}|{{.ID}}"],
    "docker_images":    ["docker", "images"],
    "update":           ["apt-get", "update", "-y"],
    "ping_count":       ["ping", "-c", "4"],
    "ping":             ["ping", "-c", "4"],
    "traceroute":       ["traceroute"],
    "nslookup":         ["nslookup"],
}


def load_config() -> dict:
    path = Path(CONFIG_PATH)
    if not path.exists():
        print(f"Config not found: {CONFIG_PATH}", file=sys.stderr)
        print("Create it with:", file=sys.stderr)
        print("  server_url: ws://<backend-ip>:9090/ws/agent", file=sys.stderr)
        print("  api_token: <your-token>", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return yaml.safe_load(f)


def get_metrics() -> dict:
    try:
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        return {
            "cpu_percent":  round(cpu, 1),
            "ram_percent":  round(ram.percent, 1),
            "ram_used_gb":  round(ram.used / 1024**3, 2),
            "ram_total_gb": round(ram.total / 1024**3, 2),
            "disk_percent": round(disk.percent, 1),
            "disk_used_gb": round(disk.used / 1024**3, 2),
            "disk_total_gb":round(disk.total / 1024**3, 2),
        }
    except Exception:
        return {}


def run_command(command: str, target: str = None) -> dict:
    cmd = ALLOWED_COMMANDS.get(command)
    if cmd is None:
        return {"status": "error", "output": f"Unknown command: {command}", "returncode": 1}
    cmd = list(cmd)
    if target and command in ("ping_count", "ping", "traceroute", "nslookup"):
        cmd.append(target)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return {
            "status":     "completed" if result.returncode == 0 else "error",
            "output":     result.stdout or result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": "Command timed out", "returncode": 1}
    except Exception as e:
        return {"status": "error", "output": str(e), "returncode": 1}


def get_local_ip(server_url: str) -> str:
    """Get the local IP used to reach the backend (for self-identification)."""
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(server_url)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect((parsed.hostname, parsed.port or 9090))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())


async def agent_loop(config: dict):
    server_url = config["server_url"]
    api_token  = config["api_token"]
    interval   = int(config.get("report_interval", 60))
    hostname   = socket.gethostname()
    local_ip   = get_local_ip(server_url)

    # Append token as query param for authentication
    url = f"{server_url}?token={api_token}"
    delay = 5

    while True:
        try:
            log.info(f"Connecting to {server_url} ...")
            async with websockets.connect(url, ping_interval=30, ping_timeout=10) as ws:
                delay = 5
                log.info(f"Connected — hostname={hostname} ip={local_ip}")

                await ws.send(json.dumps({
                    "type":     "register",
                    "hostname": hostname,
                    "ip":       local_ip,
                    "platform": platform.system(),
                    "metrics":  get_metrics(),
                }))

                async def periodic():
                    while True:
                        await asyncio.sleep(60)
                        try:
                            await ws.send(json.dumps({
                                "type":    "report",
                                "metrics": get_metrics(),
                            }))
                        except Exception:
                            break

                task = asyncio.create_task(periodic())
                try:
                    async for raw in ws:
                        msg = json.loads(raw)
                        if msg.get("type") == "command":
                            log.info(f"Command: {msg.get('command')}")
                            result = run_command(msg.get("command"), msg.get("target"))
                            await ws.send(json.dumps({
                                "type":       "result",
                                "request_id": msg.get("request_id"),
                                "result":     result,
                            }))
                        elif msg.get("type") == "ping":
                            await ws.send(json.dumps({"type": "pong"}))
                finally:
                    task.cancel()

        except Exception as e:
            log.warning(f"Disconnected: {e}. Retry in {delay}s ...")
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)


def main():
    global log
    config   = load_config()
    log_file = config.get("log_file", "/etc/serverctl/logs/agent.log")
    level    = getattr(logging, config.get("log_level", "info").upper(), logging.INFO)

    Path(log_file).parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )
    log = logging.getLogger(__name__)
    log.info(f"ServerCTL Agent starting — config: {CONFIG_PATH}")
    asyncio.run(agent_loop(config))


if __name__ == "__main__":
    main()
