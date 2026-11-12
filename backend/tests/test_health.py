from app import create_app


def test_health():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    with app.test_client() as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok", "application": "goldenSoft"}


def test_info():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    with app.test_client() as client:
        response = client.get("/api/info")
    assert response.status_code == 200
    assert response.json["name"] == "goldenSoft"
