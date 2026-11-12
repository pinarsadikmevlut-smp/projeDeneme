import os

from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(test_config=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", "sqlite:///goldensoft.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    if test_config:
        app.config.update(test_config)
    db.init_app(app)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", application="goldenSoft")

    @app.get("/api/info")
    def info():
        return jsonify(
            name="goldenSoft",
            description="Frontend ve backend başlangıç uygulaması",
            version="0.1.0",
        )

    return app


app = create_app()
