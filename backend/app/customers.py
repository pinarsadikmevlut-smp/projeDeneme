"""Local customer registry: authenticated API over the existing PostgreSQL database.

This is a single-operator administration layer for development/small deployments,
not a replacement for corporate SSO, MFA, or role-based access controls.
"""
import hmac
import os
import re
import secrets
import threading
import time
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_

from . import AuditEvent, db

bp = Blueprint("customer_registry", __name__, url_prefix="/api")

LETTERS = "A-Za-zÇĞİÖŞÜçğıöşü"
FULL_NAME_RE = re.compile(r"^[" + LETTERS + r"]+(?:[ '\-][" + LETTERS + r"]+){1,7}$")
FAILURES = {}
FAILURES_LOCK = threading.Lock()


class Customer(db.Model):
    __tablename__ = "customers"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(160), nullable=False)
    tckn = db.Column(db.String(11), nullable=False, unique=True, index=True)
    source = db.Column(db.String(30), nullable=False, default="manual")
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "fullName": self.full_name, "tckn": self.tckn,
            "source": self.source,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


def admin_ready():
    name = str(current_app.config.get("CUSTOMER_ADMIN_USERNAME") or "").strip()
    password = str(current_app.config.get("CUSTOMER_ADMIN_PASSWORD") or "")
    secret = current_app.config.get("SECRET_KEY") or ""
    return bool(name and len(password) >= 12 and len(secret) >= 24 and
                not password.lower().startswith(("change-", "replace-")) and
                not str(secret).lower().startswith(("change-", "replace-")))


def is_customer_admin():
    return admin_ready() and session.get("customer_admin") == current_app.config["CUSTOMER_ADMIN_USERNAME"]


def csrf_ok():
    expected = session.get("customer_csrf")
    provided = request.headers.get("X-CSRF-Token", "")
    return bool(expected and provided and hmac.compare_digest(expected, provided))


def protected(mutation=False):
    def decorate(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            if not admin_ready():
                return jsonify(error="customer_auth_not_configured", message="Müşteri yönetimi kimlik doğrulaması yapılandırılmamış."), 503
            if not is_customer_admin():
                return jsonify(error="unauthorized", message="Müşteri yönetimi oturumu açılmalı."), 401
            if mutation and not csrf_ok():
                return jsonify(error="csrf_invalid", message="Güvenlik doğrulaması geçersiz. Yeniden giriş yapın."), 403
            return handler(*args, **kwargs)
        return wrapper
    return decorate


def valid_tckn(value):
    if not isinstance(value, str) or not re.fullmatch(r"[1-9]\d{10}", value):
        return False
    digits = list(map(int, value))
    return ((sum(digits[0:9:2]) * 7 - sum(digits[1:8:2])) % 10 == digits[9]
            and sum(digits[:10]) % 10 == digits[10])


def normalize_customer(payload):
    if not isinstance(payload, dict):
        return None
    name = re.sub(r"\s+", " ", str(payload.get("fullName") or "")).strip()
    tckn = str(payload.get("tckn") or "").strip()
    if not (2 <= len(name) <= 160 and FULL_NAME_RE.fullmatch(name) and valid_tckn(tckn)):
        return None
    return {"fullName": name, "tckn": tckn}


def add_event(action, target, details=None):
    db.session.add(AuditEvent(actor_id=session.get("customer_admin", "unknown"), action=action,
                              target=str(target), details=details or {}))


def limit_login(ip):
    # Limited single-process defense; deploy an external proxy rate limiter for production.
    now = time.monotonic()
    with FAILURES_LOCK:
        attempts = [t for t in FAILURES.get(ip, []) if now - t < 300]
        if len(attempts) >= 5:
            FAILURES[ip] = attempts
            return True
        FAILURES[ip] = attempts
    return False


@bp.post("/auth/login")
def customer_login():
    if not admin_ready():
        return jsonify(error="customer_auth_not_configured",
                       message="Sunucuda CUSTOMER_ADMIN_USERNAME, CUSTOMER_ADMIN_PASSWORD ve SECRET_KEY ayarlanmalı."), 503
    ip = request.remote_addr or "unknown"
    if limit_login(ip):
        return jsonify(error="rate_limited", message="Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin."), 429
    payload = request.get_json(silent=True) or {}
    user = str(payload.get("username") or "")
    password = str(payload.get("password") or "")
    expected_user = str(current_app.config["CUSTOMER_ADMIN_USERNAME"])
    expected_password = str(current_app.config["CUSTOMER_ADMIN_PASSWORD"])
    allowed = (hmac.compare_digest(user.encode(), expected_user.encode()) and
               hmac.compare_digest(password.encode(), expected_password.encode()))
    if not allowed:
        with FAILURES_LOCK:
            FAILURES.setdefault(ip, []).append(time.monotonic())
        return jsonify(error="invalid_credentials", message="Kullanıcı adı veya parola hatalı."), 401
    with FAILURES_LOCK:
        FAILURES.pop(ip, None)
    session.clear()
    session["customer_admin"] = expected_user
    session["customer_csrf"] = secrets.token_urlsafe(32)
    session.permanent = True
    return jsonify(authenticated=True, user={"username": expected_user},
                   permissions=["customers:read", "customers:write"],
                   csrfToken=session["customer_csrf"])


@bp.post("/auth/logout")
@protected(mutation=True)
def customer_logout():
    session.clear()
    return jsonify(ok=True)


@bp.get("/customers")
@protected()
def list_customers():
    query = (request.args.get("q") or "").strip()[:100]
    try:
        page = max(1, int(request.args.get("page", "1")))
        per_page = min(100, max(1, int(request.args.get("perPage", "25"))))
    except ValueError:
        return jsonify(error="bad_pagination"), 400
    statement = db.select(Customer)
    if query:
        # SQLAlchemy handles parameters; do not concatenate SQL.
        safe = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(or_(
            Customer.full_name.ilike("%" + safe + "%", escape="\\"),
            Customer.tckn.ilike("%" + safe + "%", escape="\\"),
        ))
    total = db.session.scalar(db.select(func.count()).select_from(statement.subquery()))
    customers = db.session.scalars(statement.order_by(Customer.id.desc())
        .offset((page - 1) * per_page).limit(per_page)).all()
    return jsonify(customers=[item.to_dict() for item in customers], total=total,
                   page=page, perPage=per_page)


@bp.post("/customers")
@protected(mutation=True)
def create_customer():
    data = normalize_customer(request.get_json(silent=True))
    if not data:
        return jsonify(error="invalid_customer", message="Geçerli Ad Soyad ve 11 haneli TCKN girin."), 400
    record = Customer(full_name=data["fullName"], tckn=data["tckn"], source="manual")
    db.session.add(record)
    try:
        db.session.flush()
        add_event("customer.create", record.id, {"source": "manual"})
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="duplicate_tckn", message="Bu TCKN müşteri listesinde kayıtlı."), 409
    return jsonify(customer=record.to_dict()), 201


