"""PostgreSQL integration test, only against an explicitly isolated disposable test DB."""
import os
import pytest
from app import create_app, db
from app.customers import Customer

pytestmark = pytest.mark.skipif(
    not (os.getenv("POSTGRES_INTEGRATION_URL") and os.getenv("CUSTOMER_CI_ISOLATED_DB") == "1"),
    reason="requires a disposable PostgreSQL integration database",
)


def test_postgres_persistence_and_uniqueness():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": os.environ["POSTGRES_INTEGRATION_URL"],
        "SECRET_KEY": "test-integration-secret-long-enough-123",
        "CUSTOMER_ADMIN_USERNAME": "operator",
        "CUSTOMER_ADMIN_PASSWORD": "strong-test-password-123",
        "SESSION_COOKIE_SECURE": False,
    })
    with app.app_context():
        assert db.engine.dialect.name == "postgresql"
        db.create_all()
    with app.test_client() as client:
        login = client.post("/api/auth/login", json={
            "username": "operator", "password": "strong-test-password-123"})
        assert login.status_code == 200
        headers = {"X-CSRF-Token": login.json["csrfToken"]}
        customer = {"fullName": "Ayşe Kaya", "tckn": "10000000146"}
        created = client.post("/api/customers", json=customer, headers=headers)
        assert created.status_code == 201
        assert client.post("/api/customers", json=customer, headers=headers).status_code == 409
        imported = client.post("/api/customers/import", json={"customers": [customer]}, headers=headers)
        assert imported.status_code == 200
        assert imported.json["created"] == 0
        assert imported.json["existing"] == 1
        customer_id = created.json["customer"]["id"]
        updated = client.patch(f"/api/customers/{customer_id}",
                               json={"fullName": "Ayşe Nur Kaya"}, headers=headers)
        assert updated.status_code == 200
        assert client.get("/api/customers?q=Ayşe").json["total"] == 1
    # New app/session confirms data persists beyond a single request.
    next_app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": os.environ["POSTGRES_INTEGRATION_URL"],
        "SECRET_KEY": "different-integration-secret-long-enough-123",
        "CUSTOMER_ADMIN_USERNAME": "operator",
        "CUSTOMER_ADMIN_PASSWORD": "strong-test-password-123",
    })
    with next_app.app_context():
        record = db.session.get(Customer, customer_id)
        assert record.full_name == "Ayşe Nur Kaya"
        assert record.tckn == "10000000146"
