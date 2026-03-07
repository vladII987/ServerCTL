"""
SSH WebSocket Handler — xterm.js ↔ WebSocket ↔ asyncssh ↔ target server
"""
import asyncio
import base64
import json
import os
import tempfile

try:
    import asyncssh
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "asyncssh", "-q"])
    import asyncssh

from fastapi import WebSocket, WebSocketDisconnect


class SSHSession:
    def __init__(self, ws: WebSocket):
        self.ws      = ws
        self.conn    = None
        self.process = None
        self._closed = False

    async def connect(self, host: str, port: int, auth: dict) -> bool:
        method   = auth.get("method", "password")
        username = auth.get("username", "root")
        opts = {"host": host, "port": port, "username": username,
                "known_hosts": None, "connect_timeout": 10,
                "keepalive_interval": 60, "keepalive_count_max": 15}
        tmp = None
        try:
            if method == "password":
                opts["password"] = auth.get("password", "")
            elif method == "key_upload":
                raw = auth.get("key_data", "")
                if "," in raw:
                    raw = raw.split(",", 1)[1]
                    pem = base64.b64decode(raw).decode()
                elif raw.startswith("-----"):
                    pem = raw
                else:
                    pem = base64.b64decode(raw).decode()
                t = tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False, dir="/tmp")
                t.write(pem); t.close()
                os.chmod(t.name, 0o600)
                tmp = t.name
                opts["client_keys"] = [tmp]
            elif method == "key_path":
                kp = os.path.expanduser(auth.get("key_path", "~/.ssh/id_rsa"))
                if not os.path.exists(kp):
                    await self._write(f"\r\n\033[31m✗ Key not found: {kp}\033[0m\r\n"); return False
                opts["client_keys"] = [kp]

            self.conn = await asyncssh.connect(**opts)
            return True
        except asyncssh.PermissionDenied:
            await self._write("\r\n\033[31m✗ Permission denied\033[0m\r\n")
        except Exception as e:
            await self._write(f"\r\n\033[31m✗ {e}\033[0m\r\n")
        finally:
            if tmp and os.path.exists(tmp): os.unlink(tmp)
        return False

    async def start_shell(self, cols=220, rows=50):
        self.process = await self.conn.create_process(
            term_type="xterm-256color", term_size=(cols, rows))

    async def relay(self):
        t1 = asyncio.create_task(self._ws_to_ssh())
        t2 = asyncio.create_task(self._ssh_to_ws())
        done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()
            try: await t
            except asyncio.CancelledError: pass

    async def _ws_to_ssh(self):
        try:
            while not self._closed:
                raw = await self.ws.receive_text()
                msg = json.loads(raw)
                if msg["type"] == "input":
                    self.process.stdin.write(msg["data"])
                elif msg["type"] == "resize":
                    self.process.change_terminal_size(msg.get("cols", 220), msg.get("rows", 50))
                elif msg["type"] == "close":
                    self._closed = True; break
        except Exception:
            self._closed = True

    async def _ssh_to_ws(self):
        try:
            while not self._closed:
                data = await self.process.stdout.read(4096)
                if not data: break
                await self.ws.send_json({"type": "output", "data": data})
        except Exception:
            self._closed = True

    async def _write(self, msg: str):
        try: await self.ws.send_json({"type": "error", "data": msg})
        except Exception: pass

    async def close(self):
        self._closed = True
        try:
            if self.process: self.process.close()
        except Exception: pass
        try:
            if self.conn: self.conn.close()
        except Exception: pass


async def handle_ssh_websocket(websocket: WebSocket, server: dict, dashboard_token: str, validate_token=None):
    await websocket.accept()
    try:
        init = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "data": "\r\nTimeout\r\n"})
        await websocket.close(1008); return

    token = init.get("token", "")
    token_valid = validate_token(token) if validate_token else token == dashboard_token
    if not token_valid:
        await websocket.send_json({"type": "error", "data": "\r\n\033[31mUnauthorized\033[0m\r\n"})
        await websocket.close(1008); return

    host = server["host"]
    ssh_port = int(init.get("ssh_port", 22))
    cols = int(init.get("cols", 220))
    rows = int(init.get("rows", 50))

    await websocket.send_json({"type": "output",
        "data": f"\r\n\033[36m⟶  Connecting to {init.get('username','?')}@{host}:{ssh_port}...\033[0m\r\n"})

    session = SSHSession(websocket)
    try:
        if not await session.connect(host, ssh_port, init):
            await websocket.close(1011); return
        await session.start_shell(cols, rows)
        await websocket.send_json({"type": "output", "data": "\033[32m✓ Connected\033[0m\r\n"})
        await session.relay()
    except Exception as e:
        try: await websocket.send_json({"type": "error", "data": f"\r\n\033[31m{e}\033[0m\r\n"})
        except Exception: pass
    finally:
        await session.close()
        try: await websocket.close()
        except Exception: pass
