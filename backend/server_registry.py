"""
Server Registry — čita servers.json, podržava runtime dodavanje servera.
"""
import json
import os
from pathlib import Path
from typing import Optional


class ServerRegistry:
    def __init__(self):
        self._servers: dict[str, dict] = {}
        self._path = Path(__file__).parent / "servers.json"
        self._load()

    def _load(self):
        if self._path.exists():
            with open(self._path) as f:
                data = json.load(f)
            for s in data.get("servers", []):
                self._servers[s["id"]] = s
            print(f"[Registry] Učitano {len(self._servers)} servera iz servers.json")
        else:
            print("[Registry] servers.json nije pronađen — prazan registry.")

    def save(self):
        """Snima trenutni registry u servers.json."""
        clean = []
        for s in self._servers.values():
            clean.append({k: v for k, v in s.items()
                          if k not in ("online", "last_seen")})
        self._path.write_text(json.dumps({"servers": clean}, indent=2, ensure_ascii=False))

    def all(self) -> list[dict]:
        return list(self._servers.values())

    def get(self, server_id: str) -> Optional[dict]:
        return self._servers.get(server_id)

    def add(self, server: dict):
        self._servers[server["id"]] = server
        self.save()

    def get_by_host(self, host: str) -> Optional[dict]:
        for s in self._servers.values():
            if s.get("host") == host:
                return s
        return None

    def get_by_token(self, token: str) -> Optional[dict]:
        """Find server by its unique agent_token."""
        for s in self._servers.values():
            if s.get("agent_token") == token:
                return s
        return None

    def migrate_shared_token(self, old_token: str):
        """Replace shared agent_token with unique per-server tokens on first run."""
        import secrets as _secrets
        changed = False
        for s in self._servers.values():
            if s.get("agent_token") == old_token:
                s["agent_token"] = _secrets.token_hex(32)
                changed = True
        if changed:
            self.save()
            print("[Registry] Migrated shared agent tokens to unique per-server tokens")

    def update_name(self, server_id: str, name: str):
        if server_id in self._servers:
            self._servers[server_id]["name"] = name
            self.save()

    def update_platform(self, server_id: str, platform: str):
        if server_id in self._servers:
            self._servers[server_id]["platform"] = platform
            self.save()

    def update_host(self, server_id: str, host: str):
        """Update the host IP (e.g. after DHCP change) and derived URLs."""
        if server_id in self._servers:
            self._servers[server_id]["host"] = host
            self._servers[server_id]["agent_url"] = f"http://{host}:8080"
            self.save()

    def update_pending_updates(self, host: str, count: int, packages: list, reboot_required: bool = False):
        for s in self._servers.values():
            if s.get("host") == host:
                s["pending_updates"] = {"count": count, "packages": packages, "reboot_required": reboot_required}
                self.save()
                break

    def remove(self, server_id: str) -> bool:
        if server_id in self._servers:
            del self._servers[server_id]
            self.save()
            return True
        return False


registry = ServerRegistry()
