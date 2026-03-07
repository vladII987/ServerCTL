"""
User management — stores users in /app/users.json
Roles: admin (full access), user (read + add servers, no delete, no push updates)
"""
import hashlib, hmac, base64, json, time
from pathlib import Path

USERS_FILE = Path("/app/users.json")


def _hash(password: str, secret: str) -> str:
    return hashlib.sha256((password + secret).encode()).hexdigest()


def load_users() -> list:
    if USERS_FILE.exists():
        try:
            data = json.loads(USERS_FILE.read_text())
            return data if isinstance(data, list) else []
        except Exception:
            pass
    return []


def save_users(users: list):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    USERS_FILE.write_text(json.dumps(users, indent=2))


def ensure_default_admin(secret: str):
    """Create admin:admin if no users exist."""
    users = load_users()
    if not users:
        users = [{"username": "admin", "password_hash": _hash("admin", secret), "role": "admin"}]
        save_users(users)
        print("[Users] Created default admin user (password: admin) — change it immediately!")
    return users


def authenticate(username: str, password: str, secret: str):
    for u in load_users():
        if u["username"] == username and u["password_hash"] == _hash(password, secret):
            return {"username": u["username"], "role": u["role"]}
    return None


def make_token(username: str, role: str, secret: str) -> str:
    ts = str(int(time.time()))
    payload = f"{username}|{role}|{ts}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def verify_token(token: str, secret: str):
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.split("|")
        if len(parts) != 4:
            return None
        username, role, ts, sig = parts
        payload = f"{username}|{role}|{ts}"
        expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        if int(time.time()) - int(ts) > 86400 * 7:
            return None
        return {"username": username, "role": role}
    except Exception:
        return None
