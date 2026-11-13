"""JWT authentication, CSRF and user-scoped customer CRUD tests."""
import pytest
import jwt
from datetime import datetime, timedelta, timezone

from app import AuditEvent, create_app, db
from app.auth import User
from app.customers import Customer, valid_tckn

CONFIG = {
 "TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://",
 "JWT_SECRET_KEY": "test-only-jwt-signing-secret-long-enough-123456",
 "SESSION_COOKIE_SECURE": False,
}
TCKN1 = "10000000146"


def build_tckn(first9):
    digits = [int(c) for c in first9]
    tenth = ((sum(digits[0:9:2]) * 7 - sum(digits[1:8:2])) % 10)
    last = (sum(digits) + tenth) % 10
    return "".join(map(str, digits + [tenth, last]))


TCKN2 = build_tckn("123456789")


@pytest.fixture()
def app_client():
    app = create_app(CONFIG)
    with app.app_context():
        db.create_all()
    with app.test_client() as client:
        yield app, client
    with app.app_context():
        db.session.remove()
        db.drop_all()


def register(client, username):
    result = client.post("/api/auth/register", json={
        "username": username, "password": "secure-password-unique-123"})
    assert result.status_code == 201, result.json
    assert result.json["authenticated"] is True
    cookie = result.headers.get("Set-Cookie")
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie
    return {"X-CSRF-Token": result.json["csrfToken"]}, result.json["user"]["id"]


def test_anonymous_login_and_logout(app_client):
    app, client = app_client
    assert client.get("/api/customers").status_code == 401
    assert client.post("/api/customers", json={}).status_code == 401
    assert client.get("/api/auth/session").json == {
        "authenticated": False, "user": None, "permissions": []}
    assert client.post("/api/auth/login", json={
        "username": "nobody", "password": "bad"}).status_code == 401
    csrf, ident = register(client, "operator")
    assert ident >= 1
    assert client.get("/api/auth/session").json["csrfToken"] == csrf["X-CSRF-Token"]
    assert client.post("/api/auth/logout").status_code == 403
    assert client.post("/api/auth/logout", headers=csrf).status_code == 200
    assert client.get("/api/customers").status_code == 401
    assert client.post("/api/auth/login", json={
        "username": "operator", "password": "bad"}).status_code == 401
    ok = client.post("/api/auth/login", json={
        "username": "operator", "password": "secure-password-unique-123"})
    assert ok.status_code == 200


def test_crud_and_import_ownership(app_client):
    app, client = app_client
    csrf1, id1 = register(client, "userone")
    row = {"fullName": "Ayşe Kaya", "tckn": TCKN1}
    assert client.post("/api/customers", json=row).status_code == 403
    created = client.post("/api/customers", json={
        **row, "owner_id": 9999, "userId": 9999}, headers=csrf1)
    assert created.status_code == 201
    customer_id = created.json["customer"]["id"]
    assert client.get("/api/customers").json["total"] == 1
    assert client.post("/api/customers", json=row, headers=csrf1).status_code == 409
    assert client.post("/api/customers", json={
        "fullName": "A", "tckn": "123"}, headers=csrf1).status_code == 400
    assert client.patch(f"/api/customers/{customer_id}", json={
        "fullName": "Ayşe Nur Kaya", "tckn": TCKN2
    }, headers=csrf1).status_code == 200
    assert client.get("/api/customers?q=Ayşe").json["total"] == 1

    # Second registration replaces cookie: cannot enumerate or mutate user's records.
    csrf2, id2 = register(client, "usertwo")
    assert id1 != id2
    assert client.get("/api/customers").json["customers"] == []
    assert client.get("/api/customers?q=Ayşe").json["total"] == 0
    assert client.patch(f"/api/customers/{customer_id}", headers=csrf2,
                        json={"fullName": "Başka İsim"}).status_code == 404
    # Same TCKN is valid in two different owners' datasets.
    assert client.post("/api/customers", headers=csrf2, json=row).status_code == 201
    assert client.post("/api/customers/import", headers=csrf2, json={"customers": [
        row, {"fullName": "Mehmet Demir", "tckn": TCKN2},
        {"fullName": "Eksik Kişi", "tckn": ""}
    ]}).json["created"] == 1
    with app.app_context():
        c1 = db.session.get(Customer, customer_id)
        assert c1.owner_id == id1
        assert db.session.scalar(db.select(Customer).where(
            Customer.owner_id == id2, Customer.tckn == TCKN1)) is not None
        assert db.session.scalar(db.select(Customer).where(
            Customer.owner_id == id2, Customer.tckn == TCKN2)) is not None
        events = db.session.scalars(db.select(AuditEvent)).all()
        assert all(TCKN1 not in str(e.details) for e in events)


