"""Customer registry: authenticated persistent CRUD, import and duplicate protection."""
import pytest

from app import AuditEvent, create_app, db
from app.customers import Customer, valid_tckn

APP_CONFIG = {
    "TESTING": True,
    "SQLALCHEMY_DATABASE_URI": "sqlite://",
    "SECRET_KEY": "test-only-secret-that-is-long-enough-123",
    "CUSTOMER_ADMIN_USERNAME": "operator",
    "CUSTOMER_ADMIN_PASSWORD": "safe-test-password-123456",
    "SESSION_COOKIE_SECURE": False,
}
TCKN1 = "10000000146"


def build_tckn(first9):
    d = [int(x) for x in first9]
    tenth = ((sum(d[0:9:2]) * 7 - sum(d[1:8:2])) % 10)
    last = (sum(d) + tenth) % 10
    return "".join(map(str, d + [tenth, last]))


TCKN2 = build_tckn("123456789")


@pytest.fixture()
def app_client():
    app = create_app(APP_CONFIG)
    with app.app_context():
        db.create_all()
    with app.test_client() as client:
        yield app, client
    with app.app_context():
        db.session.remove()
        db.drop_all()


def login(client):
    result = client.post("/api/auth/login", json={"username": "operator", "password": "safe-test-password-123456"})
    assert result.status_code == 200
    assert result.json["authenticated"] is True
    assert "customers:write" in result.json["permissions"]
    return {"X-CSRF-Token": result.json["csrfToken"]}


def test_protected_and_anonymous_no_leak(app_client):
    _, client = app_client
    assert client.get("/api/customers").status_code == 401
    assert client.post("/api/customers", json={"fullName": "Ali Can", "tckn": TCKN1}).status_code == 401
    response = client.get("/api/auth/session")
    assert response.json == {"authenticated": False, "user": None, "permissions": []}
    assert client.post("/api/auth/login", json={"username": "operator", "password": "bad"}).status_code == 401
    csrf = login(client)
    assert client.get("/api/auth/session").json["csrfToken"] == csrf["X-CSRF-Token"]
    assert client.post("/api/auth/logout").status_code == 403
    assert client.post("/api/auth/logout", headers=csrf).status_code == 200
    assert client.get("/api/customers").status_code == 401


def test_create_list_update_uniqueness_and_csrf(app_client):
    app, client = app_client
    csrf = login(client)
    row = {"fullName": "Ayşe Kaya", "tckn": TCKN1}
    assert client.post("/api/customers", json=row).status_code == 403
    created = client.post("/api/customers", json=row, headers=csrf)
    assert created.status_code == 201
    customer_id = created.json["customer"]["id"]
    assert created.json["customer"]["tckn"] == TCKN1
    assert client.post("/api/customers", json=row, headers=csrf).status_code == 409
    assert client.post("/api/customers", json={"fullName": "A", "tckn": "123"}, headers=csrf).status_code == 400
    assert client.get("/api/customers?q=Ayşe").json["total"] == 1
    updated = client.patch(f"/api/customers/{customer_id}", json={
        "fullName": "Ayşe Nur Kaya", "tckn": TCKN2
    }, headers=csrf)
    assert updated.status_code == 200
    assert updated.json["customer"]["fullName"] == "Ayşe Nur Kaya"
    assert updated.json["customer"]["tckn"] == TCKN2
    with app.app_context():
        events = db.session.scalars(db.select(AuditEvent)).all()
        assert [e.action for e in events] == ["customer.create", "customer.update"]
        assert all(TCKN1 not in str(e.details) and TCKN2 not in str(e.details) for e in events)
        assert db.session.scalar(db.select(Customer).where(Customer.tckn == TCKN2)) is not None


def test_import_deduplicates_and_preserves_manual_updates(app_client):
    app, client = app_client
    csrf = login(client)
    assert valid_tckn(TCKN1)
    assert valid_tckn(TCKN2)
    rows = [
        {"fullName": "Ahmet Yılmaz", "tckn": TCKN1},
        {"fullName": "Ahmet Yılmaz", "tckn": TCKN1},
        {"fullName": "Mehmet Demir", "tckn": TCKN2},
        {"fullName": "Eksik Kişi", "tckn": ""},
    ]
    result = client.post("/api/customers/import", json={"customers": rows}, headers=csrf)
    assert result.status_code == 200
    assert (result.json["created"], result.json["existing"], result.json["invalid"]) == (2, 0, 1)
    repeated = client.post("/api/customers/import", json={"customers": [
        {"fullName": "Başka İsim", "tckn": TCKN1}
    ]}, headers=csrf)
    assert repeated.json["created"] == 0
    assert repeated.json["existing"] == 1
    with app.app_context():
        all_rows = db.session.scalars(db.select(Customer)).all()
        assert len(all_rows) == 2
        assert {c.full_name for c in all_rows} == {"Ahmet Yılmaz", "Mehmet Demir"}
        assert db.session.scalar(db.select(AuditEvent).where(AuditEvent.action == "customer.import")) is not None


def test_missing_auth_configuration_returns_503():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://",
                      "SECRET_KEY": "test-only-secret-that-is-long-enough-123",
                      "CUSTOMER_ADMIN_USERNAME": "", "CUSTOMER_ADMIN_PASSWORD": ""})
    with app.test_client() as client:
        assert client.get("/api/customers").status_code == 503
        assert client.post("/api/auth/login", json={}).status_code == 503
