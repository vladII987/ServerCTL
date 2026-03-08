#!/usr/bin/env python3
"""
ServerCTL Agent — Windows
WebSocket client that connects OUT to the backend.
Config: C:\\ServerCTL\\config.yml
"""
import asyncio, json, logging, os, platform, socket, subprocess, sys, time
from pathlib import Path

try:
    import yaml
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml", "-q"])
    import yaml

try:
    import psutil
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil", "-q"])
    import psutil

try:
    import websockets
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets>=12.0", "-q"])
    import websockets

CONFIG_PATH = os.environ.get("SERVERCTL_CONFIG", r"C:\ServerCTL\config.yml")

pending_updates = {"count": 0, "packages": [], "checked_at": 0}


def ps(command: str, timeout: int = 30) -> str:
    """Run a PowerShell command and return output."""
    result = subprocess.run(
        ["powershell", "-NonInteractive", "-NoProfile", "-Command", command],
        capture_output=True, text=True, timeout=timeout
    )
    return (result.stdout or result.stderr).strip()


def get_os_info() -> str:
    try:
        out = ps("(Get-CimInstance Win32_OperatingSystem).Caption")
        build = ps("(Get-CimInstance Win32_OperatingSystem).BuildNumber")
        return f"{out} (Build {build})".strip() or platform.system()
    except Exception:
        return f"Windows {platform.release()}"


def get_metrics() -> dict:
    try:
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
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


