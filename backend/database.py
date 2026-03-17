"""
SQLite database for ServerCTL — replaces servers.json and users.json
"""
import sqlite3
import json
import os
import threading
from pathlib import Path

_default_db = os.path.join(os.path.dirname(__file__), "data", "serverctl.db")
DB_PATH = os.environ.get("SERVERCTL_DB", _default_db)
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    """Thread-local connection with WAL mode for concurrent reads."""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn


def init_db():
    """Create tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username     TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role         TEXT NOT NULL DEFAULT 'user'
        );

        CREATE TABLE IF NOT EXISTS servers (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            host                TEXT NOT NULL,
            "group"             TEXT DEFAULT '',
            agent_url           TEXT DEFAULT '',
            agent_token         TEXT DEFAULT '',
            prometheus_instance TEXT DEFAULT '',
            tags                TEXT DEFAULT '[]',
            platform            TEXT DEFAULT 'Linux',
            pending_updates     TEXT DEFAULT '{"count":0,"packages":null,"reboot_required":false}'
        );
    """)
    conn.commit()


def migrate_from_json():
    """One-time migration: import existing JSON files into SQLite."""
    conn = _get_conn()

    # Migrate users.json
    users_path = Path(__file__).parent / "users.json"
    if users_path.exists():
        try:
            users = json.loads(users_path.read_text())
            if isinstance(users, list) and users:
                for u in users:
                    conn.execute(
                        "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                        (u["username"], u["password_hash"], u.get("role", "user")),
                    )
                conn.commit()
                # Rename old file as backup
                users_path.rename(users_path.with_suffix(".json.bak"))
                print(f"[DB] Migrated {len(users)} users from users.json")
        except Exception as e:
            print(f"[DB] Error migrating users.json: {e}")

    # Migrate servers.json
    servers_path = Path(__file__).parent / "servers.json"
    if servers_path.exists():
        try:
            data = json.loads(servers_path.read_text())
            servers = data.get("servers", []) if isinstance(data, dict) else []
            if servers:
                for s in servers:
                    conn.execute(
                        """INSERT OR IGNORE INTO servers
                           (id, name, host, "group", agent_url, agent_token,
                            prometheus_instance, tags, platform, pending_updates)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            s["id"],
                            s.get("name", s.get("host", "")),
                            s["host"],
                            s.get("group", ""),
                            s.get("agent_url", ""),
                            s.get("agent_token", ""),
                            s.get("prometheus_instance", ""),
                            json.dumps(s.get("tags", [])),
                            s.get("platform", "Linux"),
                            json.dumps(s.get("pending_updates", {"count": 0, "packages": None, "reboot_required": False})),
                        ),
                    )
                conn.commit()
                servers_path.rename(servers_path.with_suffix(".json.bak"))
                print(f"[DB] Migrated {len(servers)} servers from servers.json")
        except Exception as e:
            print(f"[DB] Error migrating servers.json: {e}")


# ─── User operations ────────────────────────────────────────────

def load_users() -> list[dict]:
    conn = _get_conn()
    rows = conn.execute("SELECT username, password_hash, role FROM users").fetchall()
    return [dict(r) for r in rows]


def save_users(users: list[dict]):
    conn = _get_conn()
    conn.execute("DELETE FROM users")
    for u in users:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (u["username"], u["password_hash"], u.get("role", "user")),
        )
    conn.commit()


def get_user(username: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT username, password_hash, role FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def add_user(username: str, password_hash: str, role: str = "user"):
    conn = _get_conn()
    conn.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        (username, password_hash, role),
    )
    conn.commit()


def delete_user(username: str) -> bool:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    return cur.rowcount > 0


def update_user_password(username: str, password_hash: str) -> bool:
    conn = _get_conn()
    cur = conn.execute("UPDATE users SET password_hash = ? WHERE username = ?", (password_hash, username))
    conn.commit()
    return cur.rowcount > 0


def count_admins() -> int:
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()
    return row[0]


# ─── Server operations ──────────────────────────────────────────

def _row_to_server(row: sqlite3.Row) -> dict:
    """Convert a DB row to the server dict format the app expects."""
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    d["pending_updates"] = json.loads(d.get("pending_updates") or '{"count":0,"packages":null,"reboot_required":false}')
    d["group"] = d.get("group") or ""
    return d


def get_all_servers() -> list[dict]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM servers").fetchall()
    return [_row_to_server(r) for r in rows]


def get_server(server_id: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()
    return _row_to_server(row) if row else None


def get_server_by_host(host: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM servers WHERE host = ?", (host,)).fetchone()
    return _row_to_server(row) if row else None


def get_server_by_hostname(hostname: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM servers WHERE name = ?", (hostname,)).fetchone()
    return _row_to_server(row) if row else None


def get_server_by_token(token: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM servers WHERE agent_token = ?", (token,)).fetchone()
    return _row_to_server(row) if row else None


def add_server(server: dict):
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO servers
           (id, name, host, "group", agent_url, agent_token,
            prometheus_instance, tags, platform, pending_updates)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            server["id"],
            server.get("name", ""),
            server["host"],
            server.get("group", ""),
            server.get("agent_url", ""),
            server.get("agent_token", ""),
            server.get("prometheus_instance", ""),
            json.dumps(server.get("tags", [])),
            server.get("platform", "Linux"),
            json.dumps(server.get("pending_updates", {"count": 0, "packages": None, "reboot_required": False})),
        ),
    )
    conn.commit()


def update_server_name(server_id: str, name: str):
    conn = _get_conn()
    conn.execute("UPDATE servers SET name = ? WHERE id = ?", (name, server_id))
    conn.commit()


def update_server_platform(server_id: str, platform: str):
    conn = _get_conn()
    conn.execute("UPDATE servers SET platform = ? WHERE id = ?", (platform, server_id))
    conn.commit()


def update_server_host(server_id: str, host: str):
    conn = _get_conn()
    conn.execute(
        'UPDATE servers SET host = ?, agent_url = ? WHERE id = ?',
        (host, f"http://{host}:8080", server_id),
    )
    conn.commit()


def update_server_token(server_id: str, token: str):
    conn = _get_conn()
    conn.execute("UPDATE servers SET agent_token = ? WHERE id = ?", (token, server_id))
    conn.commit()


def update_pending_updates(host: str, count: int, packages: list, reboot_required: bool = False):
    conn = _get_conn()
    pu = json.dumps({"count": count, "packages": packages, "reboot_required": reboot_required})
    conn.execute("UPDATE servers SET pending_updates = ? WHERE host = ?", (pu, host))
    conn.commit()


def remove_server(server_id: str) -> bool:
    conn = _get_conn()
    cur = conn.execute("DELETE FROM servers WHERE id = ?", (server_id,))
    conn.commit()
    return cur.rowcount > 0


def migrate_shared_token(old_token: str):
    """Replace shared agent_token with unique per-server tokens."""
    import secrets as _secrets
    conn = _get_conn()
    rows = conn.execute("SELECT id FROM servers WHERE agent_token = ?", (old_token,)).fetchall()
    if rows:
        for r in rows:
            conn.execute("UPDATE servers SET agent_token = ? WHERE id = ?", (_secrets.token_hex(32), r["id"]))
        conn.commit()
        print(f"[DB] Migrated {len(rows)} shared agent tokens to unique per-server tokens")
