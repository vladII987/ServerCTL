"""
Zabbix passive agent client.
Queries metrics directly from a Zabbix agent (port 10050) using the Zabbix protocol.
No Zabbix server required — talks straight to the agent.
"""
import asyncio
import struct

ZABBIX_HEADER = b'ZBXD\x01'


async def _zabbix_request(host: str, port: int, request: bytes, timeout: float) -> str | None:
    """Open a connection, send request bytes, return decoded response data or None."""
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
        writer.write(request)
        await writer.drain()
        raw = await asyncio.wait_for(reader.read(1024 * 64), timeout=timeout)
        writer.close()
        try: await writer.wait_closed()
        except Exception: pass
        if not raw:
            return None
        if raw.startswith(ZABBIX_HEADER) and len(raw) >= 13:
            data_len = struct.unpack('<Q', raw[5:13])[0]
            return raw[13:13 + data_len].decode('utf-8', errors='replace').strip()
        return raw.decode('utf-8', errors='replace').strip()
    except Exception:
        return None


async def zabbix_get(host: str, port: int, key: str, timeout: float = 3.0):
    """Query a single item from a Zabbix passive agent. Returns string value or None.

    Tries the modern protocol (ZBXD header, Zabbix 3+) first, then falls back to
    the legacy bare-text format (Zabbix 1.x / 2.x / old zabbix-agent).
    """
    payload = key.encode('utf-8')

    # Modern protocol: ZBXD\x01 + 8-byte LE length + key
    result = await _zabbix_request(
        host, port,
        ZABBIX_HEADER + struct.pack('<Q', len(payload)) + payload,
        timeout,
    )
    if result and result not in ('ZBX_NOTSUPPORTED', ''):
        return result

    # Legacy protocol: bare text key + newline
    result = await _zabbix_request(host, port, payload + b'\n', timeout)
    if result and result not in ('ZBX_NOTSUPPORTED', ''):
        return result

    return None


async def get_zabbix_metrics(host: str, port: int = 10050) -> dict:
    """Fetch standard system metrics from a Zabbix passive agent."""
    keys = {
        'cpu_percent':  'system.cpu.util',
        'ram_percent':  'vm.memory.size[pused]',
        'ram_used_gb':  'vm.memory.size[used]',
        'ram_total_gb': 'vm.memory.size[total]',
        'disk_percent': 'vfs.fs.size[/,pused]',
        'disk_used_gb': 'vfs.fs.size[/,used]',
        'disk_total_gb':'vfs.fs.size[/,total]',
    }
    GB = 1024 ** 3
    tasks = {k: zabbix_get(host, port, v) for k, v in keys.items()}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    raw = dict(zip(tasks.keys(), results))

    def safe_float(v, divisor=1):
        try:
            return round(float(v) / divisor, 2) if v and not isinstance(v, Exception) else None
        except Exception:
            return None

    return {
        'cpu_percent':  safe_float(raw.get('cpu_percent')),
        'ram_percent':  safe_float(raw.get('ram_percent')),
        'ram_used_gb':  safe_float(raw.get('ram_used_gb'), GB),
        'ram_total_gb': safe_float(raw.get('ram_total_gb'), GB),
        'disk_percent': safe_float(raw.get('disk_percent')),
        'disk_used_gb': safe_float(raw.get('disk_used_gb'), GB),
        'disk_total_gb':safe_float(raw.get('disk_total_gb'), GB),
    }


async def check_zabbix_agent(host: str, port: int = 10050) -> bool:
    """Check if a Zabbix agent is reachable on the given host:port."""
    result = await zabbix_get(host, port, 'agent.ping', timeout=2.0)
    return result == '1'


async def get_zabbix_hostname(host: str, port: int = 10050) -> str:
    result = await zabbix_get(host, port, 'system.hostname', timeout=2.0)
    return result or ''


async def get_zabbix_os(host: str, port: int = 10050) -> str:
    result = await zabbix_get(host, port, 'system.sw.os', timeout=2.0)
    return result or ''
