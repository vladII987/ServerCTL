"""
RDP WebSocket Handler — guacamole-common-js ↔ WebSocket ↔ guacd ↔ target Windows server
"""
import asyncio
import json
import logging
import os

from fastapi import WebSocket, WebSocketDisconnect

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("guacamole")


GUACD_HOST = os.environ.get("GUACD_HOST", "guacd")
GUACD_PORT = int(os.environ.get("GUACD_PORT", "4822"))


def encode_guac(*args):
    """Encode a Guacamole protocol instruction."""
    parts = []
    for arg in args:
        s = str(arg)
        parts.append(f"{len(s)}.{s}")
    return ",".join(parts) + ";"


def decode_guac(data: str):
    """Decode a single Guacamole protocol instruction, return (fields, consumed)."""
    fields = []
    i = 0
    while i < len(data):
        if data[i] == ';':
            return fields, i + 1
        dot_pos = data.find('.', i)
        if dot_pos == -1:
            return fields, len(data)
        try:
            length = int(data[i:dot_pos])
        except ValueError:
            return fields, len(data)
        value = data[dot_pos + 1:dot_pos + 1 + length]
        fields.append(value)
        i = dot_pos + 1 + length
        if i < len(data) and data[i] == ',':
            i += 1
    return fields, len(data)


class GuacamoleSession:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.reader = None
        self.writer = None
        self._closed = False

    async def connect_guacd(self):
        """Connect to guacd daemon."""
        logger.info(f"Connecting to guacd at {GUACD_HOST}:{GUACD_PORT}")
        self.reader, self.writer = await asyncio.wait_for(
            asyncio.open_connection(GUACD_HOST, GUACD_PORT),
            timeout=10
        )
        logger.info("Connected to guacd")

    async def handshake(self, host: str, port: int, username: str, password: str,
                        width: int, height: int, dpi: int, security: str = "",
                        ignore_cert: str = "true", resize_method: str = "display-update",
                        enable_wallpaper: str = "false", domain: str = ""):
        """Perform Guacamole protocol handshake for RDP."""
        logger.info(f"Handshake: host={host}, port={port}, username={username}, domain={domain}, security={security or 'nla'}")

        # Step 1: Select RDP protocol
        select_instr = encode_guac("select", "rdp")
        logger.debug(f"Sending select: {select_instr}")
        self.writer.write(select_instr.encode("utf-8"))
        await self.writer.drain()

        # Step 2: Read args instruction from guacd
        logger.debug("Waiting for args from guacd...")
        args_raw = await self._read_guacd_instruction()
        if not args_raw:
            logger.error("No response from guacd (args)")
            return False
        logger.debug(f"Received args: {args_raw}")
        fields, _ = decode_guac(args_raw)
        if not fields or fields[0] != "args":
            logger.error(f"Unexpected response from guacd: {fields}")
            return False

        param_names = fields[1:]
        logger.info(f"Guacamole RDP params: {param_names}")

        # Step 3: Build parameter values
        param_map = {
            "VERSION_1_5_0": "VERSION_1_5_0",
            "hostname": host,
            "port": str(port),
            "username": username,
            "password": password,
            "width": str(width),
            "height": str(height),
            "dpi": str(dpi),
            "security": security or "tls",
            "ignore-cert": ignore_cert,
            "resize-method": resize_method,
            "enable-wallpaper": enable_wallpaper,
            "domain": domain,
            "disable-auth": "true",
            "server-layout": "en-us-qwerty",
            "color-depth": "24",
            "enable-font-smoothing": "true",
            "disable-audio": "true",
            "disable-printing": "true",
            "enable-drive": "false",
            "create-drive-path": "",
            "console": "",
            "console-audio": "",
            "enable-audio": "",
            "enable-audio-input": "",
            "timezone": "",
            "client-name": "ServerCTL",
        }

        param_values = []
        for name in param_names:
            val = param_map.get(name, "")
            param_values.append(val)
            logger.debug(f"  param {name} = {val}")

        connect_instr = encode_guac("connect", *param_values)
        logger.info(f"Sending connect instruction")
        self.writer.write(connect_instr.encode("utf-8"))
        await self.writer.drain()

        # Step 4: Read ready instruction
        logger.debug("Waiting for ready from guacd...")
        ready_raw = await self._read_guacd_instruction()
        if not ready_raw:
            logger.error("No response from guacd (ready)")
            return None
        logger.info(f"Received ready: {ready_raw}")
        ready_fields, _ = decode_guac(ready_raw)
        if not ready_fields or ready_fields[0] != "ready":
            # Could be an error instruction
            if ready_fields and ready_fields[0] == "error":
                error_msg = ready_fields[1] if len(ready_fields) > 1 else "Unknown error"
                logger.error(f"Guacamole error: {error_msg}")
                await self._ws_send_error(f"Guacamole error: {error_msg}")
            else:
                logger.error(f"Unexpected response (not ready): {ready_fields}")
            return None

        logger.info("RDP handshake successful!")
        # Return the raw ready instruction so the caller can forward it to the browser.
        # Guacamole.Client needs to receive "ready" to transition to STATE_CONNECTED.
        return ready_raw

    async def relay(self):
        """Bidirectional relay between browser WebSocket and guacd."""
        logger.info("Starting relay between browser and guacd")
        t1 = asyncio.create_task(self._ws_to_guacd())
        t2 = asyncio.create_task(self._guacd_to_ws())
        done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
        logger.info(f"Relay ended. Done task: {done}, pending: {pending}")
        for t in pending:
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass

    async def _ws_to_guacd(self):
        """Forward Guacamole instructions from browser to guacd."""
        try:
            while not self._closed:
                data = await self.ws.receive_text()
                logger.info(f"Data from browser to guacd: {data[:100]}...")
                if self.writer and not self.writer.is_closing():
                    self.writer.write(data.encode("utf-8"))
                    await self.writer.drain()
        except (WebSocketDisconnect, Exception) as e:
            logger.info(f"Browser WebSocket closed: {e}")
            self._closed = True

    async def _guacd_to_ws(self):
        """Forward Guacamole instructions from guacd to browser."""
        try:
            while not self._closed:
                data = await self.reader.read(65536)
                if not data:
                    logger.info("guacd connection closed (no data)")
                    break
                text = data.decode("utf-8", errors="replace")
                logger.info(f"Data from guacd to browser: {text[:200]}...")
                await self.ws.send_text(text)
        except Exception as e:
            logger.info(f"guacd connection closed: {e}")
            self._closed = True

    async def _read_guacd_instruction(self):
        """Read a complete Guacamole instruction from guacd."""
        buf = b""
        try:
            while True:
                chunk = await asyncio.wait_for(self.reader.read(4096), timeout=15)
                if not chunk:
                    return None
                buf += chunk
                text = buf.decode("utf-8", errors="replace")
                if ";" in text:
                    return text
        except (asyncio.TimeoutError, Exception):
            return None

    async def _ws_send_error(self, msg: str):
        """Send error message to browser via a Guacamole error instruction."""
        try:
            error_instr = encode_guac("error", msg, "519")
            await self.ws.send_text(error_instr)
        except Exception:
            pass

    async def close(self):
        self._closed = True
        try:
            if self.writer and not self.writer.is_closing():
                # Send disconnect instruction
                self.writer.write(encode_guac("disconnect").encode("utf-8"))
                await self.writer.drain()
                self.writer.close()
        except Exception:
            pass


