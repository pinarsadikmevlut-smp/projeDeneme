import os
from datetime import datetime, timezone
from flask import Flask, jsonify, request, session, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

db = SQLAlchemy()

class AuditEvent(db.Model):
    __tablename__ = "audit_events"
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.String(128), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target = db.Column(db.String(128), nullable=False)
    occurred_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    details = db.Column(db.JSON, nullable=False, default=dict)

def record_audit(actor_id, action, target, details=None):
    """Call only from an authenticated, authorized backend mutation; never trust actor from client."""
    event = AuditEvent(actor_id=actor_id, action=action, target=target, details=details or {})
    db.session.add(event)
    db.session.commit()
    return event

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///goldensoft.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "true").lower() == "true",
        SESSION_COOKIE_SAMESITE="Strict",
        PERMANENT_SESSION_LIFETIME=1800,
        MAX_CONTENT_LENGTH=1024 * 1024,
        SECRET_KEY=os.getenv("SECRET_KEY"),
        CUSTOMER_ADMIN_USERNAME=os.getenv("CUSTOMER_ADMIN_USERNAME", ""),
        CUSTOMER_ADMIN_PASSWORD=os.getenv("CUSTOMER_ADMIN_PASSWORD", ""),
    )
    if test_config:
        app.config.update(test_config)
    db.init_app(app)
    from .customers import bp as customers_bp, is_customer_admin, Customer
    app.register_blueprint(customers_bp)

    @app.cli.command("init-db")
    def init_db_command():
        """Initialize missing local customer/audit tables; does not delete data."""
        with app.app_context():
            db.create_all()
        print("Customer and audit tables initialized.")

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", application="goldenSoft")

    @app.get("/api/info")
    def info():
        return jsonify(name="goldenSoft", version="0.2.0")

    @app.get("/api/auth/session")
    def auth_session():
        if is_customer_admin():
            return jsonify(authenticated=True,
                user={"username": session["customer_admin"]},
                permissions=["customers:read", "customers:write"],
                csrfToken=session.get("customer_csrf"))
        return jsonify(authenticated=False, user=None, permissions=[])

    @app.get("/api/market/prices")
    def market_prices():
        from .market import get_market_data
        return jsonify(get_market_data())

    @app.get("/api/connection")
    def connection():
        return jsonify(status="ok", source="simulation", timestamp=datetime.now(timezone.utc).isoformat())

    return app

app = create_app()
