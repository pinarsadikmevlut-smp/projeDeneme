
from flask import Blueprint, render_template

web_bp = Blueprint("web", __name__)
api_bp = Blueprint("api", __name__)

@web_bp.route("/")
def home():
    return render_template("index.html")

@api_bp.route("/health")
def health():
    return {
        "status": "OK",
        "message": "Uygulama çalışıyor",
        "version": "1.0.0",
        "environment": "codespaces"
    }