def get_sysinfo_json() -> dict:
    result = {}
    try:
        os_info = ps("Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,LastBootUpTime | ConvertTo-Json")
        data = json.loads(os_info)
        result["os"] = data.get("Caption", "")
        result["os_version"] = data.get("Version", "")
        result["build"] = str(data.get("BuildNumber", ""))
        # Uptime
        boot_str = data.get("LastBootUpTime", "")
        if boot_str:
            try:
                # Format: /Date(timestamp)/
                import re
                m = re.search(r'\d+', boot_str)
                if m:
                    boot_ts = int(m.group()) / 1000
                    secs = time.time() - boot_ts
                    d = int(secs // 86400); h = int((secs % 86400) // 3600); m2 = int((secs % 3600) // 60)
                    result["uptime"] = f"{d} days, {h} hours, {m2} minutes"
            except Exception:
                pass
    except Exception:
        result["os"] = platform.system()

    try:
        cpu_info = ps("Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors | ConvertTo-Json")
        data = json.loads(cpu_info) if cpu_info.startswith("{") else json.loads(cpu_info)[0]
        result["cpu_model"] = data.get("Name", "").strip()
        result["cpu_cores_physical"] = data.get("NumberOfCores", 0)
        result["cpu_cores"] = data.get("NumberOfLogicalProcessors", 0)
    except Exception:
        result["cpu_cores"] = psutil.cpu_count(logical=True)

    try:
        result["architecture"] = platform.machine()
        result["hostname"] = socket.gethostname()
    except Exception:
        pass

    try:
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        result["ram_total_gib"] = round(mem.total / 1024**3, 2)
        result["swap_total_gib"] = round(swap.total / 1024**3, 2)
    except Exception:
        pass

    try:
        disks = []
        for part in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(part.mountpoint)
                disks.append({
                    "device": part.device,
                    "total_gb": round(usage.total / 1e9, 2),
                    "used_gb":  round(usage.used / 1e9, 2),
                    "free_gb":  round(usage.free / 1e9, 2),
                    "pct":      f"{usage.percent}%",
                    "mount":    part.mountpoint,
                })
            except Exception:
                pass
        result["disks"] = disks
    except Exception:
        result["disks"] = []

    try:
        import socket as _socket
        dns = []
        out = ps("Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses")
        for line in out.splitlines():
            line = line.strip()
            if line and not line.startswith("-"):
                dns.append(line)
        result["dns_servers"] = list(dict.fromkeys(dns))
    except Exception:
        result["dns_servers"] = []

    try:
        ifaces = []
        for name, addrs in psutil.net_if_addrs().items():
            stats = psutil.net_if_stats().get(name)
            iface = {"name": name, "up": stats.isup if stats else False,
                     "mtu": stats.mtu if stats else 0, "mac": "", "addresses": []}
            for addr in addrs:
                if addr.family == psutil.AF_LINK:
                    iface["mac"] = addr.address
                elif addr.family == 2:  # AF_INET
                    iface["addresses"].append({"family": "inet", "address": f"{addr.address}/{addr.netmask}"})
                elif addr.family == 23:  # AF_INET6
                    iface["addresses"].append({"family": "inet6", "address": addr.address})
            ifaces.append(iface)
        result["interfaces"] = ifaces
    except Exception:
        result["interfaces"] = []

    return result


def run_command(command: str, target: str = None) -> dict:
    if command == "sysinfo_json":
        return {"status": "completed", "output": json.dumps(get_sysinfo_json()), "returncode": 0}

    if command == "check_reboot":
        try:
            out = ps("""
$keys = @(
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired',
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending',
    'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager'
)
$reboot = $false
if (Test-Path $keys[0]) { $reboot = $true }
if (Test-Path $keys[1]) { $reboot = $true }
$cbsKey = Get-ItemProperty $keys[2] -ErrorAction SilentlyContinue
if ($cbsKey.PendingFileRenameOperations) { $reboot = $true }
if ($reboot) { "1" } else { "0" }
""")
            reboot = out.strip() == "1"
            return {"status": "completed", "output": "1" if reboot else "0", "returncode": 0 if reboot else 1}
        except Exception:
            return {"status": "completed", "output": "0", "returncode": 1}

    if command == "reboot":
        subprocess.Popen(["shutdown", "/r", "/t", "0"])
        return {"status": "completed", "output": "Reboot initiated.", "returncode": 0}

    if command == "system_info":
        out = ps("Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture | Format-List")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "disk_usage":
        out = ps("Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}},@{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}} | Format-Table -AutoSize | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command in ("memory", "memory_info"):
        out = ps("$m=Get-CimInstance Win32_OperatingSystem; \"Total: $([math]::Round($m.TotalVisibleMemorySize/1MB,2)) GB`nFree:  $([math]::Round($m.FreePhysicalMemory/1MB,2)) GB`nUsed:  $([math]::Round(($m.TotalVisibleMemorySize-$m.FreePhysicalMemory)/1MB,2)) GB\"")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "cpu_info":
        out = ps("Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed | Format-List")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "running_services":
        out = ps("Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object Name,DisplayName,Status | Format-Table -AutoSize | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "failed_services":
        out = ps("Get-Service | Where-Object {$_.Status -eq 'Stopped' -and $_.StartType -ne 'Disabled'} | Select-Object Name,DisplayName,Status,StartType | Format-Table -AutoSize | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "list_services":
        out = ps("Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object -ExpandProperty Name | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "service_status":
        target_svc = target or ""
        out = ps(f"Get-Service -Name '{target_svc}' | Select-Object Name,DisplayName,Status,StartType | Format-List")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "top_processes":
        out = ps("Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name,Id,@{N='CPU(s)';E={[math]::Round($_.CPU,1)}},@{N='Mem(MB)';E={[math]::Round($_.WorkingSet/1MB,1)}} | Format-Table -AutoSize | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "netstat":
        out = ps("netstat -ano | Select-Object -First 50 | Out-String")
        return {"status": "completed", "output": out, "returncode": 0}

    if command == "docker_ps":
        try:
            result = subprocess.run(
                ["docker", "ps", "-a", "--format", "{{.Names}}|{{.Image}}|{{.Status}}|{{.ID}}"],
                capture_output=True, text=True, timeout=10
            )
            return {"status": "completed", "output": result.stdout, "returncode": result.returncode}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "docker_images":
        try:
            result = subprocess.run(["docker", "images"], capture_output=True, text=True, timeout=10)
            return {"status": "completed", "output": result.stdout, "returncode": result.returncode}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "upgradable_packages":
        out = ps("""
$s = New-Object -ComObject Microsoft.Update.Session
$q = $s.CreateUpdateSearcher().Search("IsInstalled=0 and Type='Software' and IsHidden=0")
if ($q.Updates.Count -eq 0) { "No pending updates." }
else {
    $q.Updates | ForEach-Object {
        $size = if ($_.MaxDownloadSize -gt 0) { " ($([math]::Round($_.MaxDownloadSize/1MB,1)) MB)" } else { "" }
        "$($_.Title)$size"
    } | Out-String
}
""", timeout=60)
        return {"status": "completed", "output": out.strip() or "No pending updates.", "returncode": 0}

    if command in ("update", "upgrade"):
        out = ps("""
$s = New-Object -ComObject Microsoft.Update.Session
$q = $s.CreateUpdateSearcher().Search("IsInstalled=0 and Type='Software' and IsHidden=0")
if ($q.Updates.Count -eq 0) { "System is up to date. No updates to install."; exit }
Write-Output "Found $($q.Updates.Count) update(s). Downloading and installing..."
$dl = $s.CreateUpdateDownloader(); $dl.Updates = $q.Updates; $dl.Download() | Out-Null
$inst = $s.CreateUpdateInstaller(); $inst.Updates = $q.Updates
$result = $inst.Install()
$q.Updates | ForEach-Object { "  [OK] $($_.Title)" }
Write-Output ""
Write-Output "Installation result: $($result.ResultCode) (0=NotStarted,1=InProgress,2=Succeeded,3=SucceededWithErrors,4=Failed)"
if ($result.RebootRequired) { Write-Output "REBOOT REQUIRED to complete updates." }
""", timeout=600)
        return {"status": "completed", "output": out.strip(), "returncode": 0}

    if command in ("ping", "ping_count"):
        target_host = target or "8.8.8.8"
        result = subprocess.run(["ping", "-n", "4", target_host], capture_output=True, text=True, timeout=30)
        return {"status": "completed" if result.returncode == 0 else "error",
                "output": result.stdout or result.stderr, "returncode": result.returncode}

    if command == "traceroute":
        target_host = target or "8.8.8.8"
        result = subprocess.run(["tracert", target_host], capture_output=True, text=True, timeout=60)
        return {"status": "completed" if result.returncode == 0 else "error",
                "output": result.stdout or result.stderr, "returncode": result.returncode}

    if command == "nslookup":
        target_host = target or "google.com"
        result = subprocess.run(["nslookup", target_host], capture_output=True, text=True, timeout=15)
        return {"status": "completed" if result.returncode == 0 else "error",
                "output": result.stdout or result.stderr, "returncode": result.returncode}

    if command == "kill_process":
        pid = target or ""
        if not pid.isdigit():
            return {"status": "error", "output": "Invalid PID", "returncode": 1}
        result = subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, text=True, timeout=10)
        return {"status": "completed" if result.returncode == 0 else "error",
                "output": result.stdout or result.stderr, "returncode": result.returncode}

    if command == "update_agent":
        try:
            import urllib.request, re as _re
            cfg = load_config()
            base = cfg.get("server_url", "")
            base = _re.sub(r'^ws', 'http', base)
            base = _re.sub(r'/ws/.*', '', base)
            url = f"{base}/api/agent/script-windows"
            agent_path = os.path.abspath(__file__)
            with urllib.request.urlopen(url, timeout=30) as resp:
                new_code = resp.read()
            with open(agent_path, 'wb') as f:
                f.write(new_code)
            subprocess.Popen(["powershell", "-Command",
                              "Start-Sleep 2; Stop-ScheduledTask -TaskName 'ServerCTL Agent'; Start-ScheduledTask -TaskName 'ServerCTL Agent'"])
            return {"status": "completed", "output": "Agent updated — restarting...", "returncode": 0}
        except Exception as e:
            return {"status": "error", "output": str(e), "returncode": 1}

    if command == "repo_speedtest":
        import time, urllib.request
        repos = [
            ("Microsoft CDN",    "https://download.microsoft.com/download/robots.txt"),
            ("Winget source",    "https://cdn.winget.microsoft.com/cache/source.msix"),
            ("Cloudflare",       "https://speed.cloudflare.com/__down?bytes=524288"),
        ]
        lines = ["[Package manager: winget]"]
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

    return {"status": "error", "output": f"Unknown command: {command}", "returncode": 1}


def load_config() -> dict:
    path = Path(CONFIG_PATH)
    if not path.exists():
        print(f"Config not found: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return yaml.safe_load(f)


def get_local_ip(server_url: str) -> str:
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(server_url)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect((parsed.hostname, parsed.port or 8765))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())


async def daily_update_check(interval_hours: int = 24):
    global pending_updates
    await asyncio.sleep(60)
    while True:
        try:
            log.info("Running daily update check (winget)...")
            out = ps("winget upgrade --include-unknown 2>$null | Out-String", timeout=120)
            packages = [line.split()[0] for line in out.splitlines()
                        if line and not line.startswith("-") and not line.startswith("Name")
                        and len(line.split()) >= 3]
            reboot = ps("(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired' -ErrorAction SilentlyContinue) -ne $null").strip().lower() == "true"
            pending_updates = {
                "count": len(packages),
                "packages": packages[:50],
                "checked_at": int(time.time()),
                "reboot_required": reboot,
            }
            log.info(f"Update check done: {len(packages)} upgradable (reboot={reboot})")
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
                log.info(f"Connected — hostname={hostname} ip={local_ip}")
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
    log_file = config.get("log_file", r"C:\ServerCTL\logs\agent.log")
    level    = getattr(logging, config.get("log_level", "info").upper(), logging.INFO)
    Path(log_file).parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )
    log = logging.getLogger(__name__)
    log.info(f"ServerCTL Agent (Windows) starting — config: {CONFIG_PATH}")
    interval = int(config.get("update_check_interval_hours", 24))
    asyncio.run(_run_all(config, interval))


async def _run_all(config: dict, interval: int):
    await asyncio.gather(
        agent_loop(config),
        daily_update_check(interval),
    )


if __name__ == "__main__":
    main()
