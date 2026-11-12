from app import User, db

def test_home(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Dev Workspace" in response.data

def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "OK", "message": "Uygulama çalışıyor"}

def test_db_health(client):
    response = client.get("/api/health/db")
    assert response.status_code == 200
    assert response.json["database"] == "connected"

def test_user_model(app):
    with app.app_context():
        db.session.add(User(username="testuser", email="test@example.com"))
        db.session.commit()
        assert db.session.query(User).count() == 1
