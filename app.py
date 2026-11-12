import os
from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)

def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///local.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    if test_config:
        app.config.update(test_config)
    db.init_app(app)

    @app.route("/")
    def home():
        return render_template("index.html")

    @app.route("/api/health")
    def health():
        return {"status": "OK", "message": "Uygulama çalışıyor"}

    @app.route("/api/health/db")
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))
            return {"status": "OK", "database": "connected"}
        except Exception:
            app.logger.exception("Database health check failed")
            return {"status": "ERROR", "database": "unavailable"}, 503
    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG") == "1")
