"""
RDP WebSocket Handler — browser (noVNC) ↔ backend (auth) ↔ rdpbridge ↔ Windows
"""
import asyncio
import os
from urllib.parse import urlencode

import websockets as ws_lib
from fastapi import WebSocket, WebSocketDisconnect

RDPBRIDGE_HOST = os.environ.get("RDPBRIDGE_HOST", "rdpbridge")
RDPBRIDGE_PORT = int(os.environ.get("RDPBRIDGE_PORT", "8080"))


async def handle_rdp_websocket(
    websocket: WebSocket,
    server: dict,
    dashboard_token: str,
    validate_token=None,
    username: str = "Administrator",
    password: str = "",
    domain: str = "",
    rdp_port: int = 3389,
    width: int = 1280,
    height: int = 720,
    security: str = "nla",
    token: str = "",
):
    """Authenticate then proxy raw VNC binary between browser and rdpbridge."""
    # Validate token before accepting the WebSocket
    token_valid = validate_token(token) if validate_token else token == dashboard_token
    if not token_valid:
        await websocket.close(1008)
        return

    await websocket.accept()

    # Build rdpbridge WebSocket URL
    params = urlencode({
        "host":     server["host"],
        "port":     rdp_port,
        "username": username,
        "password": password,
        "domain":   domain,
        "width":    width,
        "height":   height,
        "security": security,
    })
    bridge_url = f"ws://{RDPBRIDGE_HOST}:{RDPBRIDGE_PORT}/?{params}"

    try:
        async with ws_lib.connect(bridge_url, max_size=None) as bridge:
            await _proxy(websocket, bridge)
    except ConnectionRefusedError:
        pass
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _proxy(browser: WebSocket, bridge):
    """Bidirectional binary relay between FastAPI WebSocket and websockets client."""

    async def browser_to_bridge():
        try:
            while True:
                data = await browser.receive_bytes()
                await bridge.send(data)
        except (WebSocketDisconnect, Exception):
            pass

    async def bridge_to_browser():
        try:
            async for msg in bridge:
                if isinstance(msg, (bytes, bytearray)):
                    await browser.send_bytes(bytes(msg))
                else:
                    await browser.send_bytes(msg.encode())
        except Exception:
            pass

    t1 = asyncio.create_task(browser_to_bridge())
    t2 = asyncio.create_task(bridge_to_browser())
    _, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
