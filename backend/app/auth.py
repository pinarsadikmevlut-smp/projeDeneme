"""JWT authentication. Browser: HttpOnly same-origin cookie + CSRF; API: Bearer."""
import hmac
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from flask import Blueprint, current_app, g, jsonify, request

from . import db

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
ISSUER = "pinargold"
AUDIENCE = "pinargold-web"
PUBLIC = {"/api/health", "/api/info", "/api/auth/login", "/api/auth/register"}
FAILURES = {}
FAILURES_LOCK = threading.Lock()
DUMMY_HASH = bcrypt.hashpw(b"never-a-valid-password", bcrypt.gensalt(rounds=12))


class User(db.Model):
    __tablename__ = "app_users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)
    auth_version = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))


def jwt_secret():
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY") or ""
    if not isinstance(secret, str) or len(secret) < 32 or secret.lower().startswith(("replace-", "change-")):
        return None
    return secret


def require_config():
    if not jwt_secret():
        return jsonify(error="auth_not_configured", message="JWT_SECRET_KEY güvenli biçimde ayarlanmamış."), 503
    return None


def session_payload(user, csrf):
    return {"authenticated": True, "user": {"id": user.id, "username": user.username},
            "permissions": ["customers:read", "customers:write"], "csrfToken": csrf}


def issue_token(user):
    now = datetime.now(timezone.utc)
    csrf = secrets.token_urlsafe(32)
    ttl = int(current_app.config["JWT_TTL_SECONDS"])
    encoded = jwt.encode({
        "sub": str(user.id), "userId": user.id, "ver": user.auth_version,
        "iat": now, "nbf": now, "exp": now + timedelta(seconds=ttl),
        "iss": ISSUER, "aud": AUDIENCE, "jti": secrets.token_urlsafe(16), "csrf": csrf,
    }, jwt_secret(), algorithm="HS256")
    return encoded, csrf


def attach_cookie(response, token):
    response.set_cookie(
        "pinargold_access", token, max_age=int(current_app.config["JWT_TTL_SECONDS"]),
        httponly=True, secure=current_app.config["SESSION_COOKIE_SECURE"],
        samesite="Strict", path="/api"
    )
    return response


def rate_limit(ip, success=False):
    # Development-only in-process throttle. Production needs centralized proxy/Redis.
    now = time.monotonic()
    with FAILURES_LOCK:
        times = [stamp for stamp in FAILURES.get(ip, []) if now - stamp < 300]
        if success:
            FAILURES.pop(ip, None)
            return False
        if len(times) >= 5:
            FAILURES[ip] = times
            return True
        times.append(now)
        FAILURES[ip] = times
    return False


def install_auth(app):
    @app.before_request
    def authenticate_request():
        g.current_user = None
        g.jwt_claims = None
        if not request.path.startswith("/api/") or request.path in PUBLIC:
            return None
        missing = require_config()
        if missing:
            return missing
        header = request.headers.get("Authorization", "")
        bearer = bool(header)
        if bearer:
            if not header.startswith("Bearer ") or not header[7:].strip():
                return jsonify(error="unauthorized", message="Geçersiz Authorization başlığı."), 401
            token = header[7:].strip()
        else:
            token = request.cookies.get("pinargold_access")
        if not token:
            if request.path == "/api/auth/session":
                return None
            return jsonify(error="unauthorized", message="Oturum açmanız gerekiyor."), 401
        try:
            claims = jwt.decode(
                token, jwt_secret(), algorithms=["HS256"], issuer=ISSUER, audience=AUDIENCE,
                options={"require": ["sub", "exp", "iat", "nbf", "iss", "aud", "jti", "csrf", "ver", "userId"]}
            )
            user_id = int(claims["sub"])
            if user_id <= 0 or claims["userId"] != user_id:
                raise ValueError("userId mismatch")
            user = db.session.get(User, user_id)
            if not user or not user.active or user.auth_version != claims["ver"]:
                raise ValueError("invalid session")
        except (jwt.PyJWTError, ValueError, TypeError, OverflowError):
            return jsonify(error="unauthorized", message="Oturum geçersiz veya süresi dolmuş."), 401
        g.current_user, g.jwt_claims = user, claims
        if not bearer and request.method not in {"GET", "HEAD", "OPTIONS"}:
            provided = request.headers.get("X-CSRF-Token", "")
            expected = claims.get("csrf", "")
            if not provided or not hmac.compare_digest(provided, expected):
                return jsonify(error="csrf_invalid", message="CSRF doğrulaması başarısız."), 403
        return None


def credentials():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    username = str(data.get("username") or "").strip().lower()
    password = data.get("password")
    if not re.fullmatch(r"[a-z0-9_.-]{3,40}", username) or not isinstance(password, str):
        return None
    return username, password


@bp.post("/register")
def register():
    missing = require_config()
    if missing:
        return missing
    data = credentials()
    if not data or not 12 <= len(data[1]) <= 128:
        return jsonify(error="invalid_credentials", message="Kullanıcı adı 3-40 karakter; şifre en az 12 karakter olmalı."), 400
    username, password = data
    if db.session.scalar(db.select(User.id).where(User.username == username)):
        return jsonify(error="username_taken", message="Kullanıcı adı kullanımda."), 409
    from sqlalchemy.exc import IntegrityError
    user = User(username=username, password_hash=bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii"))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="username_taken", message="Kullanıcı adı kullanımda."), 409
    token, csrf = issue_token(user)
    return attach_cookie(jsonify(session_payload(user, csrf)), token), 201


@bp.post("/login")
def login():
    missing = require_config()
    if missing:
        return missing
    ip = request.remote_addr or "unknown"
    with FAILURES_LOCK:
        attempts = [stamp for stamp in FAILURES.get(ip, []) if time.monotonic() - stamp < 300]
    if len(attempts) >= 5:
        return jsonify(error="rate_limited", message="Çok fazla giriş denemesi."), 429
    data = credentials()
    user = db.session.scalar(db.select(User).where(User.username == data[0])) if data else None
    supplied = (data[1].encode("utf-8") if data else b"")
    encoded = user.password_hash.encode("ascii") if user else DUMMY_HASH
    valid = len(supplied) <= 256 and bcrypt.checkpw(supplied, encoded)
    if not user or not user.active or not valid:
        rate_limit(ip)
        return jsonify(error="invalid_credentials", message="Kullanıcı adı veya şifre hatalı."), 401
    rate_limit(ip, success=True)
    token, csrf = issue_token(user)
    return attach_cookie(jsonify(session_payload(user, csrf)), token)


@bp.get("/session")
def current_session():
    if g.current_user is None:
        return jsonify(authenticated=False, user=None, permissions=[])
    return jsonify(session_payload(g.current_user, g.jwt_claims["csrf"]))


@bp.post("/logout")
def logout():
    # Invalidate all tokens for this user (including Bearer tokens).
    g.current_user.auth_version += 1
    db.session.commit()
    response = jsonify(ok=True)
    response.delete_cookie("pinargold_access", path="/api",
                           secure=current_app.config["SESSION_COOKIE_SECURE"],
                           httponly=True, samesite="Strict")
    return response