@bp.patch("/customers/<int:customer_id>")
@protected(mutation=True)
def update_customer(customer_id):
    record = db.session.get(Customer, customer_id)
    if record is None:
        return jsonify(error="not_found", message="Müşteri bulunamadı."), 404
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="invalid_customer"), 400
    data = normalize_customer({
        "fullName": payload.get("fullName", record.full_name),
        "tckn": payload.get("tckn", record.tckn),
    })
    if not data:
        return jsonify(error="invalid_customer", message="Geçerli Ad Soyad ve TCKN girin."), 400
    changed = record.full_name != data["fullName"] or record.tckn != data["tckn"]
    record.full_name, record.tckn = data["fullName"], data["tckn"]
    if changed:
        record.source = "manual"
        add_event("customer.update", record.id, {"fields": [
            key for key, different in (("fullName", True), ("tckn", True))
            if (key == "fullName" and payload.get("fullName") is not None)
            or (key == "tckn" and payload.get("tckn") is not None)
        ]})
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify(error="duplicate_tckn", message="Bu TCKN başka müşteride kayıtlı."), 409
    return jsonify(customer=record.to_dict())


@bp.post("/customers/import")
@protected(mutation=True)
def import_customers():
    payload = request.get_json(silent=True)
    incoming = payload.get("customers") if isinstance(payload, dict) else None
    if not isinstance(incoming, list) or len(incoming) > 1000:
        return jsonify(error="invalid_import", message="En fazla 1000 müşteri gönderilebilir."), 400
    valid = []
    invalid = 0
    seen = set()
    for row in incoming:
        data = normalize_customer(row)
        if data is None:
            invalid += 1
        elif data["tckn"] in seen:
            # First occurrence wins. No implicit identity overrides.
            continue
        else:
            seen.add(data["tckn"])
            valid.append(data)
    if not valid:
        return jsonify(created=0, existing=0, invalid=invalid, total=len(incoming))
    existing_tckn = set(db.session.scalars(
        db.select(Customer.tckn).where(Customer.tckn.in_([v["tckn"] for v in valid]))
    ).all())
    created = 0
    for data in valid:
        if data["tckn"] in existing_tckn:
            continue
        db.session.add(Customer(full_name=data["fullName"], tckn=data["tckn"], source="ziraat_excel"))
        created += 1
    add_event("customer.import", "batch", {
        "created": created, "existing": len(valid) - created, "invalid": invalid,
    })
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="import_conflict",
                       message="Eş zamanlı kayıt çakışması. Listeyi yenileyip yeniden deneyin."), 409
    return jsonify(created=created, existing=len(valid) - created,
                   invalid=invalid, total=len(incoming))