async def handle_rdp_websocket(websocket: WebSocket, server: dict, dashboard_token: str, validate_token=None):
    """Handle WebSocket connection for RDP via guacd."""
    logger.info(f"RDP WebSocket connection request for server: {server.get('id')} ({server.get('host')})")
    await websocket.accept()

    # Read initial configuration from browser
    try:
        init = await asyncio.wait_for(websocket.receive_json(), timeout=15.0)
    except asyncio.TimeoutError:
        logger.error("Timeout waiting for configuration from browser")
        error_instr = encode_guac("error", "Timeout waiting for configuration", "519")
        await websocket.send_text(error_instr)
        await websocket.close(1008)
        return

    logger.info(f"Received init data: rdp_port={init.get('rdp_port')}, username={init.get('username')}, security={init.get('security')}")

    # Validate token
    token = init.get("token", "")
    token_valid = validate_token(token) if validate_token else token == dashboard_token
    if not token_valid:
        logger.error(f"Invalid token for RDP connection")
        error_instr = encode_guac("error", "Unauthorized", "519")
        await websocket.send_text(error_instr)
        await websocket.close(1008)
        return

    host = server["host"]
    rdp_port = int(init.get("rdp_port", 3389))
    username = init.get("username", "Administrator")
    password = init.get("password", "")
    domain = init.get("domain", "")
    width = int(init.get("width", 1280))
    height = int(init.get("height", 720))
    dpi = int(init.get("dpi", 96))
    security = init.get("security", "")
    ignore_cert = init.get("ignore_cert", "true")

    logger.info(f"Connecting RDP: {username}@{host}:{rdp_port}, domain={domain}, security={security or 'nla'}")

    session = GuacamoleSession(websocket)
    try:
        await session.connect_guacd()

        ready_raw = await session.handshake(
            host=host, port=rdp_port, username=username, password=password,
            width=width, height=height, dpi=dpi, security=security,
            ignore_cert=ignore_cert, domain=domain
        )
        if ready_raw is None:
            logger.error("Handshake failed - closing connection")
            await websocket.close(1011)
            return

        logger.info("Handshake complete, forwarding ready to browser and starting relay")
        # Forward the "ready" instruction to the browser so Guacamole.Client
        # transitions to STATE_CONNECTED and starts processing display data.
        await websocket.send_text(ready_raw)

        await session.relay()
    except ConnectionRefusedError:
        logger.error("Connection refused to guacd")
        error_instr = encode_guac("error", "Cannot connect to guacd service", "519")
        try:
            await websocket.send_text(error_instr)
        except Exception:
            pass
    except Exception as e:
        logger.exception(f"RDP connection error: {e}")
        error_instr = encode_guac("error", str(e), "519")
        try:
            await websocket.send_text(error_instr)
        except Exception:
            pass
    finally:
        logger.info("Closing RDP connection")
        await session.close()
        try:
            await websocket.close()
        except Exception:
            pass
