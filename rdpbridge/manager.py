"""
RDP Bridge — Spawns Xtigervnc + xfreerdp per session, proxies raw VNC binary to WebSocket.
Browser (noVNC) ↔ WebSocket ↔ this manager ↔ VNC TCP ↔ Xtigervnc ↔ xfreerdp ↔ Windows RDP
"""
import asyncio
import logging
import os
import socket
from urllib.parse import urlparse, parse_qs

import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MANAGER_PORT = int(os.environ.get("MANAGER_PORT", "8080"))

_used_displays: set = set()
_display_lock = asyncio.Lock()


def _find_free_display() -> int:
    for n in range(10, 110):
        if n not in _used_displays:
            vnc_port = 5900 + n
            try:
                with socket.socket() as s:
                    s.bind(("127.0.0.1", vnc_port))
                return n
            except OSError:
                continue
    raise RuntimeError("No free VNC display numbers available")


async def _wait_for_port(host: str, port: int, timeout: float = 15.0) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            r, w = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=0.5
            )
            w.close()
            await w.wait_closed()
            return True
        except Exception:
            await asyncio.sleep(0.3)
    return False


async def handle_session(websocket):
    parsed = urlparse(websocket.path)
    params = parse_qs(parsed.query)

    def p(key, default=""):
        return params.get(key, [default])[0]

    host = p("host")
    if not host:
        await websocket.close(1008, "missing host parameter")
        return

    rdp_port   = int(p("port", "3389"))
    username   = p("username", "Administrator")
    password   = p("password", "")
    domain     = p("domain", "")
    width      = int(p("width", "1280"))
    height     = int(p("height", "720"))
    security   = p("security", "nla")

    async with _display_lock:
        display_num = _find_free_display()
        _used_displays.add(display_num)

    vnc_port = 5900 + display_num
    xvnc_proc   = None
    rdp_proc    = None
    vnc_writer  = None

    try:
        # ── Start Xtigervnc (virtual X + VNC server) ──────────────
        log.info(f"[:{display_num}] Starting Xtigervnc {width}x{height}")
        xvnc_proc = await asyncio.create_subprocess_exec(
            "Xtigervnc", f":{display_num}",
            "-geometry", f"{width}x{height}",
            "-depth", "24",
            "-SecurityTypes", "None",
            "-localhost", "yes",
            "-nolisten", "tcp6",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

        if not await _wait_for_port("127.0.0.1", vnc_port, timeout=15):
            log.error(f"[:{display_num}] Xtigervnc failed to start")
            await websocket.close(1011, "Xtigervnc failed to start")
            return

        # ── Start xfreerdp rendering into the virtual X display ───
        env = os.environ.copy()
        env["DISPLAY"] = f":{display_num}"

        rdp_cmd = [
            "xfreerdp",
            f"/v:{host}:{rdp_port}",
            f"/u:{username}",
            f"/p:{password}",
            f"/w:{width}",
            f"/h:{height}",
            "/cert-ignore",
            "/dynamic-resolution",
            "+clipboard",
            "-themes",
            "-wallpaper",
            "/bpp:24",
            "/log-level:WARN",
        ]
        if domain:
            rdp_cmd.append(f"/d:{domain}")
        if security == "nla":
            rdp_cmd.append("/sec:nla")
        elif security == "rdp":
            rdp_cmd.append("/sec:rdp")
        # default (empty / "any") → no /sec: flag, FreeRDP negotiates

        log.info(f"[:{display_num}] xfreerdp -> {host}:{rdp_port} user={username}")
        rdp_proc = await asyncio.create_subprocess_exec(
            *rdp_cmd,
            env=env,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

        # Brief pause so FreeRDP can authenticate and draw its first frame
        await asyncio.sleep(2.5)

        # Check that FreeRDP didn't exit immediately (auth failure, etc.)
        if rdp_proc.returncode is not None:
            log.error(f"[:{display_num}] xfreerdp exited with code {rdp_proc.returncode}")
            await websocket.close(1011, f"xfreerdp exited: {rdp_proc.returncode}")
            return

        # ── Open direct TCP connection to the VNC server ──────────
        vnc_reader, vnc_writer = await asyncio.wait_for(
            asyncio.open_connection("127.0.0.1", vnc_port),
            timeout=10,
        )
        log.info(f"[:{display_num}] Proxying VNC ↔ WebSocket")
        await _proxy(websocket, vnc_reader, vnc_writer)

    except Exception as e:
        log.error(f"[:{display_num}] Session error: {e}")
    finally:
        _used_displays.discard(display_num)
        if vnc_writer:
            try:
                vnc_writer.close()
            except Exception:
                pass
        if rdp_proc and rdp_proc.returncode is None:
            try:
                rdp_proc.kill()
            except Exception:
                pass
        if xvnc_proc and xvnc_proc.returncode is None:
            try:
                xvnc_proc.kill()
            except Exception:
                pass
        log.info(f"[:{display_num}] Session cleaned up")


async def _proxy(ws, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Bidirectional relay between a websockets connection and a raw TCP stream."""

    async def ws_to_vnc():
        try:
            async for msg in ws:
                data = msg if isinstance(msg, (bytes, bytearray)) else msg.encode()
                writer.write(data)
                await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

    async def vnc_to_ws():
        try:
            while True:
                data = await reader.read(65536)
                if not data:
                    break
                await ws.send(data)
        except Exception:
            pass

    t1 = asyncio.create_task(ws_to_vnc())
    t2 = asyncio.create_task(vnc_to_ws())
    _, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass


async def main():
    log.info(f"RDP Bridge listening on 0.0.0.0:{MANAGER_PORT}")
    async with websockets.serve(handle_session, "0.0.0.0", MANAGER_PORT, max_size=None):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