def test_bearer_auth_csrf_and_expired_token(app_client):
    app, client = app_client
    csrf, uid = register(client, "beareruser")
    token = client.get_cookie("pinargold_access", path="/api").value
    client.delete_cookie("pinargold_access", path="/api")
    assert client.get("/api/customers").status_code == 401
    header = {"Authorization": "Bearer " + token}
    assert client.get("/api/customers", headers=header).status_code == 200
    assert client.post("/api/customers", headers=header, json={
        "fullName": "Ali Can", "tckn": TCKN1}).status_code == 201
    # Invalid Bearer header must not fall back to a valid cookie.
    assert client.get("/api/customers", headers={
        "Authorization": "Bearer damaged.jwt.signature"}).status_code == 401
    claims = jwt.decode(token, CONFIG["JWT_SECRET_KEY"], algorithms=["HS256"],
                        audience="pinargold-web", issuer="pinargold")
    claims["exp"] = datetime.now(timezone.utc) - timedelta(seconds=5)
    expired = jwt.encode(claims, CONFIG["JWT_SECRET_KEY"], algorithm="HS256")
    assert client.get("/api/customers", headers={
        "Authorization": "Bearer " + expired}).status_code == 401


def test_import_deduplication(app_client):
    _, client = app_client
    csrf, _ = register(client, "importer")
    assert valid_tckn(TCKN1) and valid_tckn(TCKN2)
    rows = [
        {"fullName": "Ahmet Yılmaz", "tckn": TCKN1},
        {"fullName": "Ahmet Yılmaz", "tckn": TCKN1},
        {"fullName": "Mehmet Demir", "tckn": TCKN2},
        {"fullName": "Eksik Kişi", "tckn": ""},
    ]
    result = client.post("/api/customers/import", json={"customers": rows}, headers=csrf)
    assert result.status_code == 200
    assert (result.json["created"], result.json["existing"], result.json["invalid"]) == (2, 0, 1)
    repeated = client.post("/api/customers/import", json={"customers": [rows[0]]}, headers=csrf)
    assert repeated.json["created"] == 0 and repeated.json["existing"] == 1


def test_missing_configuration_fail_closed():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://",
                      "JWT_SECRET_KEY": "", "SECRET_KEY": ""})
    with app.test_client() as client:
        assert client.get("/api/customers").status_code == 503
        assert client.post("/api/auth/login", json={}).status_code == 503


def test_orm_bulk_write_is_scoped(app_client):
    from flask import g
    app, client = app_client
    csrf1, id1 = register(client, 'scopeone')
    first = client.post('/api/customers', headers=csrf1, json={
        'fullName': 'Ayşe Kaya', 'tckn': TCKN1}).json['customer']['id']
    csrf2, id2 = register(client, 'scopetwo')
    other = client.post('/api/customers', headers=csrf2, json={
        'fullName': 'Ali Can', 'tckn': TCKN1}).json['customer']['id']
    with app.test_request_context('/api/customers'):
        g.current_user_id = id1
        result = db.session.execute(db.update(Customer).where(Customer.id == other).values(full_name='Yanlış Değişiklik'))
        db.session.commit()
        assert result.rowcount == 0
    with app.app_context():
        assert db.session.get(Customer, first).full_name == 'Ayşe Kaya'
        assert db.session.get(Customer, other).full_name == 'Ali Can'
