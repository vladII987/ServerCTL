#!/usr/bin/env python3
"""
ServerCTL Agent — lightweight WebSocket client
No inbound ports required. Agent connects OUT to the backend.
Config: /etc/serverctl/config.yml
"""
import asyncio, glob as glob_module, json, logging, os, platform, shutil, socket, subprocess, sys, time
from pathlib import Path

try:
    import yaml
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml", "-q", "--break-system-packages"])
    import yaml

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil", "-q", "--break-system-packages"])
    import psutil

try:
    import websockets
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets>=12.0", "-q", "--break-system-packages"])
    import websockets

CONFIG_PATH = os.environ.get("SERVERCTL_CONFIG", "/etc/serverctl/config.yml")

# Populated by daily_update_check task
pending_updates = {"count": 0, "packages": [], "checked_at": 0}


# ─── Package manager detection ────────────────────────────────
def detect_pkg_manager() -> str:
    """Detect the system package manager."""
    if shutil.which("apt-get"):
        return "apt"
    if shutil.which("dnf"):
        return "dnf"
    if shutil.which("yum"):
        return "yum"
    if shutil.which("zypper"):
        return "zypper"
    return "unknown"


PKG = detect_pkg_manager()

# Per-distro command maps
_PKG_CMDS = {
    "apt": {
        "update":    ["apt-get", "update", "-y"],
        "upgrade":   ["apt-get", "upgrade", "-y"],
        "list_upgradable": ["apt", "list", "--upgradable"],
    },
    "dnf": {
        "update":    ["dnf", "check-update"],
        "upgrade":   ["dnf", "upgrade", "-y"],
        "list_upgradable": ["dnf", "check-update"],
    },
    "yum": {
        "update":    ["yum", "check-update"],
        "upgrade":   ["yum", "update", "-y"],
        "list_upgradable": ["yum", "check-update"],
    },
    "zypper": {
        "update":    ["zypper", "refresh"],
        "upgrade":   ["zypper", "update", "-y"],
        "list_upgradable": ["zypper", "list-updates"],
    },
}

_CMDS = _PKG_CMDS.get(PKG, _PKG_CMDS["apt"])


def parse_upgradable(output: str, pkg_mgr: str) -> list:
    """Parse upgradable package list output into a list of package names."""
    packages = []
    if pkg_mgr == "apt":
        for line in output.split("\n"):
            if line and "/" in line and not line.startswith("Listing"):
                packages.append(line.split("/")[0])
    elif pkg_mgr in ("dnf", "yum"):
        for line in output.split("\n"):
            parts = line.split()
            if len(parts) >= 3 and not line.startswith((" ", "\t", "Last", "Loaded", "Obsoleting", "Security")):
                packages.append(parts[0].split(".")[0])
    elif pkg_mgr == "zypper":
        for line in output.split("\n"):
            if "|" in line and "Name" not in line and "---" not in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 2:
                    packages.append(parts[1])
    return [p for p in packages if p]


def check_reboot_required() -> bool:
    """Check if system needs reboot after updates."""
    # Debian/Ubuntu
    if os.path.exists("/var/run/reboot-required"):
        return True
    # RPM-based (needs-restarting from dnf-utils/yum-utils)
    if shutil.which("needs-restarting"):
        result = subprocess.run(["needs-restarting", "-r"], capture_output=True, timeout=10)
        return result.returncode != 0
    return False


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
    "update":           _CMDS["update"],
    "upgrade":          _CMDS["upgrade"],
    "ping_count":       ["ping", "-c", "4"],
    "ping":             ["ping", "-c", "4"],
    "traceroute":       ["traceroute"],
    "nslookup":         ["nslookup"],
    "list_services":    ["systemctl", "list-units", "--type=service", "--state=running", "--no-pager", "--plain"],
    "service_status":   ["systemctl", "status", "--no-pager"],
    "upgradable_packages": _CMDS["list_upgradable"],
    "sysinfo_json":        None,
    "repo_speedtest":      None,
    "update_agent":        None,
    "check_reboot":        None,  # handled inline
    "reboot":              None,  # handled inline
}


