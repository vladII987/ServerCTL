"""
Server Registry — backed by SQLite via database.py
Keeps an in-memory cache for fast lookups, writes through to DB.
"""
from typing import Optional

import database as db


class ServerRegistry:
    def __init__(self):
        self._servers: dict[str, dict] = {}
        # Don't load yet — wait for init() after db.init_db()

    def init(self):
        """Called after db.init_db() to load servers from database."""
        self._load()

    def _load(self):
        servers = db.get_all_servers()
        for s in servers:
            self._servers[s["id"]] = s
        print(f"[Registry] Loaded {len(self._servers)} servers from database")

    def save(self):
        """Write all servers to DB (bulk sync)."""
        for s in self._servers.values():
            db.add_server(s)

    def all(self) -> list[dict]:
        return list(self._servers.values())

    def get(self, server_id: str) -> Optional[dict]:
        return self._servers.get(server_id)

    def add(self, server: dict):
        self._servers[server["id"]] = server
        db.add_server(server)

    def get_by_host(self, host: str) -> Optional[dict]:
        for s in self._servers.values():
            if s.get("host") == host:
                return s
        return None

    def get_by_hostname(self, hostname: str) -> Optional[dict]:
        for s in self._servers.values():
            if s.get("name") == hostname:
                return s
        return None

    def get_by_token(self, token: str) -> Optional[dict]:
        for s in self._servers.values():
            if s.get("agent_token") == token:
                return s
        return None

    def migrate_shared_token(self, old_token: str):
        db.migrate_shared_token(old_token)
        # Reload cache
        self._servers.clear()
        self._load()

    def update_name(self, server_id: str, name: str):
        if server_id in self._servers:
            self._servers[server_id]["name"] = name
            db.update_server_name(server_id, name)

    def update_platform(self, server_id: str, platform: str):
        if server_id in self._servers:
            self._servers[server_id]["platform"] = platform
            db.update_server_platform(server_id, platform)

    def update_host(self, server_id: str, host: str):
        if server_id in self._servers:
            self._servers[server_id]["host"] = host
            self._servers[server_id]["agent_url"] = f"http://{host}:8080"
            db.update_server_host(server_id, host)

    def update_pending_updates(self, host: str, count: int, packages: list, reboot_required: bool = False):
        for s in self._servers.values():
            if s.get("host") == host:
                s["pending_updates"] = {"count": count, "packages": packages, "reboot_required": reboot_required}
                db.update_pending_updates(host, count, packages, reboot_required)
                break

    def remove(self, server_id: str) -> bool:
        if server_id in self._servers:
            del self._servers[server_id]
            return db.remove_server(server_id)
        return False


registry = ServerRegistry()
