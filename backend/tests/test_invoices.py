"""Persistent invoice workflow; all figures are preliminary, never official documents."""
import pytest
from flask import g

from app import AuditEvent, create_app, db
from app.auth import User
from app.customers import Customer
from app.invoices import InvoiceDraft


CONFIG = {
    "TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://",
    "JWT_SECRET_KEY": "invoice-unit-test-jwt-key-at-least-32-characters",
    "SESSION_COOKIE_SECURE": False
}
TCKN = "10000000146"


@pytest.fixture()
def clients():
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
        "username": username, "password": "strong-test-password-12345"})
    assert result.status_code == 201, result.json
    return result.json["user"]["id"], {"X-CSRF-Token": result.json["csrfToken"]}


def add_customer(client, headers):
    response = client.post("/api/customers", headers=headers, json={
        "fullName": "Örnek Müşteri", "tckn": TCKN})
    assert response.status_code == 201, response.json
    return response.json["customer"]["id"]


def payload(customer_id, **overrides):
    document = {
        "customerId": customer_id,
        "documentType": "e-arsiv",
        "paymentMethod": "Havale / EFT",
        "bankReference": "DEMO-FAST-001",
        "notes": "Taslak test verisi",
        "lines": [{
            "name": "22 Ayar Bilezik", "karat": "22", "fineness": "0.916",
            "unit": "gram", "weightGram": "10.000", "quantity": 2,
            "unitPrice": "2500.00", "workmanship": "100.00"
        }]
    }
    return {**document, **overrides}


def test_login_required_and_invoice_calculation(clients):
    app, client = clients
    assert client.get("/api/invoices").status_code == 401
    assert client.post("/api/invoices", json={}).status_code == 401
    user_id, csrf = register(client, "invoiceone")
    customer = add_customer(client, csrf)
    assert client.post("/api/invoices", json=payload(customer)).status_code == 403
    created = client.post("/api/invoices", headers=csrf, json={
        **payload(customer), "ownerId": 999, "total": "-9999", "status": "simulated"
    })
    assert created.status_code == 201, created.json
    record = created.json["invoice"]
    assert record["status"] == "draft"
    assert record["total"] == "50200.00"
    assert record["fineGram"] == "18.3200"
    assert record["customerId"] == customer
    assert record["officialDocument"] is False
    assert record["transmitted"] is False
    assert record["reference"].startswith("PG-TAS-")
    assert "tckn" not in record and "TCKN" not in str(record)
    assert client.get("/api/invoices").json["total"] == 1
    assert client.get("/api/invoices?status=draft").json["total"] == 1
    assert client.get("/api/invoices?status=ready").json["total"] == 0
    record_id = record["id"]
    assert client.get(f"/api/invoices/{record_id}").json["invoice"]["id"] == record_id
    with app.app_context():
        saved = db.session.get(InvoiceDraft, record_id)
        assert saved.owner_id == user_id
        assert str(saved.net_total) == "50200.00"
        events = db.session.scalars(db.select(AuditEvent)).all()
        assert [event.action for event in events if event.action.startswith("invoice.")] == [
            "invoice.draft.create"]


def test_invoice_states_and_audit(clients):
    app, client = clients
    _, csrf = register(client, "workflow")
    customer_id = add_customer(client, csrf)
    record = client.post("/api/invoices", headers=csrf, json=payload(customer_id)).json["invoice"]
    ident = record["id"]
    revised = payload(customer_id, notes="Taslak güncellendi", lines=[
        {**payload(customer_id)["lines"][0], "quantity": 1}])
    assert client.patch(f"/api/invoices/{ident}", headers=csrf, json=revised).status_code == 200
    assert client.get(f"/api/invoices/{ident}").json["invoice"]["total"] == "25100.00"
    assert client.post(f"/api/invoices/{ident}/simulate-transfer", headers=csrf).status_code == 409
    assert client.post(f"/api/invoices/{ident}/review", headers=csrf).json["invoice"]["status"] == "ready"
    assert client.patch(f"/api/invoices/{ident}", headers=csrf, json=revised).status_code == 409
    assert client.post(f"/api/invoices/{ident}/reopen", headers=csrf).json["invoice"]["status"] == "draft"
    assert client.post(f"/api/invoices/{ident}/review", headers=csrf).status_code == 200
    simulated = client.post(f"/api/invoices/{ident}/simulate-transfer", headers=csrf)
    assert simulated.status_code == 200
    assert simulated.json["invoice"]["status"] == "simulated"
    assert simulated.json["invoice"]["transmitted"] is False
    assert client.post(f"/api/invoices/{ident}/simulate-transfer", headers=csrf).status_code == 409
    assert client.post(f"/api/invoices/{ident}/reopen", headers=csrf).status_code == 409
    with app.app_context():
        actions = [e.action for e in db.session.scalars(db.select(AuditEvent)).all()]
        assert "invoice.transfer.simulated" in actions


