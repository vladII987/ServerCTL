"""
User management — backed by SQLite via database.py
Roles: admin (full access), user (read + add servers, no delete, no push updates)
"""
import hashlib, hmac, base64, json, time

import database as db


def _hash(password: str, secret: str) -> str:
    return hashlib.sha256((password + secret).encode()).hexdigest()


def load_users() -> list:
    return db.load_users()


def save_users(users: list):
    db.save_users(users)


def ensure_default_admin(secret: str):
    """Create admin:admin if no users exist."""
    users = db.load_users()
    if not users:
        db.add_user("admin", _hash("admin", secret), "admin")
        print("[Users] Created default admin user (password: admin) — change it immediately!")
        return [{"username": "admin", "password_hash": _hash("admin", secret), "role": "admin"}]
    return users


def authenticate(username: str, password: str, secret: str):
    user = db.get_user(username)
    if user and user["password_hash"] == _hash(password, secret):
        return {"username": user["username"], "role": user["role"]}
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