def load_config() -> dict:
    path = Path(CONFIG_PATH)
    if not path.exists():
        print(f"Config not found: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return yaml.safe_load(f)


def get_os_info() -> str:
    try:
        info = {}
        with open('/etc/os-release') as f:
            for line in f:
                line = line.strip()
                if '=' in line:
                    k, v = line.split('=', 1)
                    info[k] = v.strip('"')
        name = info.get('NAME', '')
        version = info.get('VERSION_ID', '')
        return f"{name} {version}".strip() or platform.system()
    except Exception:
        return platform.system()


def get_sysinfo_json() -> dict:
    import re
    result = {}

    try:
        un = platform.uname()
        result['architecture'] = un.machine
        result['kernel_running'] = un.release
        result['hostname'] = un.node
    except Exception:
        pass

    # Installed kernel — dpkg (Debian/Ubuntu)
    try:
        out = subprocess.run(['dpkg', '-l', 'linux-image-*'], capture_output=True, text=True, timeout=10).stdout
        kernels = [l.split()[2].replace('linux-image-', '') for l in out.split('\n') if l.startswith('ii') and 'linux-image-' in l]
        result['kernel_installed'] = kernels[-1] if kernels else result.get('kernel_running', '')
    except Exception:
        # RPM-based fallback
        try:
            out = subprocess.run(['rpm', '-q', 'kernel', '--last'], capture_output=True, text=True, timeout=10).stdout
            kernels = [l.split()[0].replace('kernel-', '') for l in out.strip().split('\n') if l]
            result['kernel_installed'] = kernels[0] if kernels else result.get('kernel_running', '')
        except Exception:
            result['kernel_installed'] = result.get('kernel_running', '')

    try:
        se = subprocess.run(['getenforce'], capture_output=True, text=True, timeout=5)
        result['selinux'] = se.stdout.strip() or 'disabled'
    except Exception:
        result['selinux'] = 'disabled'

    try:
        with open('/proc/uptime') as f:
            secs = float(f.read().split()[0])
        d = int(secs // 86400); h = int((secs % 86400) // 3600); m = int((secs % 3600) // 60)
        result['uptime'] = f"{d} days, {h} hours, {m} minutes"
    except Exception:
        pass

    try:
        result['cpu_cores'] = psutil.cpu_count(logical=True)
        result['cpu_cores_physical'] = psutil.cpu_count(logical=False)
        with open('/proc/cpuinfo') as f:
            for line in f:
                if 'model name' in line:
                    result['cpu_model'] = line.split(':', 1)[1].strip()
                    break
    except Exception:
        pass

    try:
        load = os.getloadavg()
        result['load_avg'] = ', '.join(f'{x:.2f}' for x in load)
    except Exception:
        pass

    try:
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        result['ram_total_gib'] = round(mem.total / 1024**3, 2)
        result['swap_total_gib'] = round(swap.total / 1024**3, 2)
    except Exception:
        pass

    try:
        df = subprocess.run(['df', '-B1'], capture_output=True, text=True, timeout=10).stdout
        disks = []
        for line in df.strip().split('\n')[1:]:
            parts = line.split()
            if len(parts) >= 6 and parts[0].startswith('/dev/'):
                total = int(parts[1]); used = int(parts[2]); free = int(parts[3])
                disks.append({'device': parts[0], 'total_gb': round(total/1e9,2),
                              'used_gb': round(used/1e9,2), 'free_gb': round(free/1e9,2),
                              'pct': parts[4], 'mount': parts[5]})
        result['disks'] = disks
    except Exception:
        result['disks'] = []

    try:
        dns = []
        with open('/etc/resolv.conf') as f:
            for line in f:
                if line.startswith('nameserver'):
                    dns.append(line.split()[1])
        result['dns_servers'] = dns
    except Exception:
        result['dns_servers'] = []

    try:
        ip_out = subprocess.run(['ip', 'addr', 'show'], capture_output=True, text=True, timeout=5).stdout
        route_out = subprocess.run(['ip', 'route', 'show'], capture_output=True, text=True, timeout=5).stdout
        gateways = {}
        for line in route_out.split('\n'):
            m = re.match(r'default via (\S+) dev (\S+)', line)
            if m:
                gateways[m.group(2)] = m.group(1)
        ifaces = []
        cur = None
        for line in ip_out.split('\n'):
            m = re.match(r'\d+: (\S+?):? <([^>]*)> mtu (\d+)', line)
            if m:
                if cur: ifaces.append(cur)
                name = m.group(1); flags = m.group(2)
                cur = {'name': name, 'up': 'UP' in flags.split(','), 'mtu': int(m.group(3)),
                       'mac': '', 'type': 'loopback' if 'LOOPBACK' in flags else 'ethernet',
                       'addresses': [], 'gateway': gateways.get(name, '')}
                continue
            if cur:
                mac_m = re.match(r'\s+link/\w+ ([0-9a-f:]{17})', line)
                if mac_m: cur['mac'] = mac_m.group(1)
                inet_m = re.match(r'\s+(inet6?)\s+(\S+)', line)
                if inet_m: cur['addresses'].append({'family': inet_m.group(1), 'address': inet_m.group(2)})
        if cur: ifaces.append(cur)
        result['interfaces'] = ifaces
    except Exception:
        result['interfaces'] = []

    return result


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
    if command == "sysinfo_json":
        return {"status": "completed", "output": json.dumps(get_sysinfo_json()), "returncode": 0}

    if command == "check_reboot":
        reboot = check_reboot_required()
        return {"status": "completed", "output": "1" if reboot else "0", "returncode": 0 if reboot else 1}

    if command == "reboot":
        subprocess.Popen(["shutdown", "-r", "+0"])
        return {"status": "completed", "output": "Reboot initiated.", "returncode": 0}

    if command == "upgradable_packages":
        try:
            cmd = _CMDS["list_upgradable"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            # dnf/yum return exit code 100 when updates are available (not an error)
            packages = parse_upgradable(result.stdout or result.stderr, PKG)
            return {"status": "completed", "output": result.stdout or result.stderr,
                    "packages": packages, "returncode": 0}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "update_agent":
        try:
            import urllib.request, re as _re
            cfg = load_config()
            base = cfg.get("server_url", "")
            base = _re.sub(r'^ws', 'http', base)
            base = _re.sub(r'/ws/.*', '', base)
            url = f"{base}/api/agent/script"
            agent_path = os.path.abspath(__file__)
            with urllib.request.urlopen(url, timeout=30) as resp:
                new_code = resp.read()
            with open(agent_path, 'wb') as f:
                f.write(new_code)
            subprocess.Popen(["systemctl", "restart", "serverctl-agent"])
            return {"status": "completed", "output": "Agent updated — restarting service...", "returncode": 0}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "repo_speedtest":
        import time, urllib.request
        repos = [
            ("Ubuntu Archive",  "http://archive.ubuntu.com/ubuntu/dists/noble/Release"),
            ("Ubuntu Security", "http://security.ubuntu.com/ubuntu/dists/noble-security/Release"),
            ("Ubuntu Updates",  "http://archive.ubuntu.com/ubuntu/dists/noble-updates/Release"),
        ]
        lines = [f"[Package manager: {PKG}]"]
        for name, url in repos:
            try:
                start = time.time()
                req = urllib.request.urlopen(url, timeout=10)
                data = req.read(512 * 1024)
                elapsed = time.time() - start
                speed = round(len(data) / elapsed / 1024 / 1024 * 8, 2)
                lines.append(f"{name}: {speed} Mbps ({round(len(data)/1024)} KB in {round(elapsed,2)}s)")
            except Exception as e:
                lines.append(f"{name}: Error — {e}")
        return {"status": "completed", "output": "\n".join(lines), "returncode": 0}

    if command == "list_logs":
        patterns = ["/var/log/*.log", "/var/log/syslog", "/var/log/auth.log",
                    "/var/log/kern.log", "/var/log/dpkg.log", "/var/log/messages",
                    "/var/log/secure", "/var/log/dnf.log", "/var/log/yum.log"]
        logs = []
        seen = set()
        for pat in patterns:
            for p in sorted(glob_module.glob(pat)):
                if p not in seen and os.path.isfile(p):
                    seen.add(p)
                    logs.append({"path": p, "name": os.path.basename(p), "size": os.path.getsize(p)})
        return {"status": "completed", "output": json.dumps(logs), "returncode": 0}

    if command == "kill_process":
        pid = target or ""
        if not pid.isdigit():
            return {"status": "error", "output": "Invalid PID", "returncode": 1}
        try:
            result = subprocess.run(["kill", "-15", pid], capture_output=True, text=True, timeout=5)
            return {"status": "completed" if result.returncode == 0 else "error",
                    "output": result.stdout or result.stderr or f"Signal sent to PID {pid}",
                    "returncode": result.returncode}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "view_log":
        path = target or "/var/log/syslog"
        if not path.startswith("/var/log/"):
            return {"status": "error", "output": "Access denied", "returncode": 1}
        try:
            result = subprocess.run(["tail", "-n", "100", path], capture_output=True, text=True, timeout=10)
            return {"status": "completed", "output": result.stdout or result.stderr, "returncode": result.returncode}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    cmd = ALLOWED_COMMANDS.get(command)
    if cmd is None:
        return {"status": "error", "output": f"Unknown command: {command}", "returncode": 1}
    cmd = list(cmd)
    if target and command in ("ping_count", "ping", "traceroute", "nslookup", "service_status"):
        cmd.append(target)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        # dnf/yum check-update returns 100 when updates exist — treat as success
        ok = result.returncode == 0 or (command == "update" and PKG in ("dnf","yum") and result.returncode == 100)
        return {
            "status":     "completed" if ok else "error",
            "output":     result.stdout or result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": "Command timed out", "returncode": 1}
    except Exception as e:
        return {"status": "error", "output": str(e), "returncode": 1}


def get_local_ip(server_url: str) -> str:
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


async def daily_update_check(interval_hours: int = 24):
    """Run package manager update check daily and store upgradable package count."""
    global pending_updates
    await asyncio.sleep(60)
    while True:
        try:
            log.info(f"Running daily update check (pkg: {PKG})...")
            # Refresh package cache
            if PKG == "apt":
                subprocess.run(["apt-get", "update", "-qq"], capture_output=True, timeout=120)
            elif PKG == "dnf":
                subprocess.run(["dnf", "makecache", "--quiet"], capture_output=True, timeout=120)
            elif PKG == "yum":
                subprocess.run(["yum", "makecache", "--quiet"], capture_output=True, timeout=120)
            elif PKG == "zypper":
                subprocess.run(["zypper", "refresh", "-q"], capture_output=True, timeout=120)

            # List upgradable
            result = subprocess.run(_CMDS["list_upgradable"], capture_output=True, text=True, timeout=60)
            packages = parse_upgradable(result.stdout or result.stderr, PKG)
            reboot_required = check_reboot_required()
            pending_updates = {
                "count": len(packages),
                "packages": packages[:50],
                "checked_at": int(time.time()),
                "reboot_required": reboot_required,
            }
            log.info(f"Update check done: {len(packages)} upgradable packages (reboot={reboot_required})")
        except Exception as e:
            log.warning(f"Daily update check failed: {e}")
        await asyncio.sleep(interval_hours * 3600)


async def agent_loop(config: dict):
    server_url = config["server_url"]
    api_token  = config["api_token"]
    hostname   = socket.gethostname()
    local_ip   = get_local_ip(server_url)
    url = f"{server_url}?token={api_token}"
    delay = 5

    while True:
        try:
            log.info(f"Connecting to {server_url} ...")
            async with websockets.connect(url, ping_interval=30, ping_timeout=10) as ws:
                delay = 5
                log.info(f"Connected — hostname={hostname} ip={local_ip} pkg={PKG}")
                await ws.send(json.dumps({
                    "type":     "register",
                    "hostname": hostname,
                    "ip":       local_ip,
                    "platform": get_os_info(),
                    "metrics":  get_metrics(),
                }))

                async def periodic():
                    while True:
                        await asyncio.sleep(60)
                        try:
                            await ws.send(json.dumps({
                                "type":            "report",
                                "metrics":         get_metrics(),
                                "pending_updates": pending_updates,
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
    log.info(f"ServerCTL Agent starting — config: {CONFIG_PATH} | pkg: {PKG}")
    interval = int(config.get("update_check_interval_hours", 24))
    asyncio.run(_run_all(config, interval))


async def _run_all(config: dict, interval: int):
    await asyncio.gather(
        agent_loop(config),
        daily_update_check(interval),
    )


if __name__ == "__main__":
    main()