def test_cross_user_invoice_and_customer_ids_are_rejected(clients):
    app, client = clients
    user1, csrf1 = register(client, "firstowner")
    customer1 = add_customer(client, csrf1)
    first = client.post("/api/invoices", headers=csrf1, json=payload(customer1)).json["invoice"]["id"]
    user2, csrf2 = register(client, "secondowner")
    customer2 = add_customer(client, csrf2)
    assert user1 != user2
    assert client.get("/api/invoices").json["invoices"] == []
    assert client.get(f"/api/invoices/{first}").status_code == 404
    assert client.patch(f"/api/invoices/{first}", headers=csrf2, json=payload(customer2)).status_code == 404
    assert client.post(f"/api/invoices/{first}/review", headers=csrf2).status_code == 404
    assert client.post(f"/api/invoices/{first}/simulate-transfer", headers=csrf2).status_code == 404
    assert client.post("/api/invoices", headers=csrf2, json=payload(customer1)).status_code == 400
    own = client.post("/api/invoices", headers=csrf2, json=payload(customer2))
    assert own.status_code == 201, own.json
    with app.app_context():
        saved = db.session.get(InvoiceDraft, first)
        assert saved.owner_id == user1
        assert saved.status == "draft"


@pytest.mark.parametrize("bad", [
    {"documentType": "real-invoice"},
    {"lines": []},
    {"lines": [{}]},
    {"lines": [{**payload(1)["lines"][0], "fineness": "1.5"}]},
    {"lines": [{**payload(1)["lines"][0], "quantity": 0}]},
    {"lines": [{**payload(1)["lines"][0], "unitPrice": "-1"}]},
    {"lines": [{**payload(1)["lines"][0], "unitPrice": "NaN"}]},
    {"lines": [{**payload(1)["lines"][0], "weightGram": 0}]},
    {"lines": [{**payload(1)["lines"][0], "workmanship": 1e99}]},
])
def test_invalid_invoice_fields(clients, bad):
    _, client = clients
    _, csrf = register(client, "invalidinvoice")
    customer_id = add_customer(client, csrf)
    assert client.post("/api/invoices", headers=csrf, json=payload(customer_id, **bad)).status_code == 400


def test_bulk_invoice_mutation_cannot_access_other_owner(clients):
    app, client = clients
    owner_id, csrf1 = register(client, "bulka")
    ca = add_customer(client, csrf1)
    own = client.post("/api/invoices", headers=csrf1, json=payload(ca)).json["invoice"]["id"]
    other_id, csrf2 = register(client, "bulkb")
    cb = add_customer(client, csrf2)
    other = client.post("/api/invoices", headers=csrf2, json=payload(cb)).json["invoice"]["id"]
    with app.test_request_context("/api/invoices"):
        g.current_user_id = owner_id
        statement = db.update(InvoiceDraft).where(InvoiceDraft.id == other).values(status="simulated")
        result = db.session.execute(statement)
        db.session.commit()
        assert result.rowcount == 0
    with app.app_context():
        assert db.session.get(InvoiceDraft, own).status == "draft"
        assert db.session.get(InvoiceDraft, other).status == "draft"
